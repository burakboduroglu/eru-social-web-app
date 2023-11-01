import { currentUser } from "@clerk/nextjs";

import AccountProfile from "@/components/forms/AccountProfile";
import Footer from "@/components/shared/Footer";

async function Page() {
  const user = await currentUser(); // get the current user from Clerk

  const userInfo = {}; // get the user info from your database (not entegrated yet)

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
      <main className="mx-auto flex max-w-4xl flex-col justify-start px-10 py-[35px] mb-5">
        <h1 className="head-text">Bilgilerini Tamamla</h1>
        <p className="mt-3 text-base-regular text-light-2">
          Profil bilgilerini güncelle.
        </p>
        <section className="mt-9 bg-dark-2 p-10">
          <AccountProfile user={userData} />
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default Page;
