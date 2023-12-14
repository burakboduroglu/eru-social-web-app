"use client";
import React, { useEffect, useState } from "react";
import { Spotify } from "react-spotify-embed";
import Link from "next/link";
import DisplayThread from "../shared/DisplayContent";
import YouTubeCard from "../preview/YouTubeCard";

export default function LinkCard({
  url,
  content,
  path,
  id,
}: {
  url: string;
  content: string;
  path: string;
  id: string;
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
    /(https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+(\?si=[a-zA-Z0-9]+)?)/
  );

  const contentUrl = url.match(/.*?(https?:\/\/[^\s]+)/g);
  const withoutLink = content.replace(/(https?:\/\/[^\s]+)/g, "");
  const idPlainObject = JSON.parse(id);
  return (
    <div className="max-w-xl mx-auto sm:max-w-full">
      {videoId ? (
        <div>
          <Link href={`/thread/${idPlainObject}`} className="pb-3">
            <DisplayThread text={withoutLink} />
          </Link>
          <YouTubeCard embedId={videoId} />
        </div>
      ) : (
        contentWithoutLinks && (
          <div className="mb-3">
            {path === "/" && withoutLink.length > 250 ? (
              <div>
                <Link href={`/thread/${idPlainObject}`}>
                  {withoutLink.slice(0, 149)}
                  <span className="text-blue pl-1">
                    ...devamını görüntüleyin.
                  </span>
                </Link>
              </div>
            ) : spotifyLink ? (
              <div>
                <Link href={`/thread/${idPlainObject}`}>
                  <DisplayThread text={withoutLink} />
                  <Spotify link={spotifyLink[0]} className="pt-1 w-25" />
                </Link>
              </div>
            ) : contentUrl ? (
              <div className="w-full">
                <DisplayThread text={withoutLink} />{" "}
                <Link href={contentUrl[0]} className="text-sm text-blue">
                  {contentUrl[0].slice(0, 25)}
                  ...
                </Link>
              </div>
            ) : (
              <Link href={`/thread/${idPlainObject}`}>
                <DisplayThread text={contentWithoutLinks} />
              </Link>
            )}
          </div>
        )
      )}
    </div>
  );
}
