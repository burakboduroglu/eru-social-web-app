import {currentUser} from "@clerk/nextjs";
import {getUser} from "@/lib/actions/user.actions";
import {redirect} from "next/navigation";
import ThreadShareCard from "@/components/cards/ThreadShareCard";


export default async function Page({params}: Readonly<{ params: { id: string } }>) {
    if (!params.id) return null
    const user = await currentUser();
    if (!user) return null;

    const userInfo = await getUser(user.id);
    if(!userInfo.onboarded) redirect('/onboarding')

    return (
        <div>
           <ThreadShareCard postId={params.id}/>
        </div>
    )
}
