import Image from "next/image";
import Link from "next/link";
import ComImage from "../../public/assets/community.svg";

import { Button } from "../ui/button";

interface Props {
  id: string;
  name: string;
  username: string;
  imgUrl: string;
}

function CommunityCard({ id, name, username, imgUrl }: Props) {
  return (
    <article className="community-card pl-5">
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/communities/${id}`}>
          <Button size="sm" className="community-card_btn">
            Görüntüle
          </Button>
        </Link>
      </div>
    </article>
  );
}

export default CommunityCard;
