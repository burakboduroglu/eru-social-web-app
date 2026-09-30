import { afterAll, beforeAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const code = "valid-invitation-code-with-enough-entropy";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
    create table public.profiles(id uuid primary key references auth.users(id));
    create function public.handle_new_user() returns trigger language plpgsql as $$ begin return new; end; $$;
    create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/202609300002_invite_only.sql", import.meta.url), "utf8"));
  await db.query("insert into public.invitations(code_hash, expires_at) values ($1, now() + interval '1 day')", [hash(code)]);
}, 30000);
afterAll(() => db.close());
const signup = (invite?: string) => db.query("insert into auth.users(id,raw_user_meta_data) values (gen_random_uuid(), $1::jsonb) returning id", [JSON.stringify(invite ? { invite_code: invite } : {})]);
test("direct auth inserts without an invite are rejected atomically", async () => {
  await expect(signup()).rejects.toThrow("valid invitation");
  await expect(signup("wrong-invitation-with-enough-length")).rejects.toThrow("valid invitation");
  expect((await db.query("select * from auth.users")).rows).toHaveLength(0);
  expect((await db.query("select * from public.profiles")).rows).toHaveLength(0);
});
test("expired and revoked invitations cannot be redeemed", async () => {
  await db.query("insert into public.invitations(code_hash,expires_at) values ($1,now() - interval '1 day')", [hash("expired-invitation-with-enough-length")]);
  await expect(signup("expired-invitation-with-enough-length")).rejects.toThrow("valid invitation");
  await db.query("insert into public.invitations(code_hash,expires_at,revoked_at) values ($1,now() + interval '1 day',now())", [hash("revoked-invitation-with-enough-length")]);
  await expect(signup("revoked-invitation-with-enough-length")).rejects.toThrow("valid invitation");
});
test("valid invite creates one profile and redemption and removes plaintext metadata", async () => {
  await signup(code);
  expect((await db.query("select * from public.profiles")).rows).toHaveLength(1);
  expect((await db.query("select * from public.invitation_redemptions")).rows).toHaveLength(1);
  expect((await db.query<{ raw_user_meta_data: object }>("select raw_user_meta_data from auth.users")).rows[0].raw_user_meta_data).toEqual({});
});
test("a consumed code cannot create a second auth account", async () => {
  await expect(signup(code)).rejects.toThrow("valid invitation");
  expect((await db.query("select * from auth.users")).rows).toHaveLength(1);
});
test("multi-use codes enforce the exact limit", async () => {
  const multi = "multi-use-invitation-with-enough-length";
  await db.query("insert into public.invitations(code_hash,max_uses,expires_at) values ($1,2,now() + interval '1 day')", [hash(multi)]);
  await signup(multi); await signup(multi);
  await expect(signup(multi)).rejects.toThrow("valid invitation");
});
test("authenticated users cannot enumerate or create invitations", async () => {
  await db.exec("set role authenticated");
  await expect(db.query("select * from public.invitations")).rejects.toThrow();
  await expect(db.query("select * from public.invitation_redemptions")).rejects.toThrow();
  await expect(db.query("insert into public.invitations(code_hash,expires_at) values ('forged',now())")).rejects.toThrow();
});
