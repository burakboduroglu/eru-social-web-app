import ThreadCard from "@/components/cards/ThreadCard";
import {currentUser} from "@clerk/nextjs";
import {getUser} from "@/lib/actions/user.actions";
import { redirect } from "next/navigation";
import { getPostById } from "@/lib/actions/thread.actions";

const Page = async ({params}: { params: { id: string } }) => {
    if (!params.id) return null
    const user = await currentUser();
    if (!user) return null;

    const userInfo = await getUser(user.id);
    if(!userInfo.onboarded) redirect('/onboarding')

    const thread = await getPostById(params.id);

    return (
        <section className="relative">
            <div>
                <ThreadCard
                    key={thread._id}
                    id={thread._id}
                    currentUserId={user?.id || ""}
                    parentId={thread.parentId}
                    content={thread.text}
                    author={thread.author}
                    community={thread.community}
                    createdAt={thread.createdAt}
                    comments={thread.children}
                />
            </div>
        </section>
    )
}

export default Page;