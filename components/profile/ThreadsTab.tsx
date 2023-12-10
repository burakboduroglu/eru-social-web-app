import { redirect } from "next/navigation";
import {
  getUserPosts,
  getUserComments,
  getUser,
} from "@/lib/actions/user.actions";
import ThreadCard from "../cards/ThreadCard";

interface TabProps {
  currentUserId: string;
  profileId: string;
  profileType: string;
  tabLabel: string;
  postLike?: Number | null;
}

async function ThreadsTab({
  currentUserId,
  profileId,
  profileType,
  tabLabel,
  postLike,
}: Readonly<TabProps>) {
  let user = await getUser(profileId);
  let posts = await getUserPosts(profileId);
  let comments = await getUserComments(user);

  if (!posts) {
    redirect("/");
  }

  return (
    <section className="mt-3 flex flex-col gap-3">
      {tabLabel === "Gönderiler" ? (
        posts.threads.length > 0 ? (
          posts.threads
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
                        name: posts.name,
                        username: posts.username,
                        image: posts.image,
                        id: posts.id,
                      }
                    : {
                        name: post.author.name,
                        username: post.author.userName,
                        image: post.author.image,
                        id: post.author.id,
                      }
                }
                community={post.community} // TODO UPDATE COMMUNITY
                createdAt={post.createdAt}
                comments={post.children}
                path={post.path}
                postLike={post.likes}
              />
            ))
        ) : (
          <div className="flex justify-center mt-5 text-white">
            <p>Paylaşılmış bir gönderi bulunamadı.</p>
          </div>
        )
      ) : comments.length > 0 ? (
        comments
          .slice(0)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
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
                      name: posts.name,
                      username: posts.username,
                      image: posts.image,
                      id: posts.id,
                    }
                  : {
                      name: post.author.name,
                      username: post.author.userName,
                      image: post.author.image,
                      id: post.author.id,
                    }
              }
              community={post.community} // TODO UPDATE COMMUNITY
              createdAt={post.createdAt}
              comments={post.children}
              path={post.path}
            />
          ))
      ) : (
        <div className="flex justify-center mt-5 text-white">
          <p>Yanıtlanmış bir gönderi bulunamadı</p>
        </div>
      )}
    </section>
  );
}

export default ThreadsTab;
