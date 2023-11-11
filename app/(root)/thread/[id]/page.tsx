import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";

import Comment from "@/components/forms/Comment";
import ThreadCard from "@/components/cards/ThreadCard";

import { getUser } from "@/lib/actions/user.actions";
import { getPostById } from "@/lib/actions/thread.actions";

export const revalidate = 0;

async function page({ params }: { params: { id: string } }) {
    if (!params.id) return null;

    const user = await currentUser();
    if (!user) return null;

    const userInfo = await getUser(user.id);
    if (!userInfo?.onboarded) redirect("/onboarding");

    const thread = await getPostById(params.id);

    return (
        <section className='relative'>
            <div>
                <ThreadCard
                    id={thread._id}
                    currentUserId={user.id}
                    parentId={thread.parentId}
                    content={thread.text}
                    author={thread.author}
                    community={thread.community}
                    createdAt={thread.createdAt}
                    comments={thread.children}
                />
            </div>

            <div>
                <Comment
                    threadId={params.id}
                    userImg={userInfo.image}
                    userId={JSON.stringify(userInfo._id)}
                />
            </div>

            <div className='mt-10 px-10'>
                {thread.children.map((childItem: any) => (
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
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}

export default page;