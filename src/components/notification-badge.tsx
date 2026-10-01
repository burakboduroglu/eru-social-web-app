import "./activity.css";

export function NotificationBadge({ count }: { count: number }) {
  if (!Number.isFinite(count) || count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return <span className="notification-badge"><span className="sr-only">{count} okunmamış bildirim</span><span aria-hidden="true">{label}</span></span>;
}
