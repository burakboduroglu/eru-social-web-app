import { expect, test } from "bun:test";
import { RequestCache } from "../src/lib/request-cache";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("coalesces concurrent loads and caches their successful value", async () => {
  const cache = new RequestCache();
  const load = deferred<string>();
  let calls = 0;
  const loader = () => { calls++; return load.promise; };

  const first = cache.get("feed", 100, loader);
  const second = cache.get("feed", 100, loader);
  expect(calls).toBe(0);
  await Promise.resolve();
  expect(calls).toBe(1);
  load.resolve("posts");
  await expect(Promise.all([first, second])).resolves.toEqual(["posts", "posts"]);
  await expect(cache.get("feed", 100, loader)).resolves.toBe("posts");
  expect(calls).toBe(1);
});

test("expires values using an injectable clock", async () => {
  let time = 10;
  const cache = new RequestCache(100, () => time);
  let calls = 0;
  const loader = async () => ++calls;

  await expect(cache.get("value", 5, loader)).resolves.toBe(1);
  time = 14;
  await expect(cache.get("value", 5, loader)).resolves.toBe(1);
  time = 15;
  await expect(cache.get("value", 5, loader)).resolves.toBe(2);
  expect(calls).toBe(2);
});

test("does not cache a failed load and allows retry", async () => {
  const cache = new RequestCache();
  let calls = 0;
  const loader = async () => {
    calls++;
    if (calls === 1) throw new Error("temporary failure");
    return "recovered";
  };

  await expect(cache.get("value", 100, loader)).rejects.toThrow("temporary failure");
  await expect(cache.get("value", 100, loader)).resolves.toBe("recovered");
  expect(calls).toBe(2);
});

test("invalidation during a pending load allows callers to resolve without recaching", async () => {
  const cache = new RequestCache();
  const oldLoad = deferred<string>();
  let calls = 0;
  const oldRequest = cache.get("user:a:feed", 100, () => { calls++; return oldLoad.promise; });
  await Promise.resolve();
  cache.invalidate(key => key.startsWith("user:a:"));

  const newRequest = cache.get("user:a:feed", 100, async () => { calls++; return "fresh"; });
  await expect(newRequest).resolves.toBe("fresh");
  oldLoad.resolve("stale");
  await expect(oldRequest).resolves.toBe("stale");
  await expect(cache.get("user:a:feed", 100, async () => "unexpected")).resolves.toBe("fresh");
  expect(calls).toBe(2);
});

test("keeps user-scoped keys isolated", async () => {
  const cache = new RequestCache();
  let calls = 0;
  const loader = async (user: string) => `${user}-${++calls}`;

  await expect(cache.get("user:a:feed", 100, () => loader("a"))).resolves.toBe("a-1");
  await expect(cache.get("user:b:feed", 100, () => loader("b"))).resolves.toBe("b-2");
  await expect(cache.get("user:a:feed", 100, () => loader("a"))).resolves.toBe("a-1");
  expect(calls).toBe(2);
});

test("evicts least recently used completed entry at capacity", async () => {
  const cache = new RequestCache(2);
  let calls = 0;
  const load = (value: string) => async () => `${value}-${++calls}`;

  await cache.get("a", 100, load("a"));
  await cache.get("b", 100, load("b"));
  await cache.get("a", 100, load("a")); // Make a the most recently used.
  await cache.get("c", 100, load("c")); // Evicts b.
  await cache.get("a", 100, load("a"));
  await cache.get("b", 100, load("b"));
  expect(calls).toBe(4);
});

test("a late pending result cannot replace a newer request after eviction", async () => {
  const cache = new RequestCache(1);
  const older = deferred<string>();
  const oldRequest = cache.get("same", 100, () => older.promise);
  await Promise.resolve();
  await cache.get("other", 100, async () => "other");
  await expect(cache.get("same", 100, async () => "new")).resolves.toBe("new");
  older.resolve("old");
  await expect(oldRequest).resolves.toBe("old");
  await expect(cache.get("same", 100, async () => "unexpected")).resolves.toBe("new");
});
