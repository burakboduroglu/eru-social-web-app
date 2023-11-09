import {currentUser} from "@clerk/nextjs";
import {getUser} from "@/lib/actions/user.actions";
import {redirect} from "next/navigation";
import {getPostById} from "@/lib/actions/thread.actions";
import ThreadShareCard from "@/components/cards/ThreadShareCard";


export default async function Page({params}: { params: { id: string } }) {
    if (!params.id) return null
    const user = await currentUser();
    if (!user) return null;

    const userInfo = await getUser(user.id);
    if(!userInfo.onboarded) redirect('/onboarding')

    const thread = await getPostById(params.id);

    return (
        <div>
           <ThreadShareCard postId={params.id}/>
        </div>
    )
}
