import { eq } from "drizzle-orm";
import { withUser, getDatabase } from "../server/db/client";
import { profiles } from "../server/db/schema";
import { listCommunities, listPosts, profile } from "../server/repository";

type Measurement = { totalMs: number; profileMs: number; postsMs: number; communitiesMs: number };
const elapsed = async <T>(operation: () => Promise<T>): Promise<[T, number]> => {
  const start = performance.now();
  const value = await operation();
  return [value, performance.now() - start];
};

try {
  // The privileged lookup selects only an existing profile ID. All benchmark
  // reads below run with that user's RLS context and perform no writes.
  const [candidate] = await getDatabase()
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.onboarded, true))
    .limit(1);
  if (!candidate) {
    console.log("No onboarded profile is available for the read-only benchmark.");
    process.exit(0);
  }

  const sample = async () => {
    const start = performance.now();
    const readings = await withUser(candidate.id, async tx => {
      const [, profileMs] = await elapsed(() => profile(tx, candidate.id));
      const [, postsMs] = await elapsed(() => listPosts(tx, candidate.id));
      const [, communitiesMs] = await elapsed(() => listCommunities(tx, candidate.id));
      return { profileMs, postsMs, communitiesMs };
    });
    return { ...readings, totalMs: performance.now() - start };
  };

  const cold = await sample();
  const warm: Measurement[] = [];
  for (let i = 0; i < 5; i++) warm.push(await sample());

  const average = (key: keyof Measurement) =>
    Number((warm.reduce((total, item) => total + item[key], 0) / warm.length).toFixed(1));
  console.log(JSON.stringify({
    unit: "ms",
    cold,
    warmAverage: {
      total: average("totalMs"),
      profile: average("profileMs"),
      posts: average("postsMs"),
      communities: average("communitiesMs"),
    },
    warmSamples: warm.length,
  }, null, 2));
  process.exit(0);
} catch {
  // Keep connection details, SQL, and driver parameters out of output.
  console.error("API benchmark failed. Check the social-web database configuration and migrations.");
  process.exit(1);
}
