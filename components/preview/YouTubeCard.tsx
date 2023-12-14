import React from "react";
interface YoutubeEmbedProps {
  embedId: string;
}

const YoutubeEmbed = ({ embedId }: YoutubeEmbedProps) => (
  <div className="aspect-w-16 aspect-h-9">
    <iframe
      width="853"
      height="480"
      src={`https://www.youtube.com/embed/${embedId}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title="Embedded youtube"
      className="rounded-lg w-full h-full"
    />
  </div>
);

export default YoutubeEmbed;
