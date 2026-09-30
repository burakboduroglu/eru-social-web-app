export type FeedCandidate = {
  id: string;
  authorId: string;
  communityId: string | null;
  createdAt: string | number | Date;
  text: string;
  likeCount: number;
  replyCount: number;
  /** Distinct reply authors, with the post author excluded by the query. */
  uniqueReplyAuthors: number;
};

export type ViewerContext = {
  userId: string;
  joinedCommunityIds: ReadonlySet<string>;
  /** Numeric affinity scores prepared by the caller from likes and replies. */
  authorAffinity: ReadonlyMap<string, number>;
  communityAffinity: ReadonlyMap<string, number>;
  dismissedIds?: ReadonlySet<string>;
};

// These are local heuristic points, not learned probabilities or X ranking weights.
export const FEED_RANKING = {
  // A fresh post gets a useful baseline, so it can compete before it collects engagement.
  freshnessPoints: 24,
  freshnessHalfLifeHours: 30,
  // Engagement fades more slowly than the freshness baseline, but cannot grow without bound.
  engagementHalfLifeHours: 72,
  likeCountCap: 500,
  replyCountCap: 200,
  uniqueReplyAuthorsCap: 100,
  likeLogPoints: 3.2,
  replyLogPoints: 4.2,
  uniqueReplyAuthorLogPoints: 3.5,
  // Caller-derived affinities are capped so a large input cannot dominate the feed.
  affinityCap: 4,
  authorAffinityPoints: 1.5,
  communityAffinityPoints: 1.25,
  joinedCommunityPoints: 2.5,
  // Greedy reranking prefers variety while retaining every eligible post.
  repeatedAuthorPenalty: 3,
  consecutiveAuthorPenalty: 10,
  repeatedCommunityPenalty: 2.25,
} as const;

const HOUR_MS = 60 * 60 * 1000;
const HALF_LIFE_DIVISOR = Math.LN2;

type PreparedCandidate = {
  candidate: FeedCandidate;
  createdAtMs: number;
  score: number;
  fingerprint: string;
};

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function cappedAffinity(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(-FEED_RANKING.affinityCap, Math.min(FEED_RANKING.affinityCap, value));
}

function normalizeText(text: string): string {
  return text.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}

function candidateFingerprint(candidate: FeedCandidate): string {
  return JSON.stringify([
    candidate.authorId,
    candidate.communityId,
    candidate.text,
    candidate.likeCount,
    candidate.replyCount,
    candidate.uniqueReplyAuthors,
  ]);
}

function comparePrepared(a: PreparedCandidate, b: PreparedCandidate): number {
  return b.createdAtMs - a.createdAtMs
    || a.candidate.id.localeCompare(b.candidate.id)
    || a.fingerprint.localeCompare(b.fingerprint);
}

function scoreCandidate(
  candidate: FeedCandidate,
  ageHours: number,
  context: ViewerContext,
): number {
  const freshness = FEED_RANKING.freshnessPoints
    * Math.exp(-HALF_LIFE_DIVISOR * ageHours / FEED_RANKING.freshnessHalfLifeHours);
  const engagement = (
    FEED_RANKING.likeLogPoints * Math.log1p(Math.min(finiteNonNegative(candidate.likeCount), FEED_RANKING.likeCountCap))
    + FEED_RANKING.replyLogPoints * Math.log1p(Math.min(finiteNonNegative(candidate.replyCount), FEED_RANKING.replyCountCap))
    + FEED_RANKING.uniqueReplyAuthorLogPoints * Math.log1p(Math.min(finiteNonNegative(candidate.uniqueReplyAuthors), FEED_RANKING.uniqueReplyAuthorsCap))
  ) * Math.exp(-HALF_LIFE_DIVISOR * ageHours / FEED_RANKING.engagementHalfLifeHours);
  const authorAffinity = FEED_RANKING.authorAffinityPoints
    * cappedAffinity(context.authorAffinity.get(candidate.authorId));
  const communityAffinity = candidate.communityId === null
    ? 0
    : FEED_RANKING.communityAffinityPoints
      * cappedAffinity(context.communityAffinity.get(candidate.communityId));
  const membership = candidate.communityId !== null && context.joinedCommunityIds.has(candidate.communityId)
    ? FEED_RANKING.joinedCommunityPoints
    : 0;

  return freshness + engagement + authorAffinity + communityAffinity + membership;
}

/** Rank an already assembled candidate pool with a deterministic, dependency-free heuristic. */
export function rankCandidates(
  candidates: readonly FeedCandidate[],
  viewerContext: ViewerContext,
  now: number,
): string[] {
  const nowMs = now;
  if (!Number.isFinite(nowMs)) return [];

  const valid: PreparedCandidate[] = [];
  for (const candidate of candidates) {
    if (viewerContext.dismissedIds?.has(candidate.id)) continue;
    const createdAtMs = candidate.createdAt instanceof Date
      ? candidate.createdAt.getTime()
      : new Date(candidate.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) continue;

    // Clamp future dates to age zero; a client clock cannot earn extra freshness points.
    const ageHours = Math.max(0, nowMs - createdAtMs) / HOUR_MS;
    valid.push({
      candidate,
      // The tie-break timestamp is clamped too, so future dates cannot jump ahead.
      createdAtMs: Math.min(createdAtMs, nowMs),
      score: scoreCandidate(candidate, ageHours, viewerContext),
      fingerprint: candidateFingerprint(candidate),
    });
  }

  // Sort before deduplication so repeated IDs or text resolve the same way for any input order.
  valid.sort(comparePrepared);
  const unique: PreparedCandidate[] = [];
  const seenIds = new Set<string>();
  const seenTextByAuthor = new Map<string, Set<string>>();
  for (const item of valid) {
    const { candidate } = item;
    if (seenIds.has(candidate.id)) continue;
    const normalizedText = normalizeText(candidate.text);
    const authorTexts = seenTextByAuthor.get(candidate.authorId);
    if (normalizedText && authorTexts?.has(normalizedText)) continue;

    seenIds.add(candidate.id);
    if (normalizedText) {
      const texts = authorTexts ?? new Set<string>();
      texts.add(normalizedText);
      seenTextByAuthor.set(candidate.authorId, texts);
    }
    unique.push(item);
  }

  const authorCounts = new Map<string, number>();
  const communityCounts = new Map<string, number>();
  const remaining = [...unique];
  const ordered: string[] = [];
  let previousAuthor: string | undefined;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const authorCount = authorCounts.get(item.candidate.authorId) ?? 0;
      const communityId = item.candidate.communityId;
      const communityCount = communityId === null ? 0 : communityCounts.get(communityId) ?? 0;
      const diversityPenalty = authorCount * FEED_RANKING.repeatedAuthorPenalty
        + (item.candidate.authorId === previousAuthor ? FEED_RANKING.consecutiveAuthorPenalty : 0)
        + communityCount * FEED_RANKING.repeatedCommunityPenalty;
      const adjustedScore = item.score - diversityPenalty;
      const best = remaining[bestIndex];
      if (adjustedScore > bestScore
        || (adjustedScore === bestScore && comparePrepared(item, best) < 0)) {
        bestIndex = index;
        bestScore = adjustedScore;
      }
    }

    const [selected] = remaining.splice(bestIndex, 1);
    const { candidate } = selected;
    ordered.push(candidate.id);
    authorCounts.set(candidate.authorId, (authorCounts.get(candidate.authorId) ?? 0) + 1);
    if (candidate.communityId !== null) {
      communityCounts.set(candidate.communityId, (communityCounts.get(candidate.communityId) ?? 0) + 1);
    }
    previousAuthor = candidate.authorId;
  }

  return ordered;
}
