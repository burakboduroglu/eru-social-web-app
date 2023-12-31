import { UserProfile, currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/actions/user.actions";
import AccountProfile from "@/components/forms/AccountProfile";
import UserPlaceholder from "public/assets/user.svg";

// Copy paste most of the code as it is from the /onboarding

async function Page() {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const userData = {
    id: user.id,
    objectId: userInfo?._id,
    username: userInfo ? userInfo?.username : user.username,
    name: userInfo ? userInfo?.name : user.firstName ?? "",
    bio: userInfo ? userInfo?.bio : "",
    image: userInfo?.image || UserPlaceholder,
  };

  return (
    <>
      <h1 className="head-text">Profilini güncelle</h1>
      <section className="mt-8">
        <AccountProfile user={userData} />
      </section>
    </>
  );
}

export default Page;
