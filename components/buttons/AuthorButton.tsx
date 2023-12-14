"use client";

import { useRouter } from "next/navigation";
import React from "react";

type AuthorButtonProps = {
  id: string;
  name: string;
  username: string;
};

export default function AuthorButton({
  id,
  name,
  username,
}: AuthorButtonProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => {
        router.push(`/profile/${id}`);
      }}
      className="flex-col items-start"
    >
      <p className="cursor-pointer text-amber-100 xs:text-[0.95em] leading-tight">
        {name}
      </p>
      <span className="text-gray-400 xs:text-[0.75em] leading-tight">
        {username ? `@${username}` : ""}
      </span>
    </div>
  );
}
