import CommunityCard from "../cards/CommunityCard";
import { getAllCommunities } from "@/lib/actions/community.actions";

async function RightSidebar() {
  const communities = await getAllCommunities();
  return (
    <section className="custom-scrollbar rightsidebar">
      <div className="flex flex-1 flex-col justify-start">
        <h3 className="text-heading4-medium pr-11 pt-3 text-purple-200">
          İlginizi çekebilir
        </h3>
        <div>
          {communities.map((community) => (
            <CommunityCard
              key={community.id}
              id={community.id}
              name={community.name}
              username={community.username}
              imgUrl={community.imgUrl}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default RightSidebar;
