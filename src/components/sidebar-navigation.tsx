import { Link, useRouterState } from "@tanstack/react-router";
import { Icon } from "./icon";
import { NotificationBadge } from "./notification-badge";
import { isNavigationDestinationActive, primaryNavigation } from "./navigation-config";
import { MoreNavigation } from "./more-navigation";
import "./sidebar-navigation.css";

type SidebarNavigationProps = {
  profileId: string;
  unreadCount: number;
};

export function SidebarNavigation({ profileId, unreadCount }: SidebarNavigationProps) {
  const pathname = useRouterState({ select: state => state.location.pathname });

  return <>
    {primaryNavigation.map(item => {
      const to = item.to === "/profile" ? `/profile/${profileId}` : item.to;
      const active = isNavigationDestinationActive(pathname, item.to);
      return <Link
        to={to}
        key={item.to}
        className={active ? "active" : ""}
        aria-current={active ? "page" : undefined}
        aria-label={item.to === "/notifications" && unreadCount ? `${item.label}, ${unreadCount} okunmamış bildirim` : item.label}
      >
        <span className="nav-icon"><Icon name={item.icon} size={27} />{item.to === "/notifications" && <NotificationBadge count={unreadCount} />}</span>
        <span>{item.label}</span>
      </Link>;
    })}
    <MoreNavigation />
  </>;
}
