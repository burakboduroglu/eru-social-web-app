import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";

import UserCard from "@/components/cards/UserCard";
import Searchbar from "@/components/shared/Searchbar";
import Pagination from "@/components/shared/Pagination";

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
    pageNumber: searchParams?.page ? +searchParams.page : 1,
    pageSize: 25,
  });

  return (
    <section>
      <h1 className="head-text mb-5">Topluluğu Keşfet</h1>

      <Searchbar routeType="explore" />

      <div className="mt-5 flex flex-col gap-9">
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

      <Pagination
        path="explore"
        pageNumber={searchParams?.page ? +searchParams.page : 1}
        isNext={result.isNext}
      />
    </section>
  );
}

export default Page;
