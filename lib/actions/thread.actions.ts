"use server"

import {connectToDatabase} from "@/lib/mongoose";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import {revalidatePath} from "next/cache";
import {Simulate} from "react-dom/test-utils";
import error = Simulate.error;

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