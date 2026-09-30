import { randomBytes, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "../server/db/client";
const days = Number(process.argv[2] || 7);
const uses = Number(process.argv[3] || 1);
if (!Number.isInteger(days) || days < 1 || days > 365 || !Number.isInteger(uses) || uses < 1 || uses > 1000) {
  console.error("Usage: bun run db:invite [days:1-365] [uses:1-1000]"); process.exit(1);
}
const code = randomBytes(24).toString("base64url");
const hash = createHash("sha256").update(code).digest("hex");
try {
  await getDatabase().execute(sql`insert into public.invitations(code_hash, max_uses, expires_at) values (${hash}, ${uses}, now() + ${days} * interval '1 day')`);
  console.log(`Invitation code (shown once): ${code}`);
  process.exit(0);
} catch { console.error("Could not create invitation. Check database configuration and migrations."); process.exit(1); }
