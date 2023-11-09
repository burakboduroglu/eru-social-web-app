import { getUser } from "@/lib/actions/user.actions";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import PostThread from "@/components/forms/PostThread";

async function Page() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  return (
      <div>
        <h1 className="head-text">Gönderi Oluştur</h1>
        <PostThread userId={userInfo._id}/>
      </div>
  )
}

export default Page;
