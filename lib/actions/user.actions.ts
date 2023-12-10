"use server";

import { FilterQuery, SortOrder } from "mongoose";
import { revalidatePath } from "next/cache";

import Community from "../models/community.model";
import Thread from "../models/thread.model";
import User from "../models/user.model";

import { connectToDatabase } from "../mongoose";

export async function getUser(userId: string) {
  try {
    connectToDatabase();

    return await User.findOne({ id: userId }).populate({
      path: "communities",
      model: Community,
    });
  } catch (error: any) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
}

export async function getUserByMongoId(userId: string) {
  try {
    connectToDatabase();

    return await User.findOne({ _id: userId }).populate({
      path: "communities",
      model: Community,
    });
  } catch (error: any) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
}

interface Params {
  userId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

export async function updateUser({
  userId,
  bio,
  name,
  path,
  username,
  image,
}: Params): Promise<void> {
  try {
    connectToDatabase();

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

export async function getUserPosts(userId: string) {
  try {
    connectToDatabase();

    // Find all threads authored by the user with the given userId
    const threads = await User.findOne({ id: userId }).populate({
      path: "threads",
      model: Thread,
      populate: [
        {
          path: "community",
          model: Community,
          select: "name id image _id", // Select the "name" and "_id" fields from the "Community" model
        },
        {
          path: "children",
          model: Thread,
          populate: {
            path: "author",
            model: User,
            select: "name image id", // Select the "name" and "_id" fields from the "User" model
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
    connectToDatabase();

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

    const usersQuery = User.find(query).sort(sortOptions);

    const totalUsersCount = await User.countDocuments(query);

    const users = await usersQuery.exec();

    return { users };
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

export async function getActivity(userId: string) {
  try {
    connectToDatabase();

    // Find all threads created by the user
    const userThreads = await Thread.find({ author: userId });

    // Collect all the child thread ids (replies) from the 'children' field of each user thread
    const childThreadIds = userThreads.reduce((acc, userThread) => {
      return acc.concat(userThread.children);
    }, []);

    // Find and return the child threads (replies) excluding the ones created by the same user
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

export async function getUserComments(userId: string) {
  try {
    connectToDatabase();

    // comments on user's posts
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

    // self comments
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

    // Extract only the children from each thread
    const selfComments = threads.flatMap((thread) => thread.children);

    // Extract only the children from each thread
    const userComments = comments.flatMap((comment) => comment.children);

    return [...userComments, ...selfComments];
  } catch (e: any) {
    console.error(`Error: ${e}`);
    throw e;
  }
}
