"use client";
import Image from "next/image";
import Link from "next/link";

import { capitalize } from "@/lib/utils";
import React from "react";

interface ProfileProps {
  communityId: string;
  authUserId: string;
  name: string;
  username: string;
  imgUrl: string;
  bio: string;
  type?: string;
}

const CommunityHeader = ({
  communityId,
  authUserId,
  name,
  username,
  imgUrl,
  bio,
  type,
}: Readonly<ProfileProps>) => {
  return (
    <div className="flex w-full flex-col justify-start">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20 object-cover">
            <Image
              src={imgUrl}
              alt="profile photo"
              fill
              className="rounded-full object-cover shadow-2xl border border-gray-1 p-2 bg-black"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-left text-heading3-bold text-light-1">
              {capitalize(name)}
            </h2>
            <p className="text-base-medium text-gray-1">@{username}</p>
          </div>
        </div>
        <Link href="/communities/edit">
          <div className="flex cursor-pointer gap-3 rounded-lg bg-dark-3 px-4 py-2">
            <Image
              src="/assets/edit.svg"
              alt="logout"
              width={20}
              height={20}
              style={{ width: 20, height: 20 }}
            />

            <p className="text-light-2 max-sm:hidden">Edit</p>
          </div>
        </Link>
      </div>

      <p className="mt-8 ml-1 max-2-lg text-base-regular text-light-2">{bio}</p>
      <div className="mt-6 h-0.5 w-full bg-dark-3" />
    </div>
  );
};

export default CommunityHeader;
