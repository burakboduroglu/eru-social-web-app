"use client";

import React, { useState } from "react";
import Image from "next/image";
import { likeThread } from "@/lib/actions/thread.actions";

export default function LikeButton({
  threadId,
  postLike,
  userId,
}: {
  threadId: string;
  postLike: Number;
  userId: string;
}) {
  const [likeCount, setLikeCount] = useState(Number(postLike));
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const handleLike = async () => {
    if (isLiked) {
      setLikeCount(likeCount - 1);
      setIsLiked(false);
    } else {
      setLikeCount(likeCount + 1);
      setIsLiked(true);
    }
    likeThread(JSON.parse(threadId), userId);
  };

  return (
    <div className="text-gray-400 xs:text-[0.35em] sm:text-[0.35em] md:text-[0.65em] lg:text-[0.70m]">
      <button
        onClick={handleLike}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered || isLiked ? (
          <Image
            src="/assets/heart-filled.svg"
            alt="begen"
            width={23}
            height={23}
            className="cursor-pointer object-contain"
          />
        ) : (
          <Image
            src="/assets/heart-gray.svg"
            alt="begen"
            width={23}
            height={23}
            className="cursor-pointer object-contain"
          />
        )}
        <p className="text-gray-400 py-1">{likeCount}</p>
      </button>
    </div>
  );
}
