import home from "pixelarticons/svg/home.svg?raw";
import search from "pixelarticons/svg/search.svg?raw";
import bell from "pixelarticons/svg/bell.svg?raw";
import users from "pixelarticons/svg/users.svg?raw";
import user from "pixelarticons/svg/user.svg?raw";
import calendar from "pixelarticons/svg/calendar.svg?raw";
import reply from "pixelarticons/svg/message-reply.svg?raw";
import heart from "pixelarticons/svg/heart.svg?raw";
import share from "pixelarticons/svg/share.svg?raw";
import smile from "pixelarticons/svg/smile.svg?raw";
import more from "pixelarticons/svg/more-horizontal.svg?raw";
import refresh from "pixelarticons/svg/refresh.svg?raw";
import close from "pixelarticons/svg/close.svg?raw";
import back from "pixelarticons/svg/arrow-left.svg?raw";
import camera from "pixelarticons/svg/camera.svg?raw";
import logout from "pixelarticons/svg/logout.svg?raw";
import chevron from "pixelarticons/svg/chevron-down.svg?raw";
import check from "pixelarticons/svg/check.svg?raw";
import copy from "pixelarticons/svg/copy.svg?raw";
import hide from "pixelarticons/svg/eye-off.svg?raw";
import remove from "pixelarticons/svg/trash.svg?raw";
import bookmark from "pixelarticons/svg/bookmark.svg?raw";
import repost from "pixelarticons/svg/repeat.svg?raw";

const libraryIcons: Record<string, string> = {
  home, search, notification: bell, community: users, user, calendar, reply,
  "heart-gray": heart, share, emoji: smile,
  menu: more, refresh, close, back, camera, logout, chevron, check,
  copy, hide, delete: remove, bookmark, repost,
};

const filledHeart = '<path d="M5 2h4v2H5zM15 2h4v2h-4zM3 4h8v2H3zM13 4h8v2h-8zM1 6h22v6H1zM3 12h18v2H3zM5 14h14v2H5zM7 16h10v2H7zM9 18h6v2H9zM11 20h2v2h-2z"/>';

function iconContents(source: string) {
  return source.replace(/^\s*<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const contents =
    name === "gif"
      ? '<path fill-rule="evenodd" d="M2 3h20v18H2zM4 5v14h16V5z"/><text x="4" y="16" font-family="monospace" font-size="8" font-weight="700" letter-spacing="-1">GIF</text>'
      : name === "heart-filled"
        ? filledHeart
        : iconContents(libraryIcons[name] ?? user);
  // These are explicit, bundled SVG files from Pixelarticons; no remote or user markup is rendered.
  return <svg width={size} height={size} viewBox="0 0 24 24" className="pixel-icon shrink-0" fill="currentColor" aria-hidden="true" shapeRendering="crispEdges" dangerouslySetInnerHTML={{ __html: contents }} />;
}
