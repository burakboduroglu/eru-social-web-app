import { relations, sql } from "drizzle-orm";
import { pgTable, pgSchema, uuid, text, boolean, timestamp, integer, primaryKey, index, check, type AnyPgColumn } from "drizzle-orm/pg-core";

// Supabase owns auth.users. App migrations must never create or modify it.
const authUsers = pgSchema("auth").table("users", { id: uuid().primaryKey() });
export const profiles = pgTable("profiles", {
  id: uuid().primaryKey().references(() => authUsers.id, { onDelete: "cascade" }),
  username: text().unique(),
  name: text().notNull().default(""),
  bio: text().notNull().default(""),
  image: text().notNull().default(""),
  onboarded: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, t => [
  check("profiles_username_check", sql`${t.username} ~ '^[a-z0-9_]{3,30}$'`),
  check("profiles_name_check", sql`length(${t.name}) <= 30`),
  check("profiles_bio_check", sql`length(${t.bio}) <= 1000`),
  check("profiles_check", sql`not ${t.onboarded} or (${t.username} is not null and length(trim(${t.name})) >= 3)`),
]);
export const communities = pgTable("communities", {
  id: uuid().primaryKey().defaultRandom(),
  username: text().notNull().unique(),
  name: text().notNull(),
  bio: text().notNull().default(""),
  image: text().notNull().default(""),
  createdBy: uuid("created_by").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, t => [
  check("communities_username_check", sql`${t.username} ~ '^[a-z0-9_]{3,30}$'`),
  check("communities_name_check", sql`length(trim(${t.name})) between 3 and 60`),
  check("communities_bio_check", sql`length(${t.bio}) <= 350`),
]);
export const members = pgTable("community_members", {
  communityId: uuid("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.communityId, t.userId] }), index("members_user_idx").on(t.userId)]);
export const threads = pgTable("threads", {
  id: uuid().primaryKey().defaultRandom(),
  text: text().notNull(),
  authorId: uuid("author_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  communityId: uuid("community_id").references(() => communities.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => threads.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, t => [
  check("threads_text_check", sql`length(trim(${t.text})) between 1 and 550`),
  index("threads_author_idx").on(t.authorId, t.createdAt.desc()),
  index("threads_parent_idx").on(t.parentId),
  index("threads_feed_idx").on(t.createdAt.desc()).where(sql`${t.parentId} is null`),
  index("threads_community_idx").on(t.communityId),
]);
export const likes = pgTable("thread_likes", {
  threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.threadId, t.userId] }), index("likes_user_idx").on(t.userId)]);
export const threadRelations = relations(threads, ({ one }) => ({
  author: one(profiles, { fields: [threads.authorId], references: [profiles.id] }),
  community: one(communities, { fields: [threads.communityId], references: [communities.id] }),
}));
// Operator-only tables. No anonymous/authenticated policies expose invite hashes.
export const invitations = pgTable("invitations", {
  id: uuid().primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique(),
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer().notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, t => [check("invitations_max_uses_check", sql`${t.maxUses} between 1 and 1000`), check("invitations_check", sql`${t.uses} >= 0 and ${t.uses} <= ${t.maxUses}`)]);
export const redemptions = pgTable("invitation_redemptions", {
  invitationId: uuid("invitation_id").notNull().references(() => invitations.id),
  userId: uuid("user_id").primaryKey().references(() => authUsers.id, { onDelete: "cascade" }),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const feedFeedback = pgTable("feed_feedback", {
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.threadId] })]);
