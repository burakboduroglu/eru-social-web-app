import Link from "next/link";
import Image from "next/image";
import { formatDateString } from "@/lib/utils";
import UserPlaceholder from "public/assets/user.svg";
import DeleteThread from "../forms/DeleteThread";
import LinkCard from "./LinkCard";
import LikeButton from "../buttons/LikeButton";
import ReplyButton from "../buttons/ReplyButton";
import ShareButton from "../buttons/ShareButton";
import AuthorButton from "../buttons/AuthorButton";

// ... rest of your code
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
  postLike?: Number;
  curruntUserInfo: string;
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
  postLike,
  curruntUserInfo,
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
                alt="Profile Picture"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="cursor-pointer rounded-full border border-gray-1 p-1 bg-black"
              />
            </Link>
            <div className="thread-card_bar" />
          </div>

          <div>
            <AuthorButton
              id={author?.id}
              name={author?.name}
              username={author?.username}
            />
            <div className="mt-3 text-small-regular text-white">
              <LinkCard
                url={content}
                content={content}
                path={path}
                id={JSON.stringify(id)}
              />
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex gap-4">
                <LikeButton
                  threadId={JSON.stringify(id)}
                  postLike={postLike || 0}
                  userId={curruntUserInfo}
                />
                <ReplyButton id={JSON.stringify(id)} length={comments.length} />
                <ShareButton id={JSON.stringify(id)} />
              </div>
              <div className="flex-col mt-3 text-subtle-medium">
                <p className="text-subtle-medium text-gray-1">
                  {formatDateString(createdAt)}
                </p>
                {!isComment && community && (
                  <div className="text-amber-600 mt-2">
                    <Link
                      href={`/communities/${community.id}`}
                      className="flex items-center"
                    >
                      <p className="text-subtle-medium pr-3">
                        {community.name} Topluluğu
                      </p>
                      <Image
                        src={community.image}
                        alt="Topluluk Resmi"
                        width={24}
                        height={24}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className=" object-cover rounded-full p-1 border border-gray-500 relative w-6 h-6"
                      />
                    </Link>
                  </div>
                )}
              </div>

              {comments.length > 0 && (
                <div className="mt-3 flex items-center gap-2 max-w-[1">
                  {comments.slice(0, 2).map((comment, index) => (
                    <Image
                      key={index}
                      src={comment.author?.image || UserPlaceholder}
                      alt={`user_${index}`}
                      width={22}
                      height={22}
                      priority
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
      </div>
    </article>
  );
};

export default ThreadCard;
