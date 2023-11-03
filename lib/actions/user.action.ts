"use server";

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
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

export async function updateUser({
  userId,
  username,
  name,
  bio,
  image,
  path,
}: UserParams): Promise<void> {
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
