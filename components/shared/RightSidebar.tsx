import { getRandomCommunities } from "@/lib/utils";
import CommunityCard from "../cards/CommunityCard";
import { getAllCommunities } from "@/lib/actions/community.actions";

async function RightSidebar() {
  const communities = await getAllCommunities();
  const randomCommunities = getRandomCommunities(communities, 3);

  return (
    <section className="custom-scrollbar rightsidebar">
      <div className="flex flex-1 flex-col justify-start">
        <h3 className="text-heading4-medium text-purple-200">
          İlginizi Çekebilir
        </h3>

        <div>
          {randomCommunities.map((community: any) => (
            <CommunityCard
              key={community.id}
              id={community.id}
              name={community.name}
              username={community.username}
              imgUrl={community.image}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default RightSidebar;
