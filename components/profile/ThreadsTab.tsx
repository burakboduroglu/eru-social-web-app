import {redirect} from "next/navigation";

import {getUserPosts, getUserChildren, getUser} from "@/lib/actions/user.actions";


import ThreadCard from "../cards/ThreadCard";

interface TabProps {
    currentUserId: string;
    profileId: string;
    profileType: string;
    tabLabel: string
}

async function ThreadsTab({currentUserId, profileId, profileType, tabLabel}: Readonly<TabProps>) {
    let user = await getUser(profileId)
    let posts = await getUserPosts(profileId);
    let comments = await getUserChildren(user);


    if (!posts) {
        redirect("/");
    }

    return (
        <section className='mt-3 flex flex-col gap-3'>
            {tabLabel==="Gönderiler"?(
                posts.threads.slice(0)
                    .reverse().map((post: any) => (
                    <ThreadCard
                        key={post._id}
                        id={post._id}
                        currentUserId={currentUserId}
                        parentId={post.parentId}
                        content={post.text}
                        author={
                            profileType === "User"
                                ? {name: posts.name, username: posts.username, image: posts.image, id: posts.id}
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
                ))
            ):(
                comments.slice(0)
                    .reverse().map((post: any) => (
                    <ThreadCard
                        key={post._id}
                        id={post._id}
                        currentUserId={currentUserId}
                        parentId={post.parentId}
                        content={post.text}
                        author={
                            profileType === "User"
                                ? {name: posts.name, username: posts.username, image: posts.image, id: posts.id}
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
                ))
            )}
        </section>
    );
}

export default ThreadsTab;