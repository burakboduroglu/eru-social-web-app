"use server";

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import Thread from "../models/thread.model";

// MongoDB
import { connectToDatabase } from "../mongoose";
import { FilterQuery, SortOrder } from "mongoose";

interface UserParams {
  userId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

// Update user
export async function updateUser({
  userId,
  username,
  name,
  bio,
  image,
  path,
}: Readonly<UserParams>) {
  connectToDatabase();

  try {
    await User.findOneAndUpdate(
      { id: userId },
      { username: username.toLowerCase(), name, bio, image, onboarded: true }, // onboarded use for this aim to check if user is onboarded
      { upsert: true } // updating and inserting
    );

    if (path === "/profile/edit") {
      revalidatePath(path); //revalidatePath use for revalidate data associated with a specific path
    }
  } catch (error: any) {
    revalidatePath("/");
    throw new Error(`Failed to update user: ${error.message}`);
  }
}

// Get user
export async function getUser(userId: string) {
  try {
    connectToDatabase();

    const user = await User.findOne({ id: userId });
    return user;
  } catch (e: any) {
    revalidatePath("/");
    throw new Error(`Error: ${e}`);
  }
}

export async function getUserPosts(userId: string) {
  try {
    connectToDatabase();

    // TODO: POPULATE COMMUNITY
    const posts = await User.findOne({ id: userId }).populate({
      path: "threads",
      model: Thread,
      populate: {
        path: "children",
        model: Thread,
        populate: {
          path: "author",
          model: User,
          select: "name username, image, id",
        },
      },
    });

    return posts;
  } catch (e: any) {
    revalidatePath("/");
    throw new Error(`Error: ${e}`);
  }
}

export async function getUserComments(userId: string) {
  try {
    connectToDatabase();

    const threads = await Thread.find({ author: userId }).populate({
      path: "children",
      model: Thread,
      populate: {
        path: "author",
        model: User,
        select: "name username, image, id",
      },
    });

    // Extract only the children from each thread
    const children = threads.flatMap((thread) => thread.children);

    return children;
  } catch (e: any) {
    revalidatePath("/");
    throw new Error(`Error: ${e}`);
  }
}

export async function getAllUsers({
  userId,
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
}: Readonly<{
  userId: string;
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
}>) {
  try {
    connectToDatabase();

    const skipAmount = (pageNumber - 1) * pageSize;
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

    const sort = { createdAt: sortBy };
    const usersQuery = User.find(query)
      .sort(sort)
      .skip(skipAmount)
      .limit(pageSize);

    const totalUsersCount = await User.countDocuments(query);
    const users = await usersQuery.exec();

    const isNext = totalUsersCount > skipAmount + users.length;
    return { users, isNext };
  } catch (e: any) {
    revalidatePath("/");
    throw new Error(`Error: ${e}`);
  }
}

export async function getActivity(userId: string) {
  try {
    connectToDatabase();

    // all threads which user created
    const threads = await Thread.find({ author: userId });

    // get all comments which user created
    const childThreadIds = threads.reduce((acc, thread) => {
      return acc.concat(thread.children);
    }, []);

    const comments = await Thread.find({
      _id: { $in: childThreadIds },
      author: { $ne: userId },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).populate({
      path: "author",
      model: User,
      select: "name image id",
    });
    return comments;
  } catch (e: any) {
    revalidatePath("/");
    throw new Error(`Error: ${e}`);
  }
}
