"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ShareButton({ id }: { id: any }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div>
      <Link
        href={`/thread/share/${JSON.parse(id)}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered ? (
          <Image
            src="/assets/hover-share.svg"
            alt="paylas"
            width={20}
            height={20}
            className="cursor-pointer object-contain "
          />
        ) : (
          <Image
            src="/assets/share.svg"
            alt="paylas"
            width={20}
            height={20}
            className="cursor-pointer object-contain "
          />
        )}
      </Link>
    </div>
  );
}
