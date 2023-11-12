import Image from "next/image";
import { capitalize } from "@/lib/utils";

interface ProfileProps {
  profileId: string;
  authUserId: string;
  name: string;
  username: string;
  imgUrl: string;
  bio: string;
}

const ProfileHeader = ({
  profileId,
  authUserId,
  name,
  username,
  imgUrl,
  bio,
}: Readonly<ProfileProps>) => {
  return (
    <div className="flex w-full flex-col justify-start">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20 object-cover">
            <Image
              src={imgUrl}
              alt="profile photo"
              fill
              className="rounded-full object-cover shadow-2xl"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-left text-heading3-bold text-light-1">
              {capitalize(name)}
            </h2>
            <p className="text-base-medium text-gray-1">@{username}</p>
          </div>
        </div>
      </div>
      {/* TODO COMMUNITIES WILL ADD HERE */}

      <p className="mt-8 ml-1 max-2-lg text-base-regular text-light-2">{bio}</p>
      <div className="mt-6 h-0.5 w-full bg-dark-3" />
    </div>
  );
};

export default ProfileHeader;
