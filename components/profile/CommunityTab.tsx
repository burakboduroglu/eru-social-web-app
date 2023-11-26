import { redirect } from "next/navigation";

import {
  getUserPosts,
  getUserComments,
  getUser,
} from "@/lib/actions/user.actions";

import ThreadCard from "../cards/ThreadCard";
import {
  fetchCommunities,
  fetchCommunityDetails,
  fetchCommunityPosts,
} from "@/lib/actions/community.actions";
import UserCard from "../cards/UserCard";

interface TabProps {
  currentUserId: string;
  communityId: string;
  profileType: string;
  tabLabel: string;
}

async function CommunityTab({
  currentUserId,
  communityId,
  profileType,
  tabLabel,
}: Readonly<TabProps>) {
  let community = await fetchCommunityDetails(communityId);
  let communityPosts = await fetchCommunityPosts(communityId);

  if (!community) {
    redirect("/");
  }

  return (
    <section className="mt-3 flex flex-col gap-3">
      {tabLabel === "Gönderiler" ? (
        communityPosts.threads.length > 0 ? (
          communityPosts.threads
            .slice(0)
            .reverse()
            .map((post: any) => (
              <ThreadCard
                key={post._id}
                id={post._id}
                currentUserId={currentUserId}
                parentId={post.parentId}
                content={post.text}
                author={
                  profileType === "User"
                    ? {
                        name: communityPosts.name,
                        username: communityPosts.username,
                        image: communityPosts.image,
                        id: communityPosts.id,
                      }
                    : {
                        name: post.author.name,
                        username: post.author.userName,
                        image: post.author.image,
                        id: post.author.id,
                      }
                }
                community={community}
                createdAt={post.createdAt}
                comments={post.children}
                path={post.path}
              />
            ))
        ) : (
          <div className="flex justify-center mt-5 text-white">
            <p>Paylaşılmış bir gönderi bulunamadı.</p>
          </div>
        )
      ) : tabLabel === "Üyeler" ? (
        <div className="flex flex-col justify-center mt-5 gap-5 text-white">
          {community.members.map((member: any) => (
            <UserCard
              key={member._id}
              id={member._id}
              name={member.name}
              username={member.username}
              imgUrl={member.image}
              personType={"user"}
            />
          ))}
        </div>
      ) : tabLabel === "İstekler" ? (
        <div className="flex justify-center mt-5 text-white">
          <p>İstek bulunamadı.</p>
        </div>
      ) : null}
    </section>
  );
}

export default CommunityTab;
