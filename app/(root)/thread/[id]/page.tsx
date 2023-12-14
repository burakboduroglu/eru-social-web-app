import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";

import Comment from "@/components/forms/Comment";
import ThreadCard from "@/components/cards/ThreadCard";

import { getUser } from "@/lib/actions/user.actions";
import { fetchPostById } from "@/lib/actions/thread.actions";

export const revalidate = 0;

async function page({ params }: { params: { id: string } }) {
  if (!params.id) return null;

  const user = await currentUser();
  if (!user) return null;

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const post = await fetchPostById(params.id);

  return (
    <section className="relative overflow-hidden">
      <div>
        <ThreadCard
          id={post._id}
          currentUserId={user.id}
          parentId={post.parentId}
          content={post.text}
          author={post.author}
          community={post.community}
          createdAt={post.createdAt}
          comments={post.children}
          postLike={post.likes}
          path={`/thread`}
          curruntUserInfo={userInfo._id.toString()}
        />
      </div>

      <div>
        <Comment
          threadId={params.id}
          userImg={userInfo.image}
          userId={JSON.stringify(userInfo._id)}
        />
      </div>
      <div className="mt-10 px-10 xs:px-3 overflow-hidden wrap">
        {post.children.map((childItem: any) => (
          <div className="mt-6">
            <ThreadCard
              key={childItem._id}
              id={childItem._id}
              currentUserId={user.id}
              parentId={childItem.parentId}
              content={childItem.text}
              author={childItem.author}
              community={childItem.community}
              createdAt={childItem.createdAt}
              comments={childItem.children}
              isComment
              curruntUserInfo={userInfo._id.toString()}
              path={`/thread`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default page;
