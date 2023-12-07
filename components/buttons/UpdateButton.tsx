"use client";
import Link from "next/link";
import React from "react";
import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";

export default function UpdateButton() {
  return (
    <div>
      <Link
        href="/"
        className="text-[0.75em] text-white flex items-center justify-center border border-gray-600 p-3 hover:bg-gray-900 rounded-md"
        onClick={() => {
          toast.info("Akış güncelleniyor");
        }}
      >
        <span className="font-bold text-blue">Güncelle</span>
      </Link>
    </div>
  );
}