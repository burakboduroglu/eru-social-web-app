import { UserProfile, currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/actions/user.actions";
import CommunityBioUpdate from "@/components/forms/CommunityBioUpdate";
import { fetchCommunityDetails } from "@/lib/actions/community.actions";

// Copy paste most of the code as it is from the /onboarding

async function Page() {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const community = await fetchCommunityDetails(
    "org_2YfCMjc9EHoPvsQwY27vkst1nyG"
  );
  const communityData = {
    id: community?.id,
    objectId: community?._id,
    bio: community?.bio ? community?.bio : "",
  };

  return (
    <>
      <h1 className="head-text">Topluluğu güncelle</h1>
      <section className="mt-8">
        <CommunityBioUpdate community={communityData} />
      </section>
    </>
  );
}

export default Page;
