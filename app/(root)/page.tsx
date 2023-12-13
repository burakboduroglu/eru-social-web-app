import ThreadCard from "@/components/cards/ThreadCard";
import { getPosts } from "@/lib/actions/thread.actions";
import { currentUser } from "@clerk/nextjs";
import PostThread from "@/components/forms/PostThread";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/actions/user.actions";
import UpdateButton from "@/components/buttons/UpdateButton";

export default async function Home() {
  const posts = await getPosts();
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  let i = 0;
  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");
  const reversedPosts = posts.reverse();
  return (
    <div className="flex flex-col max-w-md lg:max-w-xl mx-auto">
      <div className="-mt-3 ">
        <PostThread
          userId={userInfo._id.toString()}
          userName={user.firstName ?? ""}
        />
      </div>
      <UpdateButton />
      <section className="flex flex-col gap-10">
        {posts.length === 0 ? (
          <p className="no-result">Hiç gönderi bulunamadı.</p>
        ) : (
          <div>
            {reversedPosts.map((post) => (
              <ThreadCard
                key={post._id}
                id={post._id}
                currentUserId={user?.id || ""}
                parentId={post.parentId}
                content={post.text}
                author={post.author}
                community={post.community}
                createdAt={post.createdAt}
                comments={post.children}
                postLike={post.likes}
                path="/"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
