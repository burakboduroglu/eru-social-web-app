import Link from "next/link";
import Image from "next/image";
import { universityTabs } from "@/constants";

const UniversityCard = () => {
  return (
    <article className="flex flex-col gap-4 text-lime-100 mx-auto  max-w-md lg:max-w-2xl">
      {universityTabs.map((tab) => (
        <Link
          href={tab.route}
          target="_blank"
          className="rounded-full hover:bg-[#302e81] transition-colors duration-100 ease-in-out hover:cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-1 flex-row gap-4 border border-white rounded-full hover:border-[#302e81] transition-colors duration-200 ease-in-out">
              <div className="flex  items-center gap-3  mx-auto p-2">
                <Image src={tab.imgURL} width={24} height={24} alt="icon" />
                {tab.label}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </article>
  );
};

export default UniversityCard;
