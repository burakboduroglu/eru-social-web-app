import { describe, expect, test } from "bun:test";
import { rankCandidates, type FeedCandidate, type ViewerContext } from "../server/feed-ranking";

const now = Date.parse("2026-09-30T12:00:00.000Z");

function candidate(overrides: Partial<FeedCandidate> & Pick<FeedCandidate, "id">): FeedCandidate {
  return {
    authorId: "author-a",
    communityId: null,
    createdAt: now - 60 * 60 * 1000,
    text: overrides.id,
    likeCount: 0,
    replyCount: 0,
    uniqueReplyAuthors: 0,
    ...overrides,
  };
}

function context(overrides: Partial<ViewerContext> = {}): ViewerContext {
  return {
    userId: "viewer",
    joinedCommunityIds: new Set(),
    authorAffinity: new Map(),
    communityAffinity: new Map(),
    ...overrides,
  };
}

describe("rankCandidates", () => {
  test("gives fresh low-engagement posts a chance against stale viral posts", () => {
    const fresh = candidate({ id: "fresh", authorId: "new-author", createdAt: now - 5 * 60_000 });
    const staleViral = candidate({
      id: "stale-viral",
      authorId: "popular-author",
      createdAt: now - 10 * 24 * 60 * 60_000,
      likeCount: 1_000_000,
      replyCount: 50_000,
      uniqueReplyAuthors: 20_000,
    });

    expect(rankCandidates([staleViral, fresh], context(), now)).toEqual(["fresh", "stale-viral"]);
  });

  test("uses caller-derived author and community affinities with bounded effect", () => {
    const interested = candidate({ id: "interested", authorId: "favorite", communityId: "club" });
    const neutral = candidate({ id: "neutral", authorId: "other", communityId: "elsewhere" });
    const viewer = context({
      joinedCommunityIds: new Set(["club"]),
      authorAffinity: new Map([["favorite", 1000]]),
      communityAffinity: new Map([["club", 1000]]),
    });

    expect(rankCandidates([neutral, interested], viewer, now)[0]).toBe("interested");
  });

  test("caps engagement counts and uses logarithmic growth", () => {
    const small = candidate({ id: "small", authorId: "a", likeCount: 100 });
    const large = candidate({ id: "large", authorId: "b", likeCount: 1_000_000_000 });
    const capped = candidate({ id: "capped", authorId: "c", likeCount: 500 });

    expect(rankCandidates([small, large, capped], context(), now)).toEqual(["capped", "large", "small"]);
    expect(rankCandidates([small, large], context(), now)[0]).toBe("large");
  });

  test("softly avoids consecutive authors and repeated communities", () => {
    const posts = [
      candidate({ id: "a1", authorId: "a", communityId: "club", likeCount: 10 }),
      candidate({ id: "a2", authorId: "a", communityId: "club", likeCount: 9 }),
      candidate({ id: "b1", authorId: "b", communityId: "other", likeCount: 8 }),
    ];

    const ranked = rankCandidates(posts, context(), now);
    expect(ranked).toHaveLength(3);
    expect(ranked[0]).toBe("a1");
    expect(ranked[1]).toBe("b1");
  });

  test("keeps every eligible post when the pool contains only one author", () => {
    const posts = ["one", "two", "three"].map((id, index) => candidate({
      id,
      authorId: "only-author",
      createdAt: now - index * 60_000,
    }));

    expect(rankCandidates(posts, context(), now)).toHaveLength(3);
  });

  test("uses recency as a dependable cold-start order", () => {
    const posts = [
      candidate({ id: "old", authorId: "a", createdAt: now - 20 * 60 * 60_000 }),
      candidate({ id: "new", authorId: "b", createdAt: now - 2 * 60 * 60_000 }),
      candidate({ id: "newest", authorId: "c", createdAt: now - 5 * 60_000 }),
    ];

    expect(rankCandidates(posts, context(), now)).toEqual(["newest", "new", "old"]);
  });

  test("is deterministic and clamps future timestamps for scoring and ties", () => {
    const posts = [
      candidate({ id: "z", authorId: "z", createdAt: now + 86_400_000 }),
      candidate({ id: "a", authorId: "a", createdAt: now }),
      candidate({ id: "m", authorId: "m", createdAt: "not-a-date" }),
    ];

    expect(rankCandidates(posts, context(), now)).toEqual(["a", "z"]);
    expect(rankCandidates([...posts].reverse(), context(), now)).toEqual(["a", "z"]);
  });

  test("drops bad dates and dismissed posts, and deduplicates IDs and same-author text", () => {
    const posts = [
      candidate({ id: "old-copy", authorId: "a", createdAt: now - 2 * 60_000, text: "  Hello   WORLD " }),
      candidate({ id: "new-copy", authorId: "a", createdAt: now - 60_000, text: "hello world" }),
      candidate({ id: "same-words-other-author", authorId: "b", text: "HELLO WORLD" }),
      candidate({ id: "same-id", authorId: "c", text: "first" }),
      candidate({ id: "same-id", authorId: "d", text: "duplicate id" }),
      candidate({ id: "invalid", createdAt: "invalid date" }),
      candidate({ id: "dismissed" }),
    ];

    expect(rankCandidates(posts, context({ dismissedIds: new Set(["dismissed"]) }), now))
      .toContain("new-copy");
    expect(rankCandidates(posts, context({ dismissedIds: new Set(["dismissed"]) }), now))
      .not.toContain("old-copy");
    expect(rankCandidates(posts, context({ dismissedIds: new Set(["dismissed"]) }), now))
      .toContain("same-words-other-author");
    expect(rankCandidates(posts, context({ dismissedIds: new Set(["dismissed"]) }), now))
      .not.toContain("invalid");
    expect(rankCandidates(posts, context({ dismissedIds: new Set(["dismissed"]) }), now)
      .filter(id => id === "same-id")).toHaveLength(1);
  });
});
