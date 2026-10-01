import { Link } from "@tanstack/react-router";
import type { Notification } from "../../shared/types";
import { Icon } from "./icon";

export type NotificationKind = Notification["kind"];
export type NotificationData = Notification;

function relativeDate(value: string) {
  const date = new Date(value);
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "şimdi";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} sa`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

const iconFor: Record<NotificationKind, string> = { reply: "reply", like: "heart-gray", follow: "user" };

export function NotificationRow({ notification, isRead, pending = false, onMarkRead }: {
  notification: NotificationData;
  isRead: boolean;
  pending?: boolean;
  onMarkRead: (id: string) => void;
}) {
  const actor = notification.actor;
  const action = notification.kind === "reply" ? "gönderine yanıt verdi." : notification.kind === "like" ? "gönderini beğendi." : "seni takip etmeye başladı.";
  const postLink = notification.kind !== "follow" && notification.post?.id;

  return <li className={`activity-row${isRead ? " is-read" : " is-unread"}`}>
    <div className={`activity-kind-icon activity-kind-icon--${notification.kind}`} aria-hidden="true"><Icon name={iconFor[notification.kind]} size={21} /></div>
    <div className="activity-row-content">
      <div className="activity-row-summary">
        {actor ? <Link className="activity-actor" to="/profile/$id" params={{ id: actor.id }}>{actor.name || `@${actor.username}`}</Link> : <span className="activity-actor">Silinmiş hesap</span>}
        <span>{action}</span>
      </div>
      {postLink ? <Link className="activity-post-link" to="/thread/$id" params={{ id: notification.post!.id }}>{notification.post!.text || "Gönderiyi görüntüle"}</Link> : notification.kind !== "follow" ? <p className="activity-unavailable">İlgili gönderi artık görüntülenemiyor.</p> : actor ? <span className="activity-follow-hint">@{actor.username}</span> : <span className="activity-follow-hint">Profil artık görüntülenemiyor.</span>}
      <time className="activity-time" dateTime={notification.createdAt}>{relativeDate(notification.createdAt)}</time>
    </div>
    <div className="activity-row-status">
      {!isRead && <span className="activity-unread-dot" aria-label="Okunmadı" />}
      {(!isRead || pending) && <button type="button" className="activity-read-action" disabled={pending} aria-live="polite" onClick={() => onMarkRead(notification.id)}>{pending ? "Okunuyor…" : "Okundu işaretle"}</button>}
    </div>
  </li>;
}
