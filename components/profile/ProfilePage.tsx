import React from "react";
import Image from "next/image";
import { profileTabs } from "@/constants";
import ProfileHeader from "@/components/profile/ProfileHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ThreadsTab from "@/components/profile/ThreadsTab";
import UserPlaceholder from "public/assets/user.svg";

interface Props {
  userInfo: any;
  posts: any;
  comments: any;
  user: any;
}

export default function ProfilePage({
  userInfo,
  posts,
  comments,
  user,
}: Props) {
  return (
    <section className="flex flex-col max-w-md lg:max-w-2xl mx-auto">
      <ProfileHeader
        profileId={userInfo.id}
        authUserId={user.id}
        name={userInfo.name}
        username={userInfo.username}
        imgUrl={userInfo.image || UserPlaceholder}
        bio={userInfo.bio}
      />

      <div className="mt-5">
        <Tabs defaultValue="threads" className="w-full">
          <TabsList className="tab">
            {profileTabs.map((tab) => (
              <TabsTrigger key={tab.label} value={tab.value} className="tab">
                <Image
                  src={tab.icon}
                  alt={tab.label}
                  width={20}
                  height={20}
                  className="object-contain"
                />
                <p className="max-sm:hidden">{tab.label}</p>

                {tab.label === "Gönderiler" && (
                  <p className="ml-1 rounded-sm bg-light-4 px-2 py-1 !text-tiny-medium text-light-2">
                    {posts.threads.length}
                  </p>
                )}
                {tab.label === "Yanıtlar" && (
                  <p className="ml-1 rounded-sm bg-light-4 px-2 py-1 !text-tiny-medium text-light-2">
                    {comments.length}
                  </p>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {profileTabs.map((tab) => (
            <TabsContent
              key={`content-${tab.label}`}
              value={tab.value}
              className="w-full text-light-1"
            >
              <ThreadsTab
                currentUserId={user.id}
                profileId={userInfo.id}
                profileType="User"
                tabLabel={tab.label}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
