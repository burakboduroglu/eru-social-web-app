import type { ReactNode } from "react";
import { PixelCharacter } from "./pixel-character";

export type IllustrationName = "empty" | "no-results" | "server-down" | "messages" | "people";

const scenes: Record<IllustrationName, ReactNode> = {
  empty: <>
    <path className="pixel-line" d="M20 92h120v8H20z" />
    <path className="pixel-soft" d="M40 72h24v16H40zm72-12h20v20h-20z" />
    <path className="pixel-paper" d="M34 42h34v32H34z" /><path className="pixel-line" d="M42 50h18v4H42zm0 8h14v4H42" />
    <PixelCharacter seed="empty-state" x={73} y={38} size={48} />
    <path className="pixel-accent" d="M102 38h8v8h-8zm20 18h8v8h-8z" />
  </>,
  "no-results": <>
    <path className="pixel-soft" d="M20 92h120v8H20z" />
    <path className="pixel-paper" d="M47 28h58v48H47z" /><path className="pixel-line" d="M55 38h26v4H55zm0 8h18v4H55" />
    <path className="pixel-accent" d="M91 50h16v4h4v16h-4v4H91v-4h-4V54h4z" />
    <path className="pixel-paper" d="M95 56h8v8h-8z" /><path className="pixel-ink" d="M107 68h4v4h4v4h-4v-4h-4z" />
    <PixelCharacter seed="searching" x={62} y={58} size={46} />
    <path className="pixel-line" d="M31 80h22v5H31z" />
  </>,
  "server-down": <>
    <path className="pixel-soft" d="M20 93h120v8H20z" />
    <path className="pixel-line" d="M27 35h44v20H27zM32 40h7v7h-7zm12 0h7v7h-7zm12 0h10v3H56zm-29 27h44v20H27zM32 72h7v7h-7zm12 0h7v7h-7zm12 0h10v3H56" />
    <path className="pixel-accent" d="M49 54h12v7H49zm0 20h12v7H49z" />
    <PixelCharacter seed="offline" x={83} y={45} size={48} />
    <path className="pixel-accent" d="M113 31h7v7h-7zm14 13h7v7h-7z" />
  </>,
  messages: <>
    <path className="pixel-soft" d="M20 92h120v8H20z" />
    <path className="pixel-paper" d="M23 35h43v30H23z" /><path className="pixel-accent" d="M91 26h46v32H91z" />
    <path className="pixel-line" d="M30 43h28v4H30zm0 8h20v4H30" /><path className="pixel-paper" d="M99 35h27v4H99zm0 8h19v4H99" />
    <PixelCharacter seed="message-friend" x={57} y={45} size={48} />
    <path className="pixel-accent" d="M32 72h8v8h-8zm92-3h7v7h-7z" />
  </>,
  people: <>
    <path className="pixel-soft" d="M20 92h120v8H20z" />
    <PixelCharacter seed="welcome-friend-a" x={35} y={40} size={49} />
    <PixelCharacter seed="welcome-friend-b" x={75} y={32} size={56} />
    <PixelCharacter seed="welcome-friend-c" x={108} y={43} size={45} />
    <path className="pixel-accent" d="M74 24h8v8h-8zm-47 21h7v7h-7zm94-12h7v7h-7z" />
  </>,
};

export function Illustration({ name, className = "" }: { name: IllustrationName; className?: string }) {
  return <span className={`illustration pixel-illustration ${className}`} aria-hidden="true">
    <svg viewBox="0 0 160 120" role="presentation" shapeRendering="crispEdges">{scenes[name]}</svg>
  </span>;
}
