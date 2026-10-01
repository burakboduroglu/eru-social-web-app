import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "@tanstack/react-router";
import "./follows.css";
import { api } from "../lib/api";
import {
  getFollowSnapshot,
  subscribeFollow,
  updateFollow,
  type FollowResult,
} from "../lib/follow-state";
import { Button } from "./ui/button";
import { useMe } from "../ui";

export type FollowButtonProps = {
  profileId: string;
  following: boolean;
  followerCount: number;
  followingCount: number;
  serverSource?: unknown;
  onChange?: (result: FollowResult) => void;
};

export function useFollowSnapshot({
  profileId,
  following,
  followerCount,
  followingCount,
  serverSource,
}: Omit<FollowButtonProps, "onChange">) {
  const userId = useMe().profile.id;
  const subscribe = useCallback(
    (listener: () => void) => subscribeFollow(userId, profileId, listener),
    [profileId, userId],
  );
  const getSnapshot = useCallback(
    () => getFollowSnapshot(userId, profileId, following, followerCount, followingCount, serverSource),
    [followerCount, following, followingCount, profileId, serverSource, userId],
  );
  const serverSnapshot = useMemo(() => ({ following, followerCount, followingCount, pending: false }), [following, followerCount, followingCount]);
  const getServerSnapshot = useCallback(() => serverSnapshot, [serverSnapshot]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function FollowButton({ profileId, following, followerCount, followingCount, serverSource, onChange }: FollowButtonProps) {
  const userId = useMe().profile.id;
  const router = useRouter();
  const [error, setError] = useState("");
  const serverSnapshot = useMemo(() => ({ following, followerCount, followingCount, pending: false }), [following, followerCount, followingCount]);
  const entry = useSyncExternalStore(
    useCallback(listener => subscribeFollow(userId, profileId, listener), [profileId, userId]),
    useCallback(() => getFollowSnapshot(userId, profileId, following, followerCount, followingCount, serverSource), [followerCount, following, followingCount, profileId, serverSource, userId]),
    useCallback(() => serverSnapshot, [serverSnapshot]),
  );

  async function toggle() {
    if (entry.pending) return;
    const next = !entry.following;
    setError("");
    try {
      const changed = await updateFollow(userId, profileId, next, () => api<FollowResult>(
        `/profiles/${encodeURIComponent(profileId)}/follow`, next ? "PUT" : "DELETE", {},
      ));
      if (!changed) return;
      const result = getFollowSnapshot(userId, profileId, next, followerCount, followingCount, serverSource);
      onChange?.({ following: result.following, followerCount: result.followerCount, followingCount: result.followingCount });
      void router.invalidate().catch(() => setError("İşlem kaydedildi ancak profil yenilenemedi."));
    } catch {
      setError("Takip tercihi kaydedilemedi. Tekrar dene.");
    }
  }

  if (profileId === userId) return null;
  return <span className="follow-control">
    <Button
      type="button"
      className={entry.following ? "follow-button is-following" : "follow-button"}
      variant={entry.following ? "outline" : "default"}
      disabled={entry.pending}
      aria-pressed={entry.following}
      onClick={toggle}
    >{entry.pending ? "Güncelleniyor…" : entry.following ? "Takip ediliyor" : "Takip et"}</Button>
    {error && <span className="follow-error" role="status">{error}</span>}
  </span>;
}
