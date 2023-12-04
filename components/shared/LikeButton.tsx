"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { likeThread } from "@/lib/actions/thread.actions";

export default function LikeButton({
  threadId,
  postLike,
}: {
  threadId: string;
  postLike: Number | null;
}) {
  const handleLike = () => {
    likeThread(JSON.parse(threadId));
  };

  return (
    <div>
      <button onClick={handleLike}>
        <Image
          src="/assets/heart-gray.svg"
          alt="begen"
          width={24}
          height={24}
          className="cursor-pointer object-contain hover:bg-red-800 transition-colors duration-100 ease-in-out rounded-full"
        />
        {postLike && (
          <span className="text-gray-400 xs:text-[0.65em] leading-tight ">
            {postLike.toString()}
          </span>
        )}
      </button>
    </div>
  );
}
