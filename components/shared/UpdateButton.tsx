"use client";
import React from "react";

export default function UpdateButton() {
  const handleClick = () => {
    window.location.reload();
  };

  return (
    <button
      onClick={handleClick}
      className="text-[0.75em] text-white flex items-center justify-center border border-gray-600 p-3 hover:bg-gray-900 rounded-md"
    >
      <span className="font-bold text-blue">Güncelle</span>
    </button>
  );
}
