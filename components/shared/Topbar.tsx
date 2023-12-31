import Link from "next/link";
import Image from "next/image";
import { dark } from "@clerk/themes";
import {
  OrganizationSwitcher,
  SignOutButton,
  SignedIn,
  UserButton,
  UserProfile,
} from "@clerk/nextjs";

function Topbar() {
  return (
    <nav className="topbar">
      <Link href="/" className="flex items-center gap-5 py-3 px-5 sm:pl-6">
        <Image
          src="/assets/logo.svg"
          alt="logo"
          width={38}
          height={38}
          className="xs:w-[45px] xs:h-[45px] xs:mt-3 border-b-2 border-light-1"
        />
        <div className="text-heading3-semibold text-[18px] text-light-1 hidden lg:block uppercase pt-3">
          Eru Social Web
        </div>
      </Link>
      <div className="flex items-center gap-1">
        <div className="flex items-center md:hidden">
          <SignedIn>
            <SignOutButton>
              <div className="flex cursor-pointer p-2 hover:bg-[#312e81] rounded-lg transition duration-300">
                <Image
                  src="/assets/logout.svg"
                  alt="logout"
                  width={24}
                  height={24}
                />
              </div>
            </SignOutButton>
            <Link href="/notifications" className="pr-3 pl-3">
              <Image
                src="/assets/heart.svg"
                alt="notifications"
                width={24}
                height={24}
              />
            </Link>
          </SignedIn>
        </div>
        <OrganizationSwitcher
          appearance={{
            baseTheme: dark,
            elements: {
              organizationSwitcherTrigger: "py-2 px-1",
            },
          }}
        />
        <div className="ml-5 mr-3">
          <UserButton
            appearance={{
              baseTheme: dark,
              elements: {
                organizationSwitcherTrigger: "py-2 px-1",
              },
            }}
          />
        </div>
      </div>
    </nav>
  );
}

export default Topbar;
