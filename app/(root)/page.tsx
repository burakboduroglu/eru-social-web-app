import ThreadCard from "@/components/cards/ThreadCard";
import { getPosts } from "@/lib/actions/thread.actions";
import { currentUser } from "@clerk/nextjs";

export default async function Home() {
    const result = await getPosts(1, 30);
    const user = await currentUser();

    return (
        <div className="xs:ml-2">
            <h1 className="head-text text-left">Ana Sayfa</h1>
            <section className="mt-3 flex flex-col gap-10">
                {result.posts.length === 0 ? (
                    <p className="no-result">Hiç gönderi bulunamadı.</p>
                ):(
                    <div>
                        {result.posts.slice(0).reverse().map((post) => (
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
