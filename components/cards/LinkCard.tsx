"use client";
import React, { useEffect, useState } from "react";
import YouTube from "react-youtube";
import { Spotify } from "react-spotify-embed";

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
    setContentWithoutLinks(
      content.replace(
        /(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/g,
        ""
      )
    );
  }, [url, content]);

  const opts = {
    height: "200",
    width: "100%",
  };

  const spotifyLink = content.match(
    /(https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+)\b/
  );
  return (
    <div className="max-w-xl mx-auto sm:max-w-full">
      {contentWithoutLinks && (
        <p className="mb-3">
          {path === "/" && content.length > 150 ? (
            <>
              {content.substring(0, content.indexOf("", 125))}
              <span className="text-blue pl-1">...devamını görüntüleyin.</span>
            </>
          ) : spotifyLink ? (
            <Spotify link={spotifyLink[0]} className="h-64 w-96" />
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
