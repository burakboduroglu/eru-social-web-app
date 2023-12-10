import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";

import UserCard from "@/components/cards/UserCard";
import Searchbar from "@/components/shared/Searchbar";

import { getUser, getAllUsers } from "@/lib/actions/user.actions";
import UserPlaceholder from "public/assets/user.svg";

async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const result = await getAllUsers({
    userId: user.id,
    searchString: searchParams.q,
  });

  return (
    <section>
      <h1 className="head-text mb-5">Keşfet</h1>

      <Searchbar routeType="explore" />

      <div className="mt-8 flex flex-col gap-8">
        {result.users.length === 0 ? (
          <p className="no-result">Sonuç yok</p>
        ) : (
          <>
            {result.users.map((person) => (
              <UserCard
                key={person.id}
                id={person.id}
                name={person.name}
                username={person.username}
                imgUrl={person.image || UserPlaceholder}
                personType="User"
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

export default Page;
