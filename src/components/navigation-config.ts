export type NavigationDestination = {
  to: string;
  label: string;
  icon: string;
};

export const primaryNavigation: NavigationDestination[] = [
  { to: "/", label: "Ana Sayfa", icon: "home" },
  { to: "/explore", label: "Keşfet", icon: "search" },
  { to: "/notifications", label: "Bildirimler", icon: "notification" },
  { to: "/communities", label: "Topluluklar", icon: "community" },
  { to: "/profile", label: "Profil", icon: "user" },
  { to: "/jobs", label: "İş ilanları", icon: "job" },
  { to: "/articles", label: "Yazılar", icon: "article" },
];

export const mobileNavigation = primaryNavigation.slice(0, 5);

export const secondaryNavigation: NavigationDestination[] = [
  { to: "/lists", label: "Listeler", icon: "list" },
  { to: "/bookmarks", label: "Kaydedilenler", icon: "bookmark" },
  { to: "/saved-searches", label: "Kayıtlı aramalar", icon: "saved-search" },
  { to: "/drafts", label: "Taslaklar", icon: "article" },
  { to: "/events", label: "Etkinlikler", icon: "calendar" },
  { to: "/settings", label: "Ayarlar", icon: "settings" },
  { to: "/analytics", label: "Analizler", icon: "analytics" },
];

export function isNavigationDestinationActive(pathname: string, to: string) {
  if (to === "/") return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}
