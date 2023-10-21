import Link from "next/link";
import Image from "next/image";
import { OrganizationSwitcher, SignOutButton, SignedIn } from "@clerk/nextjs";

function Topbar() {
    return (
        <nav className="topbar">
            <Link href="/" className="flex items-center gap-4 px-5">
                <Image src="/assets/logo.svg" alt="logo" width={38} height={38}/>
                <p className="text-heading3-bold text-light-1 max-xs:hidden">Eru Social Web</p>
            </Link>
            <div className="flex items-center gap-1">
                <div className="block md:hidden">
                    <SignedIn>
                        <SignOutButton>
                            <div className="flex cursor-pointer">
                                <Image 
                                    src="/assets/logout.svg"
                                    alt="logout"
                                    width={24}
                                    height={24}                               
                                />
                            </div>
                        </SignOutButton>
                    </SignedIn> 
                </div>
                <OrganizationSwitcher 
                    appearance={{
                        elements: {
                            organizationSwitcherTrigger: "py-2 px-2 text-light-1"
                        }
                    }}
                />
            </div>
        </nav>
    );
}

export default Topbar;