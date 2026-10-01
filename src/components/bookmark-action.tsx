import { useCallback, useMemo, useSyncExternalStore, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { api } from "../lib/api";
import { getBookmarkSnapshot, peekBookmarkSnapshot, subscribeBookmark, updateBookmark } from "../lib/bookmark-state";
import { showToast } from "./toast";
import { useMe } from "../ui";
import { Icon } from "./icon";

export function BookmarkMenuAction({ postId, bookmarked, serverSource, onClose }: {
  postId: string;
  bookmarked: boolean;
  serverSource?: unknown;
  onClose?: () => void;
}) {
  const userId = useMe().profile.id;
  const router = useRouter();
  const [error, setError] = useState("");
  const subscribe = useCallback((listener: () => void) => subscribeBookmark(userId, postId, listener), [postId, userId]);
  const getSnapshot = useCallback(() => getBookmarkSnapshot(userId, postId, bookmarked, serverSource), [bookmarked, postId, serverSource, userId]);
  const serverSnapshot = useMemo(() => ({ bookmarked, pending: false }), [bookmarked]);
  const getServerSnapshot = useCallback(() => serverSnapshot, [serverSnapshot]);
  const entry = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  async function toggle() {
    if (entry.pending) return;
    const next = !entry.bookmarked;
    setError("");
    try {
      const changed = await updateBookmark(userId, postId, next, () => api<{ bookmarked: boolean }>(
        `/threads/${encodeURIComponent(postId)}/bookmark`, next ? "PUT" : "DELETE",
      ));
      if (!changed) return;
      const saved = peekBookmarkSnapshot(userId, postId)?.bookmarked ?? next;
      showToast(saved ? "Kaydedilenlere eklendi." : "Kaydedilenlerden kaldırıldı.");
      onClose?.();
      void router.invalidate().catch(() => setError("İşlem kaydedildi ancak akış yenilenemedi."));
    } catch {
      setError("Kaydetme tercihi kaydedilemedi. Tekrar dene.");
    }
  }

  return <>
    <button type="button" role="menuitem" aria-label={entry.bookmarked ? "Kaydedilenlerden kaldır" : "Gönderiyi kaydet"} disabled={entry.pending} onClick={toggle}>
      <Icon name="bookmark" size={18} />{entry.bookmarked ? "Kaydedilenlerden kaldır" : "Kaydet"}
    </button>
    {error && <p className="bookmark-action-error" role="status">{error}</p>}
  </>;
}
