import Link from "next/link";
import Image from "next/image";
import { capitalize } from "@/lib/utils";

interface CardProps {
  id: string;
  currentUserId: string;
  parentId: string | null;
  content: string;
  author: {
    name: string;
    username: string;
    image: string;
    id: string;
  };
  community: {
    id: string;
    name: string;
    image: string;
  } | null;
  createdAt: string;
  comments: {
    author: {
      image: string;
    };
  }[];
  isComment?: boolean;
  path: string;
}

const ThreadCard = ({
  id,
  currentUserId,
  parentId,
  content,
  author,
  community,
  createdAt,
  comments,
  isComment,
  path,
}: CardProps) => {
  const username = author.username;
  return (
    <article
      className={`flex w-full flex-col rounded-xl mt-3 ${
        isComment ? "px-0 xs:px-7" : "bg-dark-2 p-7"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex w-full flex-1 flex-row gap-4">
          <div className="flex flex-col items-center">
            <Link href={`/profile/${author.id}`} className="relative h-11 w-11">
              <Image
                src={author.image}
                alt="Profil Resmi"
                fill
                className="cursor-pointer rounded-full"
              />
            </Link>
            <div className="thread-card_bar" />
          </div>
          <div>
            <div>
              <Link
                href={`/profile/${author.id}`}
                className="flex items-center"
              >
                <p className="cursor-pointer text-base-semibold text-amber-100">
                  {capitalize(author.name)}
                </p>
                <span className="pl-2 text-gray-400 text-[0.70em] max-xs:text-[12px]">
                  @{username}
                </span>
              </Link>
            </div>
            <Link href={`/thread/${id}`}>
              <p className="mt-3 text-small-regular text-light-2">
                {path === "/" && content.length > 150 ? (
                  <>
                    {content.substring(0, content.indexOf(" ", 125))}
                    <span className="text-blue pl-1">
                      ...devamını görüntüleyin.
                    </span>
                  </>
                ) : (
                  content
                )}
              </p>
            </Link>
            <div className="mt-5 flex flex-col">
              <div className="flex items-center gap-2">
                <Image
                  src="/assets/heart-gray.svg"
                  alt="begen"
                  width={22}
                  height={22}
                  className="cursor-pointer object-contain"
                />
                <Link href={`/thread/${id}`}>
                  <Image
                    src="/assets/reply.svg"
                    alt="yorum"
                    width={22}
                    height={22}
                    className="cursor-pointer object-contain"
                  />
                </Link>
                <Link href={`/thread/share/${id}`}>
                  <Image
                    src="/assets/share.svg"
                    alt="paylas"
                    width={22}
                    height={22}
                    className="cursor-pointer object-contain"
                  />
                </Link>
              </div>
              {comments.length > 0 && (
                <Link href={`/thread/${id}`}>
                  <p className="mt-1 text-subtle-medium text-gray-1">
                    {comments.length} yorum
                  </p>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ThreadCard;
