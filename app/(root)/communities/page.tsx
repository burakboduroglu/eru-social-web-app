import CommunityPageCard from "@/components/cards/CommunityPageCard";
import { getAllCommunities } from "@/lib/actions/community.actions";

export default async function page() {
  const communities = await getAllCommunities();

  return (
    <div className="head-text text-white">
      <h1>Topluluklar</h1>
      <div>
        {communities.map((community) => (
          <CommunityPageCard
            key={community.id}
            id={community.id}
            name={community.name}
            username={community.username}
            imgUrl={community.image}
            members={community.members}
            createdBy={community.createdBy}
          />
        ))}
      </div>
    </div>
  );
}
