import UserCard from "@/components/cards/UserCard";
import { getAllUsers, getUser } from "@/lib/actions/user.actions";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function Page() {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  // Get all users
  const allUsers = await getAllUsers({
    userId: user.id,
    searchString: "",
    pageNumber: 1,
    pageSize: 25,
  });

  return (
    <section>
      <div className="flex flex-col mt-14 gap-9">
        {allUsers.users.length === 0 ? (
          <p className="no-result">Kullanıcı bulunamadı</p>
        ) : (
          <div>
            {allUsers.users.map((user) => {
              return (
                <UserCard
                  key={user.id}
                  id={user.id}
                  name={user.name}
                  username={user.username}
                  imgUrl={user.image}
                  personType="User"
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
