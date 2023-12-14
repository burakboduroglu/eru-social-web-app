"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "../mongoose";
import User from "../models/user.model";
import Thread from "../models/thread.model";
import Community from "../models/community.model";

// Thread params
interface Params {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
}

// Fetch all posts
export async function fetchAllPosts(limit = 10, skip = 0) {
  await connectToDatabase();

  const postsQuery = Thread.find()
    .populate({
      path: "author",
      model: User,
    })
    .populate({
      path: "community",
      model: Community,
    })
    .populate({
      path: "children",
      populate: {
        path: "author",
        model: User,
        select: "_id name parentId image",
      },
    });

  const unfilteredPosts = await postsQuery.exec();
  const posts = unfilteredPosts.filter((post) => post.parentId === undefined);
  return posts;
}

// Create a post
export async function createPost({ text, author, communityId, path }: Params) {
  try {
    await connectToDatabase();

    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );

    const createdThread = await Thread.create({
      text,
      author,
      community: communityIdObject || null,
    });

    await User.findByIdAndUpdate(author, {
      $push: { threads: createdThread._id },
    });

    if (communityIdObject) {
      await Community.findByIdAndUpdate(communityIdObject, {
        $push: { threads: createdThread._id },
      });
    }

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to create post: ${error.message}`);
  }
}

// Get all child posts for deleting
async function getAllChildPosts(threadId: string): Promise<any[]> {
  const childThreads = await Thread.find({ parentId: threadId });

  const descendantThreads = [];
  for (const childThread of childThreads) {
    const descendants = await getAllChildPosts(childThread._id);
    descendantThreads.push(childThread, ...descendants);
  }

  return descendantThreads;
}

// Delete a post
export async function deletePost(id: string, path: string): Promise<void> {
  try {
    await connectToDatabase();

    const mainThread = await Thread.findById(id).populate("author community");

    if (!mainThread) {
      throw new Error("Post not found");
    }

    const descendantThreads = await getAllChildPosts(id);

    const descendantThreadIds = [
      id,
      ...descendantThreads.map((thread) => thread._id),
    ];

    const uniqueAuthorIds = new Set(
      [
        ...descendantThreads.map((thread) => thread.author?._id?.toString()),
        mainThread.author?._id?.toString(),
      ].filter((id) => id !== undefined)
    );

    const uniqueCommunityIds = new Set(
      [
        ...descendantThreads.map((thread) => thread.community?._id?.toString()),
        mainThread.community?._id?.toString(),
      ].filter((id) => id !== undefined)
    );

    await Thread.deleteMany({ _id: { $in: descendantThreadIds } });

    await User.updateMany(
      { _id: { $in: Array.from(uniqueAuthorIds) } },
      { $pull: { threads: { $in: descendantThreadIds } } }
    );

    await Community.updateMany(
      { _id: { $in: Array.from(uniqueCommunityIds) } },
      { $pull: { threads: { $in: descendantThreadIds } } }
    );

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to delete post: ${error.message}`);
  }
}

// Fetch a post by id
export async function fetchPostById(threadId: string) {
  await connectToDatabase();

  try {
    const thread = await Thread.findById(threadId)
      .populate({
        path: "author",
        model: User,
        select: "_id id username name image",
      })
      .populate({
        path: "community",
        model: Community,
        select: "_id id username name image",
      })
      .populate({
        path: "children",
        populate: [
          {
            path: "author",
            model: User,
            select: "_id id username name parentId image",
          },
          {
            path: "children",
            model: Thread,
            populate: {
              path: "author",
              model: User,
              select: "_id id username name parentId image",
            },
          },
        ],
      })
      .exec();

    return thread;
  } catch (err) {
    console.error("Error while fetching thread:", err);
    throw new Error("Unable to fetch thread");
  }
}

// Like a post
export async function likeThread(threadId: string, userId: string) {
  await connectToDatabase();

  try {
    const thread = await Thread.findById(threadId);
    if (!thread) {
      throw new Error("Gönderi bulunamadı");
    }

    if (thread.likedBy.includes(userId)) {
      thread.likes -= 1;
      thread.likedBy.pop(userId);
      await thread.save();
    } else {
      thread.likes += 1;
      thread.likedBy.push(userId);
      await thread.save();
    }
  } catch (err: any) {
    console.error(err.message);
    return null;
  }
}

// Add comment to post
export async function addCommentToPost(
  threadId: string,
  commentText: string,
  userId: string,
  path: string
) {
  await connectToDatabase();

  try {
    const originalThread = await Thread.findById(threadId);

    if (!originalThread) {
      throw new Error("Post not found");
    }

    const commentThread = new Thread({
      text: commentText,
      author: userId,
      parentId: threadId,
    });

    const savedCommentThread = await commentThread.save();

    originalThread.children.push(savedCommentThread._id);

    await originalThread.save();

    revalidatePath(path);
  } catch (err) {
    console.error("Error while adding comment:", err);
    throw new Error("Unable to add comment");
  }
}
