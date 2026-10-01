import { eq } from "drizzle-orm";
import { accountPreferences } from "./db/schema";
import type { Transaction } from "./db/client";
import type { Preferences } from "../shared/types";
import { defaultPreferences } from "../shared/preferences";
import { enumValue } from "./content-validation";
import { HttpError } from "./validation";
export async function readPreferences(tx: Transaction, userId: string): Promise<Preferences> {
  const [row] = await tx.select({ reducedMotion: accountPreferences.reducedMotion, defaultFeed: accountPreferences.defaultFeed, notificationKind: accountPreferences.notificationKind }).from(accountPreferences).where(eq(accountPreferences.ownerId, userId));
  return row || { ...defaultPreferences };
}
export async function savePreferences(tx: Transaction, userId: string, body: Record<string, unknown>): Promise<Preferences> {
  if (typeof body.reducedMotion !== "boolean") throw new HttpError(400, "Hareket tercihi geçersiz.");
  const values: Preferences = { reducedMotion: body.reducedMotion, defaultFeed: enumValue(body.defaultFeed, ["all", "latest", "following", "communities"]), notificationKind: enumValue(body.notificationKind, ["all", "reply", "like", "follow"]) };
  await tx.insert(accountPreferences).values({ ownerId: userId, ...values }).onConflictDoUpdate({ target: accountPreferences.ownerId, set: values });
  return values;
}
