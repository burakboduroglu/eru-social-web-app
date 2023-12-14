"use client";

import React from "react";
import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

export default function UpdateButton() {
  const router = useRouter();

  return (
    <div>
      <div
        className="text-[0.75em] text-white flex items-center justify-center border border-gray-600 p-3 hover:bg-gray-900 rounded-md"
        onClick={() => {
          toast.info("Akış güncelleniyor");
          router.push("/");
          setTimeout(() => {
            toast.success("Akış güncellendi");
          }, 1500);
        }}
      >
        <span className="font-bold text-blue">Güncelle</span>
      </div>
    </div>
  );
}
