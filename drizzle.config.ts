import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./supabase/drizzle",
  dbCredentials: { url: process.env.DATABASE_URL || "" },
  schemaFilter: ["public"],
  strict: true,
});
