"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ReplyButton({ id }: { id: any }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div>
      <Link
        href={`/thread/${JSON.parse(id)}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered ? (
          <Image
            src="/assets/hover-reply.svg"
            alt="yorum"
            width={18}
            height={18}
            className="cursor-pointer object-contain mt-0.5 mr-[1px]"
          />
        ) : (
          <Image
            src="/assets/reply.svg"
            alt="yorum"
            width={18}
            height={18}
            className="cursor-pointer object-contain mt-0.5 mr-[1px]"
          />
        )}
      </Link>
    </div>
  );
}
