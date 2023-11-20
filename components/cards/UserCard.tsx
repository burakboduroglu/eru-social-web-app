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
    <article className="user-card mt-5">
      <div className="user-card_avatar">
        <Image
          src={imgUrl}
          alt="photo"
          width={28}
          height={28}
          className="rounded-full"
        />
        <div className="flex-1 text-ellipsis">
          <h4 className="text-base-semibold text-light-1">
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
