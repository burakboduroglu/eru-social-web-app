"use client";

// Constants
import { sidebarLinks } from "@/constants";

// Next.js
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { SignOutButton, SignedIn, useAuth } from "@clerk/nextjs";

function LeftSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId } = useAuth();

  return (
    <section className="custom-scrollbar leftsidebar pr-10">
      <div className="flex w-full flex-1 flex-col px-3 mx-auto">
        {sidebarLinks.map((link) => {
          const isActive =
            (pathname.includes(link.route) && link.route.length > 1) ||
            pathname === link.route;

          if (link.route === "/profile") link.route += `/${userId}`;

          return (
            <Link
              href={link.route}
              key={link.label}
              className={`leftsidebar_link ${isActive && "bg-[#312e81]"}`}
            >
              <Image
                src={link.imgURL}
                alt={link.label}
                width={24}
                height={24}
                style={{ width: 24, height: 24 }}
              />
              <p className="text-light-1 max-lg:hidden text-[1.05em] pr-5">
                {link.label}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="px-[1.5rem]">
        <SignedIn>
          <SignOutButton
            signOutCallback={() => {
              router.push("sign-in");
            }}
          >
            <div className="flex cursor-pointer">
              <Image
                src="/assets/logout.svg"
                alt="logout"
                width={24}
                height={24}
              />
              <p className="text-light-1 ml-4 max-lg:hidden">Logout</p>
            </div>
          </SignOutButton>
        </SignedIn>
      </div>
    </section>
  );
}

export default LeftSidebar;
