import { currentUser } from "@clerk/nextjs";

import AccountProfile from "@/components/forms/AccountProfile";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/actions/user.actions";

async function Page() {
  const user = await currentUser(); // get the current user from Clerk
  if (!user) return null; // to avoid typescript warnings

  const userInfo = await getUser(user.id);
  if (userInfo?.onboarded) redirect("/");

  // userInfo fetch from database
  // user fetch from clerk
  const userData = {
    id: user?.id || "",
    objectId: userInfo?._id,
    username: userInfo?.username || user?.username,
    name: userInfo?.name || user?.firstName,
    bio: userInfo?.bio || "",
    image: userInfo?.image || user?.imageUrl,
  };

  return (
    <div>
      <main className="mx-auto flex max-w-4xl flex-col justify-start px-10 py-[35px]">
        <h1 className="head-text">Bilgilerini Tamamla</h1>
        <p className="mt-3 text-base-regular text-light-2">
          Profil bilgilerini güncelle.
        </p>
        <section className="mt-9 bg-dark-2 p-10">
          <AccountProfile user={userData} />
        </section>
      </main>
      <div className="bottom-0 w-full h-10 bg-gray-800 text-white flex justify-center items-center font-sans text-[12px]">
        <p>© 2023 Burak Boduroglu </p>
      </div>
    </div>
  );
}

export default Page;
