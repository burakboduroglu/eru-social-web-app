import { describe, expect, test } from "bun:test";
import { allocateResponseVersion, tagResponseVersion } from "../src/lib/response-version";
import {
  clearFollowState,
  getFollowSnapshot,
  subscribeFollow,
  updateFollow,
} from "../src/lib/follow-state";

describe("follow state", () => {
  test("optimistically updates target counts and accepts the server response", async () => {
    getFollowSnapshot("follow-user-a", "target-a", false, 4, 7);
    let sawPending: ReturnType<typeof getFollowSnapshot> | undefined;
    const changed = await updateFollow("follow-user-a", "target-a", true, async () => {
      sawPending = getFollowSnapshot("follow-user-a", "target-a", false, 4, 7);
      return { following: true, followerCount: 5, followingCount: 7 };
    });

    expect(changed).toBe(true);
    expect(sawPending).toEqual({ following: true, followerCount: 5, followingCount: 7, pending: true });
    expect(getFollowSnapshot("follow-user-a", "target-a", false, 4, 7)).toEqual({
      following: true,
      followerCount: 5,
      followingCount: 7,
      pending: false,
    });
  });

  test("rolls back on request failure and keeps accounts isolated", async () => {
    getFollowSnapshot("follow-user-b", "target-b", false, 2, 3);
    await expect(updateFollow("follow-user-b", "target-b", true, async () => {
      throw new Error("offline");
    })).rejects.toThrow("offline");

    expect(getFollowSnapshot("follow-user-b", "target-b", false, 2, 3)).toEqual({
      following: false,
      followerCount: 2,
      followingCount: 3,
      pending: false,
    });
    expect(getFollowSnapshot("follow-user-c", "target-b", false, 2, 3).following).toBe(false);
  });

  test("ignores an in-flight response after account state is cleared", async () => {
    getFollowSnapshot("follow-user-session", "target-session", false, 0, 0);
    let finish!: (value: { following: boolean; followerCount: number; followingCount: number }) => void;
    const pending = updateFollow("follow-user-session", "target-session", true, () => new Promise(resolve => { finish = resolve; }));
    clearFollowState("follow-user-session");
    finish({ following: true, followerCount: 1, followingCount: 0 });

    expect(await pending).toBe(false);
    expect(getFollowSnapshot("follow-user-session", "target-session", false, 0, 0)).toEqual({
      following: false,
      followerCount: 0,
      followingCount: 0,
      pending: false,
    });
  });

  test("ignores stale source objects and accepts a newer response with repeated values", async () => {
    const originalVersion = allocateResponseVersion();
    const originalSource = tagResponseVersion({ profile: { id: "target-source" } }, originalVersion);
    getFollowSnapshot("follow-user-source", "target-source", false, 8, 2, originalSource);
    await updateFollow("follow-user-source", "target-source", true, async () =>
      tagResponseVersion({ following: true, followerCount: 9, followingCount: 2 }, allocateResponseVersion()));

    expect(getFollowSnapshot("follow-user-source", "target-source", false, 8, 2, originalSource).following).toBe(true);
    let notifications = 0;
    const unsubscribe = subscribeFollow("follow-user-source", "target-source", () => { notifications += 1; });
    const staleSource = tagResponseVersion({ profile: { id: "target-source" } }, originalVersion);
    expect(getFollowSnapshot("follow-user-source", "target-source", false, 8, 2, staleSource).following).toBe(true);
    const refreshedSource = tagResponseVersion({ profile: { id: "target-source" } }, allocateResponseVersion());
    const refreshed = getFollowSnapshot("follow-user-source", "target-source", false, 8, 2, refreshedSource);
    unsubscribe();

    expect(refreshed).toEqual({ following: false, followerCount: 8, followingCount: 2, pending: false });
    expect(notifications).toBe(0);
  });
});
