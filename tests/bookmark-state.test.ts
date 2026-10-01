import { afterEach, describe, expect, test } from "bun:test";
import { clearBookmarkState, getBookmarkSnapshot, peekBookmarkSnapshot, subscribeBookmark, updateBookmark } from "../src/lib/bookmark-state";
import { allocateResponseVersion, tagResponseVersion } from "../src/lib/response-version";

afterEach(() => clearBookmarkState());

describe("account-scoped bookmark state", () => {
  test("shares optimistic updates and blocks duplicate requests for the same post", async () => {
    let resolveRequest!: (value: { bookmarked: boolean }) => void;
    let requests = 0;
    const pending = updateBookmark("user-a", "post-1", true, () => {
      requests++;
      return new Promise(resolve => { resolveRequest = resolve; });
    });

    expect(getBookmarkSnapshot("user-a", "post-1", false)).toEqual({ bookmarked: true, pending: true });
    expect(await updateBookmark("user-a", "post-1", false, async () => ({ bookmarked: false }))).toBe(false);
    expect(requests).toBe(1);

    resolveRequest({ bookmarked: true });
    expect(await pending).toBe(true);
    expect(getBookmarkSnapshot("user-a", "post-1", false)).toEqual({ bookmarked: true, pending: false });
  });

  test("rolls back a failed optimistic update", async () => {
    getBookmarkSnapshot("user-a", "post-1", true);
    let notifications = 0;
    const unsubscribe = subscribeBookmark("user-a", "post-1", () => { notifications++; });
    await expect(updateBookmark("user-a", "post-1", false, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(getBookmarkSnapshot("user-a", "post-1", false)).toEqual({ bookmarked: true, pending: false });
    expect(notifications).toBe(2);
    unsubscribe();
  });

  test("keeps the same post state separate between accounts", async () => {
    getBookmarkSnapshot("user-a", "post-1", true);
    getBookmarkSnapshot("user-b", "post-1", false);
    await updateBookmark("user-b", "post-1", true, async () => ({ bookmarked: true }));

    expect(getBookmarkSnapshot("user-a", "post-1", false).bookmarked).toBe(true);
    expect(getBookmarkSnapshot("user-b", "post-1", false).bookmarked).toBe(true);
    clearBookmarkState("user-a");
    expect(getBookmarkSnapshot("user-a", "post-1", false).bookmarked).toBe(false);
    expect(getBookmarkSnapshot("user-b", "post-1", false).bookmarked).toBe(true);
  });

  test("reconciles a fresh server post while preserving the same optimistic source", () => {
    const source = { bookmarked: true };
    const snapshot = getBookmarkSnapshot("user-a", "post-1", true, source);
    expect(snapshot.bookmarked).toBe(true);
    expect(getBookmarkSnapshot("user-a", "post-1", true, source)).toBe(snapshot);
    expect(getBookmarkSnapshot("user-a", "post-1", true, source).bookmarked).toBe(true);

    const refreshedSource = { bookmarked: false };
    expect(getBookmarkSnapshot("user-a", "post-1", false, refreshedSource).bookmarked).toBe(false);
  });

  test("does not let a duplicate card's stale source replace the shared mutation", async () => {
    const firstSource = { bookmarked: false };
    getBookmarkSnapshot("user-a", "post-1", false, firstSource);
    await updateBookmark("user-a", "post-1", true, async () => ({ bookmarked: true }));

    const duplicateStaleSource = { bookmarked: false };
    expect(getBookmarkSnapshot("user-a", "post-1", false, duplicateStaleSource).bookmarked).toBe(true);
    const refreshedSource = { bookmarked: true };
    expect(getBookmarkSnapshot("user-a", "post-1", true, refreshedSource).bookmarked).toBe(true);
  });

  test("keeps the server response authoritative when it differs from the optimistic value", async () => {
    getBookmarkSnapshot("user-a", "post-1", false, { bookmarked: false });
    await updateBookmark("user-a", "post-1", true, async () => ({ bookmarked: false }));
    expect(peekBookmarkSnapshot("user-a", "post-1")?.bookmarked).toBe(false);
  });

  test("remembers the latest source received during a pending mutation", async () => {
    getBookmarkSnapshot("user-a", "post-1", true, { bookmarked: true });
    let resolveRequest!: (value: { bookmarked: boolean }) => void;
    const pending = updateBookmark("user-a", "post-1", false, () => new Promise(resolve => { resolveRequest = resolve; }));
    const refreshedSource = { bookmarked: false };

    expect(getBookmarkSnapshot("user-a", "post-1", false, refreshedSource)).toEqual({ bookmarked: false, pending: true });
    resolveRequest({ bookmarked: false });
    expect(await pending).toBe(true);
    expect(getBookmarkSnapshot("user-a", "post-1", false, refreshedSource).bookmarked).toBe(false);
  });

  test("ignores an in-flight response after account state is cleared", async () => {
    let resolveRequest!: (value: { bookmarked: boolean }) => void;
    const pending = updateBookmark("user-a", "post-1", true, () => new Promise(resolve => { resolveRequest = resolve; }));
    clearBookmarkState("user-a");
    resolveRequest({ bookmarked: true });

    expect(await pending).toBe(false);
    expect(getBookmarkSnapshot("user-a", "post-1", false).bookmarked).toBe(false);
  });

  test("orders authoritative responses and accepts a newer repeated value", async () => {
    const originalVersion = allocateResponseVersion();
    const original = tagResponseVersion({ bookmarked: false }, originalVersion);
    getBookmarkSnapshot("user-a", "post-1", false, original);
    await updateBookmark("user-a", "post-1", true, async () =>
      tagResponseVersion({ bookmarked: true }, allocateResponseVersion()));

    const staleDuplicate = tagResponseVersion({ bookmarked: false }, originalVersion);
    expect(getBookmarkSnapshot("user-a", "post-1", false, staleDuplicate).bookmarked).toBe(true);
    const freshRepeated = tagResponseVersion({ bookmarked: false }, allocateResponseVersion());
    expect(getBookmarkSnapshot("user-a", "post-1", false, freshRepeated).bookmarked).toBe(false);
  });
});
