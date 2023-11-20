"use server";

import { connectToDatabase } from "@/lib/mongoose";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { revalidatePath } from "next/cache";
import Community from "../models/community.model";

interface ThreadParams {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
}

export async function createThread({
  text,
  author,
  communityId,
  path,
}: ThreadParams) {
  try {
    connectToDatabase();

    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );

    const createThread = await Thread.create({
      text,
      author,
      community: communityIdObject,
    });

    await User.findByIdAndUpdate(author, {
      $push: { threads: createThread._id },
    });

    if (communityIdObject) {
      // Update Community model
      await Community.findByIdAndUpdate(communityIdObject, {
        $push: { threads: createThread._id },
      });
    }

    revalidatePath(path);
  } catch (e: any) {
    revalidatePath("/");
    throw new Error(`Error creating thread: ${e.message}`);
  }
}

export async function getPosts(pageNumber = 1, pageSize = 20) {
  connectToDatabase();
  // Post Skip Calculation
  const skip = (pageNumber - 1) / pageSize;

  // Fetch the top-level threads
  const queryForPosts = Thread.find({ parentId: { $in: [null, undefined] } })
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "author", model: User })
    .populate({
      path: "children",
      populate: {
        path: "author",
        model: User,
        select: "_id name username parentId image",
      },
    });

  const totalPostsCount = await Thread.countDocuments({
    parentId: { $in: [null, undefined] },
  });
  const posts = await queryForPosts.exec();
  const isNext = totalPostsCount > skip + posts.length;

  return { posts, isNext };
}

export async function getPostById(id: string) {
  connectToDatabase();

  try {
    const post = await Thread.findById(id)
      .populate({
        path: "author",
        model: User,
        select: "_id id username name image",
      })
      .populate({
        path: "children",
        populate: [
          {
            path: "author",
            model: User,
            select: "_id id name username parentId image",
          },
          {
            path: "children",
            model: Thread,
            populate: {
              path: "author",
              model: User,
              select: "_id id name username parentId image",
            },
          },
        ],
      })
      .exec();
    return post;
  } catch (e: any) {
    revalidatePath("/");
    throw new Error(`Error ${e}`);
  }
}

export async function addCommentToThread(
  threadId: string,
  comment: string,
  userId: string,
  path: string
) {
  connectToDatabase();
  try {
    const mainThread = await Thread.findById(threadId);

    const threadComment = new Thread({
      text: comment,
      author: userId,
      parentId: threadId,
    });

    const savedComment = await threadComment.save();
    mainThread.children.push(savedComment._id);

    await mainThread.save();
    revalidatePath(path);
  } catch (e: any) {
    revalidatePath("/");
    throw new Error(`Error: ${e}`);
  }
}
