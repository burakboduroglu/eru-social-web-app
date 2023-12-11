"use client";

// Constants
import { sidebarLinks } from "@/constants";

// Next.js
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

function Bottombar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <section className="bottombar">
      <div className="bottombar_container">
        {sidebarLinks.map((link) => {
          const isActive =
            (pathname.includes(link.route) && link.route.length > 1) ||
            pathname === link.route;

          return (
            <Link
              href={link.route}
              key={link.label}
              className={`bottombar_link ${isActive && "bg-[#312e81]"} ${
                link.route === "/notifications" ? "hidden" : ""
              }`}
            >
              <Image
                src={link.imgURL}
                alt={link.label}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                width={24}
                height={24}
              />
              <p className="text-light-1 text-subtle-medium max-sm:hidden">
                {link.label.split(/\s+/)[0]}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default Bottombar;
