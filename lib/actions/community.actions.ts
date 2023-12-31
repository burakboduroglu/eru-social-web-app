"use server";

import Community from "../models/community.model";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDatabase } from "../mongoose";

// Create a new community
export async function createCommunity(
  id: string,
  name: string,
  username: string,
  image: string,
  bio: string,
  createdById: string
) {
  try {
    await connectToDatabase();

    const user = await User.findOne({ id: createdById });

    if (!user) {
      throw new Error("User not found");
    }

    const newCommunity = new Community({
      id,
      name,
      username,
      image,
      bio,
      createdBy: user._id,
    });

    const createdCommunity = await newCommunity.save();

    user.communities.push(createdCommunity._id);
    await user.save();

    return createdCommunity;
  } catch (error) {
    console.error("Error creating community:", error);
    throw error;
  }
}

// Fetch community details
export async function fetchCommunityDetails(id: string) {
  try {
    await connectToDatabase();

    const communityDetails = await Community.findOne({ id }).populate([
      "createdBy",
      "bio",
      "_id",
      {
        path: "members",
        model: User,
        select: "name username image _id id",
      },
    ]);

    return communityDetails;
  } catch (error) {
    console.error("Error fetching community details:", error);
    throw error;
  }
}

// Fetch community posts
export async function fetchCommunityPosts(id: string) {
  try {
    await connectToDatabase();

    const communityPosts = await Community.findOne({ id }).populate({
      path: "threads",
      model: Thread,
      populate: [
        {
          path: "author",
          model: User,
          select: "name image id",
        },
        {
          path: "children",
          model: Thread,
          populate: {
            path: "author",
            model: User,
            select: "image _id",
          },
        },
      ],
    });

    return communityPosts;
  } catch (error) {
    // Handle any errors
    console.error("Error fetching community posts:", error);
    throw error;
  }
}

// Add a member to a community
export async function addMemberToCommunity(
  communityId: string,
  memberId: string
) {
  try {
    await connectToDatabase();

    const community = await Community.findOne({ id: communityId });

    if (!community) {
      throw new Error("Community not found");
    }

    const user = await User.findOne({ id: memberId });

    if (!user) {
      throw new Error("User not found");
    }

    if (community.members.includes(user._id)) {
      throw new Error("User is already a member of the community");
    }

    community.members.push(user._id);
    await community.save();

    user.communities.push(community._id);
    await user.save();

    return community;
  } catch (error) {
    console.error("Error adding member to community:", error);
    throw error;
  }
}

// Remove a member from a community
export async function removeUserFromCommunity(
  userId: string,
  communityId: string
) {
  try {
    await connectToDatabase();

    const userIdObject = await User.findOne({ id: userId }, { _id: 1 });
    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );

    if (!userIdObject) {
      throw new Error("User not found");
    }

    if (!communityIdObject) {
      throw new Error("Community not found");
    }

    await Community.updateOne(
      { _id: communityIdObject._id },
      { $pull: { members: userIdObject._id } }
    );

    await User.updateOne(
      { _id: userIdObject._id },
      { $pull: { communities: communityIdObject._id } }
    );

    return { success: true };
  } catch (error) {
    console.error("Error removing user from community:", error);
    throw error;
  }
}

// Update community information
export async function updateCommunityInfo(
  communityId: string,
  name: string,
  username: string,
  image: string
) {
  try {
    await connectToDatabase();

    const updatedCommunity = await Community.findOneAndUpdate(
      { id: communityId },
      { name, username, image }
    );

    if (!updatedCommunity) {
      throw new Error("Community not found");
    }

    return updatedCommunity;
  } catch (error) {
    console.error("Error updating community information:", error);
    throw error;
  }
}

// Delete a community
export async function deleteCommunity(communityId: string) {
  try {
    await connectToDatabase();

    const deletedCommunity = await Community.findOneAndDelete({
      id: communityId,
    });

    if (!deletedCommunity) {
      throw new Error("Community not found");
    }

    await Thread.deleteMany({ community: communityId });

    const communityUsers = await User.find({ communities: communityId });

    const updateUserPromises = communityUsers.map((user) => {
      user.communities.pull(communityId);
      return user.save();
    });

    await Promise.all(updateUserPromises);

    return deletedCommunity;
  } catch (error) {
    console.error("Error deleting community: ", error);
    throw error;
  }
}

// Fetch all communities
export async function getAllCommunities() {
  try {
    await connectToDatabase();

    const communities = await Community.find().populate("members");

    return communities;
  } catch (error) {
    console.error("Error fetching all communities:", error);
    throw error;
  }
}

// Update community bio
export async function updateCommunityBio(communityId: string, bio: string) {
  try {
    await connectToDatabase();

    const updatedCommunity = await Community.findOneAndUpdate(
      { id: communityId },
      { bio }
    );

    if (!updatedCommunity) {
      throw new Error("Community not found");
    }

    return updatedCommunity;
  } catch (error) {
    console.error("Error updating community bio:", error);
    throw error;
  }
}
