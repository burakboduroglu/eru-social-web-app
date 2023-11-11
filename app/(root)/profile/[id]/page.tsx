import Image from "next/image";
import {currentUser} from "@clerk/nextjs";
import {redirect} from "next/navigation";

import {profileTabs} from "@/constants";

import ProfileHeader from "@/components/profile/ProfileHeader";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";

import {getUser} from "@/lib/actions/user.actions";
import ThreadsTab from "@/components/profile/ThreadsTab";

async function Page({params}: Readonly<{
    params: {
        id: string
    }
}>) {
    const user = await currentUser();
    if (!user) return null;

    const userInfo = await getUser(params.id);
    if (!userInfo?.onboarded) redirect("/onboarding");

    return (
        <section>
            <ProfileHeader
                profileId={userInfo.id}
                authUserId={user.id}
                name={userInfo.name}
                username={userInfo.username}
                imgUrl={userInfo.image}
                bio={userInfo.bio}
            />

            <div className='mt-5'>
                <Tabs defaultValue='threads' className='w-full'>
                    <TabsList className='tab'>
                        {profileTabs.map((tab) => (
                            <TabsTrigger key={tab.label} value={tab.value} className='tab'>
                                <Image
                                    src={tab.icon}
                                    alt={tab.label}
                                    width={20}
                                    height={20}
                                    className='object-contain'
                                />
                                <p className='max-sm:hidden'>{tab.label}</p>

                                {tab.label === "Gönderiler" && (
                                    <p className='ml-1 rounded-sm bg-light-4 px-2 py-1 !text-tiny-medium text-light-2'>
                                        {userInfo.threads.length}
                                    </p>
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {profileTabs.map((tab) => (
                        <TabsContent
                            key={`content-${tab.label}`}
                            value={tab.value}
                            className='w-full text-light-1'
                        >
                            <ThreadsTab
                                currentUserId={user.id}
                                profileId={userInfo.id}
                                profileType='User'
                            />
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </section>
    );
}

export default Page;