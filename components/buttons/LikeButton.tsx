"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { likeThread } from "@/lib/actions/thread.actions";

export default function LikeButton({
  threadId,
  postLike,
}: {
  threadId: string;
  postLike: Number | 0;
}) {
  const [likeCount, setLikeCount] = useState(postLike);
  const [isHovered, setIsHovered] = useState(false);

  const handleLike = () => {
    likeThread(JSON.parse(threadId));
    setLikeCount(Number(likeCount) + Number(1));
  };

  return (
    <div>
      <button
        onClick={handleLike}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered ? (
          <Image
            src="/assets/heart-filled.svg" // Change this to your hover image path
            alt="begen"
            width={24}
            height={24}
            className="cursor-pointer object-contain"
          />
        ) : (
          <Image
            src="/assets/heart-gray.svg"
            alt="begen"
            width={24}
            height={24}
            className="cursor-pointer object-contain"
          />
        )}
        {postLike && (
          <span className="text-gray-400 xs:text-[0.55em] sm:text-[0.55em] md:text-[0.75em] lg:text-[0.75em] leading-tight">
            {likeCount?.toString()}
          </span>
        )}
      </button>
    </div>
  );
}
