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
    <div className="text-gray-400 xs:text-[0.35em] sm:text-[0.35em] md:text-[0.65em] lg:text-[0.70m]">
      <button
        onClick={handleLike}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered ? (
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
