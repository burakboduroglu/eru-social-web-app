import { redirect } from "next/navigation";

import {
  getUserPosts,
  getUserComments,
  getUser,
} from "@/lib/actions/user.actions";

import ThreadCard from "../cards/ThreadCard";
import {
  fetchCommunities,
  fetchCommunityDetails,
  fetchCommunityPosts,
} from "@/lib/actions/community.actions";

interface TabProps {
  currentUserId: string;
  communityId: string;
  profileType: string;
  tabLabel: string;
}

async function CommunityTab({
  currentUserId,
  communityId,
  profileType,
  tabLabel,
}: Readonly<TabProps>) {
  let community = await fetchCommunityPosts(communityId);

  if (!community) {
    redirect("/");
  }

  return <section className="mt-3 flex flex-col gap-3">asas</section>;
}

export default CommunityTab;
