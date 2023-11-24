"use client";
import React, { useEffect, useState } from "react";
import YouTube from "react-youtube";

export default function YouTubeCard({
  url,
  content,
}: {
  url: string;
  content: string;
}) {
  const [videoId, setVideoId] = useState<string | false>(false);
  const [contentWithoutLinks, setContentWithoutLinks] = useState<string>("");

  useEffect(() => {
    const getVideoId = (url: string) => {
      var regExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      var match = url.match(regExp);
      return match && match[2].length == 11 ? match[2] : false;
    };

    setVideoId(getVideoId(url));
    setContentWithoutLinks(content.replace(/(https?:\/\/[^\s]+)/g, ""));
  }, [url, content]);

  const opts = {
    height: "250",
    width: "450",
  };

  return (
    <p className="xs:max-w-1 sm:max-w-full md:max-w-2xl lg:max-w-4xl xl:max-w-6xl">
      {contentWithoutLinks && <p className="mb-3">{contentWithoutLinks}</p>}
      {videoId && <YouTube videoId={videoId} opts={opts} />}
    </p>
  );
}
