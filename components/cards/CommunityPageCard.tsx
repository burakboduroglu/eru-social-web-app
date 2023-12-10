import React from "react";
import Image from "next/image";
import Link from "next/link";
import ComImage from "../../public/assets/community.svg";
import { Button } from "../ui/button";
import { getUserByMongoId } from "@/lib/actions/user.actions";

interface Props {
  id: string;
  name: string;
  username: string;
  imgUrl: string;
  members?: string;
  createdBy?: string;
}
export default async function CommunityPageCard({
  id,
  name,
  username,
  imgUrl,
  members,
  createdBy,
}: Props) {
  const user = await getUserByMongoId(createdBy || "");
  return (
    <article className="flex flex-col mt-5 gap-3 border border-b-gray-500 p-5 rounded-xl bg-dark-2">
      <div className="flex flex-wrap items-center gap-5">
        <Link href={`/communities/${id}`} className="relative h-10 w-10">
          <Image
            src={imgUrl || ComImage}
            alt="community_logo"
            fill
            className="rounded-full object-cover"
          />
        </Link>

        <div>
          <Link href={`/communities/${id}`}>
            <h4 className="text-base-semibold text-light-1">{name}</h4>
          </Link>
          <p className="text-small-medium text-gray-1">@{username}</p>
        </div>
      </div>
      <div className="border border-b-gray-500" />
      <div className="mt-1 text-small-medium text-light-1">
        Üye Sayısı: <span className="text-primary-500">{members?.length}</span>
      </div>
      <div className="mt-1 text-small-medium text-light-1">
        Topluluğu Oluşturan:{" "}
        <Link href={`/profile/${user?.id}`} target="_blank">
          <span className="text-primary-500">{user?.name || ""}</span>
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3 items">
        <Link href={`/communities/${id}`}>
          <Button size="sm" className="community-card_btn">
            Görüntüle
          </Button>
        </Link>
      </div>
    </article>
  );
}
