"use client"

import {AiOutlineWhatsApp, AiOutlineInstagram} from "react-icons/ai"
import {FaPaperPlane} from "react-icons/fa6"
import Link from "next/link";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Footer from "../shared/Footer";
import { Button } from "../ui/button";


interface ShareCard {
    postId: string
}

export default function ThreadShareCard({postId}: Readonly<ShareCard>) {

    const url=`http:localhost:3000/thread/${postId}`
    const handleCopy = () => {
        navigator.clipboard.writeText(url)
        showToastMessage();
    }
    const showToastMessage = () => {
        toast.success("Bağlantı Kopyalandı!", {
            position: toast.POSITION.TOP_RIGHT,
        });
    };

    return (
        <div className="flex flex-col justify-center items-center text-white">
            <h1 className="head-text">Gönderiyi Paylaş</h1>
            <article className="flex w-full flex-col items-center rounded-xl bg-dark-2 p-7 mt-3 ">
                <div className="flex hover:cursor-pointer gap-5 items-center">
                    <Button onClick={handleCopy}
                       className=" flex flex-col justify-center gap-3  pl-2 pr-2 mt-1 text-[.85em] rounded-xl border border-red-300 hover:bg-red-300 hover:cursor-pointer hover:text-black text-zinc-100 ">
                        Kopyala
                    </Button>
                    <Link href="https://web.whatsapp.com/" target="_blank" className="text-green-500">
                        <AiOutlineWhatsApp size={48}/>
                    </Link>
                    <Link href="https://www.instagram.com/" target="_blank"
                          className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl">
                        <AiOutlineInstagram size={48}/>
                    </Link>
                </div>
            </article>
            <div className="mt-20">
                <FaPaperPlane size={108}/>
            </div>
            <ToastContainer limit={3} theme={"dark"} autoClose={1500}/>
            <Footer />
        </div>
    )
}
