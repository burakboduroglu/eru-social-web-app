import ThreadCard from "@/components/cards/ThreadCard";
import { getPosts } from "@/lib/actions/thread.actions";
import { currentUser } from "@clerk/nextjs";
import PostThread from "@/components/forms/PostThread";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/actions/user.actions";

export default async function Home() {
  const result = await getPosts(1, 30);
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  return (
    <div className="xs:pl-3 xs:pr-3 pl-[4em] pr-[4em]">
      <div className="border-b border-gray-600">
        <PostThread userId={userInfo._id} userName={user.firstName ?? ""} />
      </div>
      <section className="mt-3 flex flex-col gap-10">
        {result.posts.length === 0 ? (
          <p className="no-result">Hiç gönderi bulunamadı.</p>
        ) : (
          <div>
            {result.posts
              .slice(0)
              .reverse()
              .map((post) => (
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
                />
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
