import { getActivity, getUser } from "@/lib/actions/user.actions";
import { currentUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function Page() {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  // Get Activity
  const activty = await getActivity(userInfo._id);

  return (
    <section>
      <h1 className="head-text mt-3">Bildirimler</h1>

      {activty.length > 0 ? (
        <>
          {activty.map((item) => (
            <section className="flex flex-col mt-5 gap-5">
              <Link key={item._id} href={`/thread/${item.parentId}`}>
                <article className="activity-card">
                  <Image
                    src={item.author.image}
                    alt="profile photo"
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                  <p className="ml-1 pt-[3px] !text-small-regular text-light-2">
                    <span className="mr-2 text-primary-500">
                      {item.author.name}
                    </span>
                    gönderine yorum yaptı.
                  </p>
                  <p className="pt-[5px] xs:pl-10 md:pl-72 text-small-regular text-light-2">
                    {item.createdAt
                      .toLocaleString([], { hour12: false })
                      .replace(/:\d{2}$/, "")}
                  </p>
                </article>
              </Link>
            </section>
          ))}
        </>
      ) : (
        <p className="text-base-regular text-light-3">
          Herhangi bir bildirim bulunamadı.
        </p>
      )}
    </section>
  );
}
