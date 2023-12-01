"use client";
import React, { useEffect, useState } from "react";
import YouTube from "react-youtube";

export default function YouTubeCard({
  url,
  content,
  path,
}: {
  url: string;
  content: string;
  path: string;
}) {
  const [videoId, setVideoId] = useState<string | false>(false);
  const [contentWithoutLinks, setContentWithoutLinks] = useState<string>("");

  useEffect(() => {
    const getVideoId = (url: string) => {
      var regExp =
        /(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
      var match = url.match(regExp);
      return match && match[2].length == 11 ? match[2] : false;
    };

    setVideoId(getVideoId(url));
    setContentWithoutLinks(content.replace(/(https?:\/\/[^\s]+)/g, ""));
  }, [url, content]);

  const opts = {
    height: "200",
    width: "100%",
  };

  return (
    <div className="max-w-xl mx-auto sm:max-w-full">
      {contentWithoutLinks && (
        <p className="mb-3">
          {path === "/" && content.length > 150 ? (
            <>
              {content.substring(0, content.indexOf(" ", 125))}
              <span className="text-blue pl-1">...devamını görüntüleyin.</span>
            </>
          ) : (
            contentWithoutLinks
          )}
        </p>
      )}
      {videoId && (
        <YouTube
          videoId={videoId}
          opts={opts}
          className="w-full xs:min-h-96 lg:min-w-[26rem]"
        />
      )}
    </div>
  );
}
