import type { Preferences } from "./types";
export const defaultPreferences: Preferences = { reducedMotion: false, defaultFeed: "all", notificationKind: "all" };
export function effectiveFeed(value: string | undefined, preferences: Preferences) {
  return (["all", "latest", "following", "communities"].includes(value || "") ? value : preferences.defaultFeed) as Preferences["defaultFeed"];
}
export function effectiveNotificationKind(value: string | undefined, preferences: Preferences) {
  return (["all", "reply", "like", "follow"].includes(value || "") ? value : preferences.notificationKind) as Preferences["notificationKind"];
}
