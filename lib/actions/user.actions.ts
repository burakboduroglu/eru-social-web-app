"use server";

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import Thread from "../models/thread.model";

// MongoDB
import { connectToDatabase } from "../mongoose";

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
    throw new Error(`Failed to update user: ${error.message}`);
  }
}

// Get user
export async function getUser(userId: string) {
  try {
    connectToDatabase();
    return await User.findOne({ id: userId });
  } catch (error: any) {
    throw new Error(`Failed to get user: ${error.message}`);
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
    throw new Error(`Error: ${e}`);
  }
}

export async function getUserChildren(userId: string) {
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
    const children = threads.flatMap(thread => thread.children);

    return children;
  } catch (e: any) {
    throw new Error(`Error: ${e}`);
  }
}
