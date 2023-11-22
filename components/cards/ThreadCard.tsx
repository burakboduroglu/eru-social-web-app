import Link from "next/link";
import Image from "next/image";
import { formatDateString } from "@/lib/utils";
import UserPlaceholder from "public/assets/user.svg";
import DeleteThread from "../forms/DeleteThread";
import { ToastContainer, toast } from "react-toastify";

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
  return (
    <article
      className={`flex w-full flex-col rounded-xl mt-3 ${
        isComment ? "px-0 xs:px-7" : "bg-dark-2 p-7"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex w-full flex-1 flex-row gap-4">
          <div className="flex flex-col items-center">
            <Link
              href={`/profile/${author?.id}`}
              className="relative h-11 w-11"
            >
              <Image
                src={author?.image || UserPlaceholder}
                alt="Profil Resmi"
                fill
                className="cursor-pointer rounded-full border border-gray-1 p-1 bg-black"
              />
            </Link>
            <div className="thread-card_bar" />
          </div>
          <div>
            <Link
              href={`/profile/${author?.id}`}
              className="flex-col items-start"
            >
              <p className="cursor-pointer text-amber-100 xs:text-[0.95em] leading-tight">
                {author?.name}
              </p>
              <span className="text-gray-400 xs:text-[0.75em] leading-tight">
                {isComment ? `@${author?.username}` : ""}
              </span>
            </Link>
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
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex gap-3.5">
                <Image
                  src="/assets/heart-gray.svg"
                  alt="begen"
                  width={24}
                  height={24}
                  className="cursor-pointer object-contain"
                />
                <Link href={`/thread/${id}`}>
                  <Image
                    src="/assets/reply.svg"
                    alt="yorum"
                    width={24}
                    height={24}
                    className="cursor-pointer object-contain"
                  />
                </Link>
                <Link href={`/thread/share/${id}`}>
                  <Image
                    src="/assets/share.svg"
                    alt="paylas"
                    width={24}
                    height={24}
                    className="cursor-pointer object-contain"
                  />
                </Link>
              </div>
              <p className="text-subtle-medium text-gray-1 mt-3">
                {formatDateString(createdAt)}
              </p>
              {comments.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  {comments.slice(0, 2).map((comment, index) => (
                    <Image
                      key={index}
                      src={comment.author?.image || UserPlaceholder}
                      alt={`user_${index}`}
                      width={22}
                      height={22}
                      className={`${
                        index !== 0 && "-ml-5"
                      } rounded-full object-cover border border-gray-1 p-0.5 relative w-5 h-5 bg-black`}
                    />
                  ))}
                  <Link href={`/thread/${id}`}>
                    <p className="mt-1 text-subtle-medium text-gray-1">
                      {comments.length} yorum
                    </p>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Thread */}
        <DeleteThread
          threadId={JSON.stringify(id)}
          currentUserId={currentUserId}
          authorId={author.id}
          parentId={parentId}
          isComment={isComment}
        />

        {!isComment && community && (
          <Link
            href={`/communities/${community.id}`}
            className="mt-5 flex items-center"
          >
            <p className="text-subtle-medium text-gray-1">
              {formatDateString(createdAt)}- {community.name} Topluluğu
            </p>
            <Image
              src={community.image}
              alt="Topluluk Resmi"
              width={14}
              height={14}
              className="ml-1 object-cover border border-gray-1 p-1 bg-black"
            />
          </Link>
        )}
      </div>
    </article>
  );
};

export default ThreadCard;
