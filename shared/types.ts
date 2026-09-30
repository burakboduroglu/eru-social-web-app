import type { profiles, communities, threads } from "../server/db/schema";
export type Profile = typeof profiles.$inferSelect;
export type Community = typeof communities.$inferSelect;
export type CommunitySummary = Community & { memberCount: number; joined: boolean };
export type Post = typeof threads.$inferSelect & {
  author: Profile;
  community: Community | null;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  replyAuthors: { id: string; image: string }[];
};
export type ThreadPage = { post: Post; replies: Post[]; hasMore: boolean };
export type FeedPage = { posts: Post[]; hasMore: boolean; snapshot?: string };
export type ProfilePage = { profile: Profile; posts: Post[]; hasMore: boolean; postCount: number };
export type CommunityPage = { community: CommunitySummary; owner: Profile; members: Profile[]; posts: Post[]; hasMore: boolean };
export type Me = { profile: Profile; communities: CommunitySummary[]; suggestedCommunities: CommunitySummary[] };
export type SearchResults = { query: string; posts: Post[]; people: Profile[]; communities: CommunitySummary[] };
