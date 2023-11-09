"use server"

import {connectToDatabase} from "@/lib/mongoose";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import {revalidatePath} from "next/cache";


interface ThreadParams {
    text: string,
    author: string,
    communityId: string | null;
    path: string,
}

export async function createThread({text, author, communityId, path}: ThreadParams){
    try {
        connectToDatabase();

        const createThread = await Thread.create({
            text,
            author,
            community: null,
        });

        await User.findByIdAndUpdate(author, {
            $push: {threads: createThread._id}
        })

        revalidatePath(path);
    } catch (e: any) {
        throw new Error(`Error creating thread: ${e.message}`)
    }
}

export async function getPosts(pageNumber=1, pageSize=20){
    connectToDatabase();
    // Post Skip Calculation
    const skip = (pageNumber - 1)/ pageSize

    // Fetch the top-level threads
    const queryForPosts = Thread.find({parentId: {$in: [null, undefined]}})
        .skip(skip)
        .limit(pageSize)
        .populate({path: 'author', model: User})
        .populate({
            path: 'children',
            populate: {
                path: 'author',
                model: User,
                select: "_id name parentId image"
            }
        })

    const totalPostsCount = await Thread.countDocuments({parentId: {$in: [null, undefined]}})
    const posts = await queryForPosts.exec();
    const isNext = totalPostsCount > skip + posts.length;

    return {posts, isNext};
}

export async function getPostById(id: string){
    connectToDatabase();

    try {
        const post = await Thread.findById(id)
            .populate({
                path: 'author',
                model: User,
                select: "_id id name image"
            })
            .populate({
                path: 'children',
                populate: [
                    {
                        path: 'author',
                        model: User,
                        select: "_id id name parentId image"
                    },
                    {
                        path: 'children',
                        model: Thread,
                        populate: {
                            path: 'author',
                            model: User,
                            select: "_id id name parentId image"
                        }
                    }
                ]
            }).exec();
        return post;
    } catch (e: any) {
        throw new Error(`Error ${e}`)
    }
}