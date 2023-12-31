"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { deletePost } from "@/lib/actions/thread.actions";

interface Props {
  threadId: string;
  currentUserId: string;
  authorId: string;
  parentId: string | null;
  isComment?: boolean;
}

function DeleteThread({
  threadId,
  currentUserId,
  authorId,
  parentId,
  isComment,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  if (currentUserId !== authorId || pathname === "/") return null;

  return (
    <div>
      <Image
        src="/assets/delete.svg"
        alt="delete"
        width={18}
        height={18}
        className="cursor-pointer object-contain"
        onClick={async () => {
          if (window.confirm("Gönderiyi silmek istediğinize emin misiniz? ")) {
            await deletePost(JSON.parse(threadId), pathname);
            if (!parentId || !isComment) {
              router.push(`/profile/${currentUserId}`);
            }
          }
        }}
      />
    </div>
  );
}

export default DeleteThread;
