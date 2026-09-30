
const hairTones = ["var(--pixel-hair-1)", "var(--pixel-hair-2)", "var(--pixel-hair-3)", "var(--pixel-hair-4)"];
const outfits = ["var(--pixel-outfit-1)", "var(--pixel-outfit-2)", "var(--pixel-outfit-3)", "var(--pixel-accent)"];
const hairShapes = [
  "M5 4h2v1h2v1h3v2h-2V7H8V6H6v2H4V5h1z",
  "M4 4h2V3h4v1h2v2h-2v1H8V6H6v2H4z",
  "M5 3h5v1h2v2H9V5H7v2H5z",
  "M4 4h2V3h4v1h2v2h-2v1H8V6H6v2H4z",
];

function hashSeed(seed: string | number) {
  const input = String(seed || "guest");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function PixelCharacter({ seed, size = 40, className = "", x, y }: {
  seed: string | number;
  size?: number;
  className?: string;
  x?: number;
  y?: number;
}) {
  const hash = hashSeed(seed);
  const hair = hairTones[hash % hairTones.length];
  const outfit = outfits[(hash >>> 4) % outfits.length];
  const hairShape = hairShapes[(hash >>> 8) % hairShapes.length];
  const accessory = (hash >>> 12) % 3;
  return <svg width={size} height={size} x={x} y={y} viewBox="0 0 16 16" aria-hidden="true" focusable="false" shapeRendering="crispEdges" className={`pixel-character ${className}`}>
    {/* Feet, body, neck, then a blocky head keep the avatar readable at 32px. */}
    <path fill="var(--pixel-ink)" d="M4 13h3v2H4zm6 0h3v2h-3z" />
    <path fill={outfit} d="M4 10h2V9h4v1h2v4h-3v-2H7v2H4z" />
    <path fill={hair} d="M4 3h8v1h2v7h-2V8H5v4H3V5h1z" />
    <path fill="var(--pixel-skin)" d="M5 5h6v4h-1v1H6V9H5zM4 6h1v2H4zm7 0h1v2h-1zM7 10h3v1H7z" />
    <path fill={hair} d={hairShape} />
    <path fill="var(--pixel-ink)" d="M6 7h1v1H6zm3 0h1v1H9z" />
    {accessory === 0 && <path fill="var(--pixel-accent)" d="M11 3h2v2h-2z" />}
    {accessory === 1 && <path fill="var(--pixel-paper)" d="M5 8h1v1H5zm5 0h1v1h-1z" />}
    {accessory === 2 && <path fill="var(--pixel-accent-2)" d="M6 10h4v1H6z" />}
  </svg>;
}
