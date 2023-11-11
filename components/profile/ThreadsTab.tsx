import {redirect} from "next/navigation";

import {getUserPosts} from "@/lib/actions/user.actions";

import ThreadCard from "../cards/ThreadCard";

interface TabProps {
    currentUserId: string;
    profileId: string;
    profileType: string;
}

async function ThreadsTab({currentUserId, profileId, profileType}: Readonly<TabProps>) {
    let result = await getUserPosts(profileId);

    if (!result) {
        redirect("/");
    }

    return (
        <section className='mt-3 flex flex-col gap-3'>
            {result.threads.slice(0)
                .reverse().map((post: any) => (
                    <ThreadCard
                        key={post._id}
                        id={post._id}
                        currentUserId={currentUserId}
                        parentId={post.parentId}
                        content={post.text}
                        author={
                            profileType === "User"
                                ? {name: result.name, username: result.username, image: result.image, id: result.id}
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
                    />
                ))}
        </section>
    );
}

export default ThreadsTab;