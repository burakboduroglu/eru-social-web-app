"use server";

import { FilterQuery, SortOrder } from "mongoose";
import { revalidatePath } from "next/cache";
import Community from "../models/community.model";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDatabase } from "../mongoose";

// Types
interface Params {
  userId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

// Get user for profile page
export async function getUser(userId: string) {
  try {
    await connectToDatabase();

    return await User.findOne({ id: userId }).populate({
      path: "communities",
      model: Community,
    });
  } catch (error: any) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
}

// Get user for community page "üyeler" tab
export async function getUserByMongoId(userId: string) {
  try {
    await connectToDatabase();

    return await User.findOne({ _id: userId }).populate({
      path: "communities",
      model: Community,
    });
  } catch (error: any) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
}

// Get user posts for profile page "gönderiler" tab
export async function getUserPosts(userId: string) {
  try {
    await connectToDatabase();

    const threads = await User.findOne({ id: userId }).populate({
      path: "threads",
      model: Thread,
      populate: [
        {
          path: "community",
          model: Community,
          select: "name id image _id",
        },
        {
          path: "children",
          model: Thread,
          populate: {
            path: "author",
            model: User,
            select: "name image id",
          },
        },
      ],
    });
    return threads;
  } catch (error) {
    console.error("Error fetching user threads:", error);
    throw error;
  }
}

// Get all users for explore page
export async function getAllUsers({
  userId,
  searchString = "",
  sortBy = "desc",
}: {
  userId: string;
  searchString?: string;
  sortBy?: SortOrder;
}) {
  try {
    await connectToDatabase();

    const regex = new RegExp(searchString, "i");

    const query: FilterQuery<typeof User> = {
      id: { $ne: userId },
    };

    if (searchString.trim() !== "") {
      query.$or = [
        { username: { $regex: regex } },
        { name: { $regex: regex } },
      ];
    }

    const sortOptions = { createdAt: sortBy };

    // For Random Users (aggregate)
    const usersQuery = User.aggregate([
      { $match: query },
      { $sample: { size: 5 } },
    ]);

    const users = await usersQuery.exec();

    return { users };
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

// Get user replies for the last 24 hours
export async function getActivity(userId: string) {
  try {
    await connectToDatabase();

    const userThreads = await Thread.find({ author: userId });

    const childThreadIds = userThreads.reduce((acc, userThread) => {
      return acc.concat(userThread.children);
    }, []);

    const replies = await Thread.find({
      _id: { $in: childThreadIds },
      author: { $ne: userId },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).populate({
      path: "author",
      model: User,
      select: "name image _id",
    });

    return replies;
  } catch (error) {
    console.error("Error fetching replies: ", error);
    throw error;
  }
}

// Get user comments for profile page "yanıtlar" tab
export async function getUserComments(userId: string) {
  try {
    await connectToDatabase();

    const comments = await Thread.find({
      threads: userId,
      author: { $ne: userId },
    }).populate({
      path: "children",
      match: { author: userId },
      populate: {
        path: "author",
        model: User,
        select: "name, username, image, id",
      },
    });

    const threads = await Thread.find({ author: userId }).populate({
      path: "children",
      model: Thread,
      match: { author: userId },
      populate: {
        path: "author",
        model: User,
        select: "name, username, image, id",
      },
    });

    const selfComments = threads.flatMap((thread) => thread.children);

    const userComments = comments.flatMap((comment) => comment.children);

    return [...userComments, ...selfComments];
  } catch (e: any) {
    console.error(`Error: ${e}`);
    throw e;
  }
}

// Update user profile informations
export async function updateUser({
  userId,
  bio,
  name,
  path,
  username,
  image,
}: Params): Promise<void> {
  try {
    await connectToDatabase();

    await User.findOneAndUpdate(
      { id: userId },
      {
        username: username.toLowerCase(),
        name,
        bio,
        image,
        onboarded: true,
      },
      { upsert: true }
    );

    if (path === "/profile/edit") {
      revalidatePath(path);
    }
  } catch (error: any) {
    console.log(`Failed to create/update user: ${error.message}`);
  }
}
