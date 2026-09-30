import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  search: <><circle cx="10.8" cy="10.8" r="7.8" /><path d="m17 17 4.5 4.5" /></>,
  notification: <><path d="M18 8a6 6 0 0 0-12 0c0 6-3 6-3 9h18c0-3-3-3-3-9" /><path d="M10 21h4" /></>,
  community: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-3a7 7 0 0 1 14 0v3H2Zm15-17a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2h-3" /></>,
  user: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2Z" /></>,
  reply: <path d="M21 11a9 9 0 0 1-9 9H8l-5 3 1-6a9 9 0 1 1 17-6Z" />,
  "heart-gray": <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" />,
  "heart-filled": <path fill="currentColor" d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" />,
  share: <><path d="M12 16V2m-5 5 5-5 5 5M4 13v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /></>,
  emoji: <><circle cx="12" cy="12" r="9" /><path d="M8 15a5 5 0 0 0 8 0" /><circle cx="8.5" cy="9" r=".7" fill="currentColor" /><circle cx="15.5" cy="9" r=".7" fill="currentColor" /></>,
  gif: <><rect x="2" y="3" width="20" height="18" rx="4" /><path d="M8 9H5v6h3v-3H7m4-3v6m4 0V9h4m-4 3h3" strokeWidth="1.5" /></>,
  menu: <><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="20" cy="12" r="1" fill="currentColor" /></>,
  refresh: <><path d="M20 7a9 9 0 1 0 1 8M20 2v5h-5" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  back: <path d="M21 12H3m7-7-7 7 7 7" />,
  camera: <><path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.2" /></>,
  logout: <><path d="M9 3H4v18h5m5-5 4-4-4-4m-6 4h13" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  check: <path d="m4 12.5 5 5L20 6.5" />,
};
export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return paths[name] ? <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">{paths[name]}</svg> : <img src={`/assets/${name}.svg`} width={size} height={size} alt="" aria-hidden="true" className="shrink-0 object-contain" />;
}
