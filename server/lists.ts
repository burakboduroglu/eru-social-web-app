import { and, desc, eq, sql } from "drizzle-orm";
import { accountLists, accountListMembers, profiles } from "./db/schema";
import type { Transaction } from "./db/client";
import type { AccountList, AccountListsPage, ProfileListPage } from "../shared/types";
import { decodeCursor, encodeCursor } from "./cursor";
import { HttpError, text } from "./validation";
import { profile } from "./repository";

const listFields = {
  id: accountLists.id, ownerId: accountLists.ownerId, name: accountLists.name, description: accountLists.description,
  createdAt: sql<string>`to_char(${accountLists.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  updatedAt: sql<string>`to_char(${accountLists.updatedAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  memberCount: sql<number>`(select count(*)::int from account_list_members m where m.list_id=${accountLists.id})`,
};
export async function accountList(tx: Transaction, userId: string, id: string): Promise<AccountList> {
  const [list] = await tx.select(listFields).from(accountLists).where(and(eq(accountLists.id, id), eq(accountLists.ownerId, userId)));
  if (!list) throw new HttpError(404, "Liste bulunamadı.");
  return list;
}
export async function listAccountLists(tx: Transaction, userId: string, value: string | null): Promise<AccountListsPage> {
  const cursor = decodeCursor(value);
  const rows = await tx.select(listFields).from(accountLists).where(and(eq(accountLists.ownerId, userId), cursor
    ? sql`(${accountLists.createdAt}, ${accountLists.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)` : undefined
  )).orderBy(desc(accountLists.createdAt), desc(accountLists.id)).limit(21);
  const lists = rows.slice(0, 20), last = lists.at(-1);
  return { lists, nextCursor: rows.length > 20 && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
}
export async function saveAccountList(tx: Transaction, userId: string, body: Record<string, unknown>, id?: string): Promise<AccountList> {
  if (id) await accountList(tx, userId, id);
  const values = { name: text(body.name, 1, 80), description: text(body.description ?? "", 0, 350) };
  const [row] = id
    ? await tx.update(accountLists).set(values).where(and(eq(accountLists.id, id), eq(accountLists.ownerId, userId))).returning({ id: accountLists.id })
    : await tx.insert(accountLists).values({ ...values, ownerId: userId }).returning({ id: accountLists.id });
  if (!row) throw new HttpError(404, "Liste bulunamadı.");
  return accountList(tx, userId, row.id);
}
export async function deleteAccountList(tx: Transaction, userId: string, id: string) {
  const deleted = await tx.delete(accountLists).where(and(eq(accountLists.id, id), eq(accountLists.ownerId, userId))).returning({ id: accountLists.id });
  if (!deleted.length) throw new HttpError(404, "Liste bulunamadı.");
  return { success: true };
}
export async function listAccountMembers(tx: Transaction, userId: string, id: string, value: string | null): Promise<ProfileListPage> {
  await accountList(tx, userId, id);
  const cursor = decodeCursor(value);
  const rows = await tx.select({
    profile: profiles, id: accountListMembers.profileId,
    createdAt: sql<string>`to_char(${accountListMembers.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  }).from(accountListMembers).innerJoin(profiles, eq(profiles.id, accountListMembers.profileId)).where(and(eq(accountListMembers.listId, id), cursor
    ? sql`(${accountListMembers.createdAt}, ${accountListMembers.profileId}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)` : undefined
  )).orderBy(desc(accountListMembers.createdAt), desc(accountListMembers.profileId)).limit(21);
  const items = rows.slice(0, 20), last = items.at(-1);
  return { profiles: items.map(row => row.profile), nextCursor: rows.length > 20 && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
}
export async function setAccountMember(tx: Transaction, userId: string, id: string, targetId: string, member: boolean) {
  await accountList(tx, userId, id);
  if (member) {
    if (!(await profile(tx, targetId)).onboarded) throw new HttpError(404, "Profil bulunamadı.");
    await tx.insert(accountListMembers).values({ listId: id, profileId: targetId }).onConflictDoNothing();
  } else {
    await tx.delete(accountListMembers).where(and(eq(accountListMembers.listId, id), eq(accountListMembers.profileId, targetId)));
  }
  return { member, memberCount: (await accountList(tx, userId, id)).memberCount };
}
