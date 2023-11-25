"use client";

import Image from "next/image";
import { capitalize } from "@/lib/utils";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";

interface UserCardProps {
  id: string;
  name: string;
  username: string;
  imgUrl: string;
  personType: String;
}

const UserCard = ({
  id,
  name,
  username,
  imgUrl,
  personType,
}: Readonly<UserCardProps>) => {
  const router = useRouter();

  return (
    <article className="user-card w-full pl-3 pr-3 border border-gray-500 p-3 rounded-lg -mt-3">
      <div className="user-card_avatar">
        <Image
          src={imgUrl}
          alt="photo"
          width={24}
          height={24}
          className="cursor-pointer rounded-full border border-gray-1 p-1 relative h-8 w-8 bg-black"
        />
        <div className="flex-1 text-ellipsis">
          <h4 className="text-base-semibold text-amber-100">
            {capitalize(name)}
          </h4>
          <p className="text-small-medium text-gray-1">@{username}</p>
        </div>
      </div>
      <Button
        className="user-card_btn"
        onClick={() => router.push(`/profile/${id}`)}
      >
        Görüntüle
      </Button>
    </article>
  );
};

export default UserCard;
