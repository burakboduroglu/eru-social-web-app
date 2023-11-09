"use client"

import {AiOutlineWhatsApp, AiOutlineInstagram} from "react-icons/ai"
import Link from "next/link";
import {useState} from "react";

interface ShareCard{
    postId: string
}

export default async function ThreadShareCard({postId}: ShareCard) {
    const [url, setUrl] = useState(`http:localhost:3000/thread/${postId}`)
    const handleCopy = () => {
        setUrl(`http:localhost:3000/thread/${postId}`)
        navigator.clipboard.writeText(url)
    }
    return (
        <div>
            <h1 className="head-text">Share the post via</h1>
            <div className="flex justify-center rounded-xl bg-dark-2 p-3 mt-3 text-zinc-100 gap-8">
                <p className="flex items-center p-2 border border-white rounded-xl text-[.95em] text-red-300 ">{url}</p>
                <p onClick={handleCopy} className="p-2 text-[.95em] rounded-xl border border-red-300 hover:bg-red-300 hover:cursor-pointer hover:text-black">
                    Copy Link
                </p>
            </div>

            <article className="flex w-full flex-col  items-center rounded-xl bg-dark-2 p-7 mt-3 ">
                <div className="flex hover:cursor-pointer gap-5">
                    <Link href="https://web.whatsapp.com/" target="_blank" className="text-green-500">
                        <AiOutlineWhatsApp size={48}/>
                    </Link>
                    <Link href="https://www.instagram.com/" target="_blank"
                          className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl">
                        <AiOutlineInstagram size={48}/>
                    </Link>
                </div>
            </article>
        </div>
    )
}
