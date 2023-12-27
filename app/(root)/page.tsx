import ThreadCard from "@/components/cards/ThreadCard";
import { fetchAllPosts } from "@/lib/actions/thread.actions";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/actions/user.actions";
import Render from "@/components/shared/Render";

export default async function Home() {
  const posts = await fetchAllPosts(5, 0);
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  return <Render posts={posts} user={user} userInfo={userInfo} />;
}
