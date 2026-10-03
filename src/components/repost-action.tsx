import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { api } from "../lib/api";
import { getRepostSnapshot, peekRepostSnapshot, subscribeRepost, updateRepost } from "../lib/repost-state";
import { showToast } from "./toast";
import { Icon } from "./icon";
import { useMe } from "../ui";

export function RepostAction({ postId, reposted, repostCount, serverSource, compact = false, canRepost = true }: {
  postId: string;
  reposted: boolean;
  repostCount: number;
  serverSource?: unknown;
  compact?: boolean;
  canRepost?: boolean;
}) {
  const userId = useMe().profile.id;
  const router = useRouter();
  const [error, setError] = useState("");
  const subscribe = useCallback((listener: () => void) => subscribeRepost(userId, postId, listener), [postId, userId]);
  const getSnapshot = useCallback(() => getRepostSnapshot(userId, postId, reposted, repostCount, serverSource), [postId, repostCount, reposted, serverSource, userId]);
  const serverSnapshot = useMemo(() => ({ reposted, repostCount, pending: false }), [repostCount, reposted]);
  const getServerSnapshot = useCallback(() => serverSnapshot, [serverSnapshot]);
  const entry = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  async function toggle() {
    if (entry.pending || (!entry.reposted && !canRepost)) return;
    const next = !entry.reposted;
    const nextCount = Math.max(0, entry.repostCount + (next ? 1 : -1));
    setError("");
    try {
      const changed = await updateRepost(userId, postId, next, nextCount, () => api<{ reposted: boolean; repostCount: number }>(
        `/threads/${encodeURIComponent(postId)}/repost`, next ? "PUT" : "DELETE", {},
      ));
      if (!changed) return;
      const final = peekRepostSnapshot(userId, postId) ?? { reposted: next, repostCount: nextCount, pending: false };
      showToast(final.reposted ? "Yeniden paylaşım yapıldı." : "Yeniden paylaşım geri alındı.");
      void router.invalidate().catch(() => setError("İşlem kaydedildi ancak akış yenilenemedi."));
    } catch {
      setError("Yeniden paylaşım kaydedilemedi. Tekrar dene.");
    }
  }

  return <div className={`repost-action-wrap${compact ? " is-compact" : ""}${entry.repostCount > 0 ? " has-count" : ""}`}>
    <button type="button" className={`repost-action${entry.reposted ? " is-active" : ""}`} aria-label={`${entry.reposted ? "Yeniden paylaşımı geri al" : "Yeniden paylaş"}; ${entry.repostCount} yeniden paylaşım`} aria-pressed={entry.reposted} disabled={entry.pending || (!entry.reposted && !canRepost)} onClick={toggle}>
      <Icon name="repost" size={19} />
      <span>{entry.reposted ? "Yeniden paylaşımı geri al" : "Yeniden paylaş"}</span>
      {entry.repostCount > 0 && <span className="repost-action-count" aria-label={`${entry.repostCount} yeniden paylaşım`}>{entry.repostCount}</span>}
    </button>
    {error && <span className="repost-action-error" role="alert">{error}</span>}
  </div>;
}

export function RepostAttribution({ actor }: { actor: { id: string; name: string; username: string | null } }) {
  const name = actor.name || (actor.username ? `@${actor.username}` : "Kullanıcı");
  const label = `${name}${actor.username ? ` (@${actor.username})` : ""} tarafından yeniden paylaşıldı`;
  return <div className="repost-attribution"><Icon name="repost" size={14} /><Link className="repost-attribution-link" to="/profile/$id" params={{ id: actor.id }} aria-label={label} title={label}>{name} yeniden paylaştı</Link></div>;
}
