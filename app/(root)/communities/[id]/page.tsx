import { currentUser } from "@clerk/nextjs";

import {
  fetchCommunityDetails,
  fetchCommunityPosts,
} from "@/lib/actions/community.actions";
import CommunityHeader from "@/components/profile/CommunityHeader";
import Image from "next/image";

import { communityTabs, profileTabs } from "@/constants";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CommunityTab from "@/components/profile/CommunityTab";

async function Page({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return null;

  const communityDetails = await fetchCommunityDetails(params.id);
  const communityPosts = await fetchCommunityPosts(communityDetails.id);
  return (
    <div className="flex flex-col max-w-md lg:max-w-2xl mx-auto">
      <CommunityHeader
        communityId={communityDetails.id}
        authUserId={user.id}
        name={communityDetails.name}
        username={communityDetails.username}
        imgUrl={communityDetails.image}
        bio={communityDetails.bio}
        type={"Community"}
        admin={communityDetails.createdBy.id}
      />
      <div className="mt-5">
        <Tabs defaultValue="threads" className="w-full">
          <TabsList className="tab">
            {communityTabs.map((tab) => (
              <TabsTrigger key={tab.label} value={tab.value} className="tab">
                <Image
                  src={tab.icon}
                  alt={tab.label}
                  width={20}
                  height={20}
                  className="object-contain"
                />
                <p className="max-sm:hidden">{tab.label}</p>

                {tab.label === "Üyeler" && (
                  <p className="ml-1 mr-2 rounded-sm bg-light-4 px-2 py-1 !text-tiny-medium text-light-2">
                    {communityDetails.members.length}
                  </p>
                )}
                {tab.label === "Gönderiler" && (
                  <p className="ml-1 mr-1 rounded-sm bg-light-4 px-2 py-1 !text-tiny-medium text-light-2">
                    {communityPosts.threads.length}
                  </p>
                )}
                {tab.label === "İstekler" && (
                  <p className="ml-1 mr-1 rounded-sm bg-light-4 px-2 py-1 !text-tiny-medium text-light-2">
                    {0}
                  </p>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {communityTabs.map((tab) => (
            <TabsContent
              key={`content-${tab.label}`}
              value={tab.value}
              className="w-full text-light-1"
            >
              <CommunityTab
                currentUserId={user.id}
                communityId={communityDetails.id}
                profileType="community"
                tabLabel={tab.label}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

export default Page;
