"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { likeThread } from "@/lib/actions/thread.actions";

export default function LikeButton({
  threadId,
  postLike,
}: {
  threadId: string;
  postLike: Number;
}) {
  const [likeCount, setLikeCount] = useState(Number(postLike));
  const [isHovered, setIsHovered] = useState(false);

  const handleLike = () => {
    setLikeCount(Number(likeCount) + Number(1));
    likeThread(JSON.parse(threadId));
  };

  return (
    <div className="text-gray-400 xs:text-[0.55em] sm:text-[0.55em] md:text-[0.65em] lg:text-[0.70m] leading-tight">
      <button
        onClick={handleLike}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered ? (
          <Image
            src="/assets/heart-filled.svg"
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
        {likeCount}
      </button>
    </div>
  );
}
