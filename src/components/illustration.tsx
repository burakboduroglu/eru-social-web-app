import { useEffect, useState } from "react";

export type IllustrationName = "empty" | "no-results" | "server-down" | "messages" | "people";
const loaders = import.meta.glob<string>("../assets/illustrations/*.svg", { query: "?raw", import: "default" });
const palette: Record<string, string> = {
  "#6c63ff": "var(--illu-accent)", "#ff6584": "var(--illu-accent-2)", "#fd6584": "var(--illu-accent-2)",
  "#3f3d56": "var(--illu-ink)", "#2f2e41": "var(--illu-ink)", "#090814": "var(--illu-ink)",
  "#ccc": "var(--illu-line)", "#cacaca": "var(--illu-line)", "#cbcbcb": "var(--illu-line)", "#d6d6e3": "var(--illu-line)",
  "#e6e6e6": "var(--illu-soft)", "#e4e4e4": "var(--illu-soft)", "#e2e2e2": "var(--illu-soft)", "#e6e7e8": "var(--illu-soft)", "#f0f0f0": "var(--illu-soft)", "#f2f2f2": "var(--illu-soft)",
  "#fff": "var(--illu-paper)", "#ffffff": "var(--illu-paper)",
};
const cache = new Map<IllustrationName, Promise<string>>();
function load(name: IllustrationName) {
  let pending = cache.get(name);
  if (!pending) {
    pending = loaders[`../assets/illustrations/${name}.svg`]().then(svg => svg
      .replace(/#[0-9a-f]{3,6}\b/gi, hex => palette[hex.toLowerCase()] || hex)
      .replace(/<svg([^>]*?)\s(?:width|height)="[^"]*"/g, "<svg$1")
      .replace(/<svg([^>]*?)\s(?:width|height)="[^"]*"/g, "<svg$1")
      .replace("<svg", '<svg aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet"'));
    cache.set(name, pending);
  }
  return pending;
}
export function Illustration({ name, className = "" }: { name: IllustrationName; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => { let active = true; setSvg(""); load(name).then(value => { if (active) setSvg(value); }, () => {}); return () => { active = false; }; }, [name]);
  // Only bundled, reviewed SVG sources. Never insert remote or user-provided markup.
  return <span className={`illustration ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
