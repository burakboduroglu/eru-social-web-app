import ThreadCard from "@/components/cards/ThreadCard";
import PostThread from "@/components/forms/PostThread";
import UpdateButton from "@/components/buttons/UpdateButton";

interface Props {
  posts: any;
  user: any;
  userInfo: any;
}

export default function Render({ posts, user, userInfo }: Props) {
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
            {posts.map((post: any) => (
              <ThreadCard
                key={post._id}
                id={post._id}
                curruntUserInfo={userInfo._id.toString()}
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
