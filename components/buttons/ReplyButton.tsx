"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ReplyButton({ id, length }: { id: any; length: any }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div>
      <Link
        href={`/thread/${JSON.parse(id)}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered ? (
          <div>
            <Image
              src="/assets/hover-reply.svg"
              alt="yorum"
              width={17}
              height={17}
              className="cursor-pointer object-contain mt-0.5 mr-[1px]"
            />
            <p className="text-gray-400 xs:text-[0.25em] sm:text-[0.25em] md:text-[0.65em] lg:text-[0.70m] px-1 py-1.5">
              {length}
            </p>
          </div>
        ) : (
          <Image
            src="/assets/reply.svg"
            alt="yorum"
            width={17}
            height={17}
            className="cursor-pointer object-contain mt-0.5 mr-[1px]"
          />
        )}
        <p className="text-gray-400 xs:text-[0.25em] sm:text-[0.25em] md:text-[0.65em] lg:text-[0.70m] px-1 py-2">
          {length}
        </p>
      </Link>
    </div>
  );
}
