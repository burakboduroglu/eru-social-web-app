import { getActivity, getUser } from "@/lib/actions/user.actions";
import { currentUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import UserPlaceholder from "public/assets/user.svg";

export default async function Page() {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await getUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  // Get Activity
  const activty = await getActivity(userInfo._id);

  return (
    <section>
      <h1 className="head-text">Bildirimler</h1>

      {activty.length > 0 ? (
        <>
          {activty
            .slice(0)
            .reverse()
            .map((item) => (
              <section
                className="flex flex-col mt-5 text-[12px]"
                key={item._id}
              >
                <Link href={`/thread/${item.parentId}`}>
                  <article className="activity-card flex justify-between">
                    <div className="flex">
                      <Image
                        src={
                          item.author.image === ""
                            ? UserPlaceholder
                            : item.author.image
                        }
                        alt="profile photo"
                        width={24}
                        height={24}
                        className="rounded-full mr-1 border border-gray-1 p-0.5 relative w-8 h-8"
                      />
                      <div className="inline-flex w-full text-light-2 mt-2 pl-3">
                        <span className="mr-2 text-primary-500">
                          {item.author.name}
                        </span>
                        <p>gönderine yorum yaptı.</p>
                        <span className="pl-20">
                          {item.createdAt.toLocaleString("tr-TR", {
                            hour12: false,
                          })}
                        </span>
                      </div>
                    </div>
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
