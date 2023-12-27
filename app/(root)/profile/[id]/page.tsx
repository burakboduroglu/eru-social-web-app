import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import {
  getUser,
  getUserComments,
  getUserPosts,
} from "@/lib/actions/user.actions";
import ProfilePage from "@/components/profile/ProfilePage";

async function Page({
  params,
}: Readonly<{
  params: {
    id: string;
  };
}>) {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await getUser(params.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const posts = await getUserPosts(params.id);
  const comments = await getUserComments(userInfo._id);

  return (
    <ProfilePage
      userInfo={userInfo}
      posts={posts}
      comments={comments}
      user={user}
    />
  );
}

export default Page;
