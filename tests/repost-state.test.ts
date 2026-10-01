import { afterEach, describe, expect, test } from "bun:test";
import { clearRepostState, getRepostSnapshot, peekRepostSnapshot, updateRepost } from "../src/lib/repost-state";
import { allocateResponseVersion, tagResponseVersion } from "../src/lib/response-version";

afterEach(() => clearRepostState());

describe("account-scoped repost state", () => {
  test("guards concurrent toggles and accepts the server's final count", async () => {
    let resolveRequest!: (value: { reposted: boolean; repostCount: number }) => void;
    let requestCount = 0;
    const pending = updateRepost("user-a", "post-1", true, 1, () => {
      requestCount++;
      return new Promise(resolve => { resolveRequest = resolve; });
    });

    expect(getRepostSnapshot("user-a", "post-1", false, 0)).toEqual({ reposted: true, repostCount: 1, pending: true });
    expect(await updateRepost("user-a", "post-1", false, 0, async () => ({ reposted: false, repostCount: 0 }))).toBe(false);
    expect(requestCount).toBe(1);

    resolveRequest({ reposted: true, repostCount: 7 });
    expect(await pending).toBe(true);
    expect(getRepostSnapshot("user-a", "post-1", false, 0)).toEqual({ reposted: true, repostCount: 7, pending: false });
  });

  test("rolls back a failed optimistic update", async () => {
    getRepostSnapshot("user-a", "post-1", true, 4);
    await expect(updateRepost("user-a", "post-1", false, 3, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(getRepostSnapshot("user-a", "post-1", false, 0)).toEqual({ reposted: true, repostCount: 4, pending: false });
  });

  test("reconciles a fresh server post while preserving the current source", () => {
    const source = { reposted: true, repostCount: 3 };
    const snapshot = getRepostSnapshot("user-a", "post-1", true, 3, source);
    expect(snapshot).toEqual({ reposted: true, repostCount: 3, pending: false });
    expect(getRepostSnapshot("user-a", "post-1", true, 3, source)).toBe(snapshot);
    expect(getRepostSnapshot("user-a", "post-1", true, 3, source).repostCount).toBe(3);

    const refreshedSource = { reposted: false, repostCount: 2 };
    expect(getRepostSnapshot("user-a", "post-1", false, 2, refreshedSource)).toEqual({ reposted: false, repostCount: 2, pending: false });
  });

  test("keeps a duplicate card's stale source from replacing the shared mutation", async () => {
    getRepostSnapshot("user-a", "post-1", false, 2, { reposted: false, repostCount: 2 });
    await updateRepost("user-a", "post-1", true, 3, async () => ({ reposted: true, repostCount: 3 }));

    expect(getRepostSnapshot("user-a", "post-1", false, 2, { reposted: false, repostCount: 2 })).toEqual({ reposted: true, repostCount: 3, pending: false });
    expect(getRepostSnapshot("user-a", "post-1", true, 3, { reposted: true, repostCount: 3 })).toEqual({ reposted: true, repostCount: 3, pending: false });
  });

  test("keeps the server response authoritative when it differs from optimistic state", async () => {
    getRepostSnapshot("user-a", "post-1", false, 2, { reposted: false, repostCount: 2 });
    await updateRepost("user-a", "post-1", true, 3, async () => ({ reposted: false, repostCount: 4 }));
    expect(peekRepostSnapshot("user-a", "post-1")).toEqual({ reposted: false, repostCount: 4, pending: false });
  });

  test("remembers the latest source received during a pending mutation", async () => {
    getRepostSnapshot("user-a", "post-1", true, 4, { reposted: true, repostCount: 4 });
    let resolveRequest!: (value: { reposted: boolean; repostCount: number }) => void;
    const pending = updateRepost("user-a", "post-1", false, 3, () => new Promise(resolve => { resolveRequest = resolve; }));
    const refreshedSource = { reposted: false, repostCount: 3 };

    expect(getRepostSnapshot("user-a", "post-1", false, 3, refreshedSource)).toEqual({ reposted: false, repostCount: 3, pending: true });
    resolveRequest({ reposted: false, repostCount: 3 });
    expect(await pending).toBe(true);
    expect(getRepostSnapshot("user-a", "post-1", false, 3, refreshedSource).reposted).toBe(false);
  });

  test("ignores an in-flight response after account state is reset", async () => {
    let resolveRequest!: (value: { reposted: boolean; repostCount: number }) => void;
    const pending = updateRepost("user-a", "post-1", true, 1, () => new Promise(resolve => { resolveRequest = resolve; }));
    clearRepostState("user-a");
    resolveRequest({ reposted: true, repostCount: 1 });

    expect(await pending).toBe(false);
    expect(getRepostSnapshot("user-a", "post-1", false, 0)).toEqual({ reposted: false, repostCount: 0, pending: false });
  });

  test("orders authoritative responses and accepts a newer repeated value", async () => {
    const originalVersion = allocateResponseVersion();
    const original = tagResponseVersion({ post: { id: "post-1" } }, originalVersion);
    getRepostSnapshot("user-a", "post-1", false, 2, original);
    await updateRepost("user-a", "post-1", true, 3, async () =>
      tagResponseVersion({ reposted: true, repostCount: 3 }, allocateResponseVersion()));

    const staleDuplicate = tagResponseVersion({ post: { id: "post-1" } }, originalVersion);
    expect(getRepostSnapshot("user-a", "post-1", false, 2, staleDuplicate)).toEqual({ reposted: true, repostCount: 3, pending: false });
    const freshRepeated = tagResponseVersion({ post: { id: "post-1" } }, allocateResponseVersion());
    expect(getRepostSnapshot("user-a", "post-1", false, 2, freshRepeated)).toEqual({ reposted: false, repostCount: 2, pending: false });
  });
});
