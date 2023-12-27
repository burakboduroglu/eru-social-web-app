import React from "react";
import ReactPlayer from "react-player/lazy";

interface YoutubeEmbedProps {
  embedId: string;
}

const YoutubeEmbed = ({ embedId }: YoutubeEmbedProps) => (
  <div className="aspect-w-16 aspect-h-9">
    <ReactPlayer
      url={`https://www.youtube.com/embed/${embedId}`}
      width={300}
      height={200}
    />
  </div>
);

export default YoutubeEmbed;
