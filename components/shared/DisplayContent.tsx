import React from "react";

interface DisplayThreadProps {
  text: string;
}

export default function DisplayThread({ text }: DisplayThreadProps) {
  const formattedText = text.split(/\r?\n/).map((line, index) => (
    <div key={index}>
      {line}
      <br />
    </div>
  ));

  return <div>{formattedText}</div>;
}
