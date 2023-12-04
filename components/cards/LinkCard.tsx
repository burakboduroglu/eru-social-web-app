"use client";
import React, { useEffect, useState } from "react";
import YouTube from "react-youtube";
import { Spotify } from "react-spotify-embed";
import Link from "next/link";

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
        /(https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+)/g,
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

  const contentUrl = url.match(/.*?(https?:\/\/[^\s]+)/g);
  const withoutLink = content.replace(/(https?:\/\/[^\s]+)/g, "");

  return (
    <div className="max-w-xl mx-auto sm:max-w-full">
      {videoId ? (
        <div>
          <div className="pb-3">{contentWithoutLinks}</div>
          <YouTube
            videoId={videoId}
            opts={opts}
            className="w-full xs:min-h-96"
          />
        </div>
      ) : (
        contentWithoutLinks && (
          <div className="mb-3">
            {path === "/" && withoutLink.length > 150 ? (
              <div>
                {withoutLink.slice(0, 149)}
                <span className="text-blue pl-1">
                  ...devamını görüntüleyin.
                </span>
              </div>
            ) : spotifyLink ? (
              <Spotify
                link={spotifyLink[0]}
                className="md:h-64 md:w-96 xs:w-54 xs:h-32 -mb-8"
              />
            ) : contentUrl ? (
              <div>
                {withoutLink}
                <Link href={contentUrl[0]} className="text-sm text-blue">
                  {contentUrl[0].slice(0, 25)}
                  ...
                </Link>
              </div>
            ) : (
              contentWithoutLinks
            )}
          </div>
        )
      )}
    </div>
  );
}
