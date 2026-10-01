import type { Profile } from "../../shared/types";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Avatar } from "../ui";

export type FollowKind = "followers" | "following";

export function FollowListPage({ profileId, kind, profiles, nextCursor, loading = false }: {
  profileId: string;
  kind: FollowKind;
  profiles: Profile[];
  nextCursor: string | null;
  loading?: boolean;
}) {
  const search = useSearch({ strict: false }) as { cursor?: string; cursorHistory?: string[] };
  const navigate = useNavigate();
  const title = kind === "followers" ? "Takipçiler" : "Takip edilenler";
  const cursor = search.cursor || "";
  const history = Array.isArray(search.cursorHistory) ? search.cursorHistory.filter((item): item is string => typeof item === "string").slice(-20) : [];

  function goTo(next: string, nextHistory: string[]) {
    void navigate({
      to: `/profile/${encodeURIComponent(profileId)}/${kind}`,
      search: { cursor: next, cursorHistory: nextHistory } as never,
    } as never);
  }

  if (loading) return <p className="follow-list-loading" role="status">Yükleniyor…</p>;
  return <section className="follow-list-page">
    <header className="follow-list-heading"><h1>{title}</h1></header>
    {profiles.length ? <div className="follow-list-items">{profiles.map(profile => <LinkProfileRow key={profile.id} profile={profile} />)}</div> : <div className="follow-list-empty">
      <h2>{cursor ? "Bu sayfada kişi yok" : kind === "followers" ? "Henüz takipçi yok" : "Henüz kimseyi takip etmiyor"}</h2>
      <p>{cursor ? "Listenin başına dönerek kişileri görüntüleyebilirsin." : kind === "followers" ? "Bu profil takipçi kazandığında kişiler burada görünür." : "Yeni kişiler keşfetmek için aramaya göz at."}</p>
      {cursor ? <button type="button" className="follow-discover-link" onClick={() => goTo("", [])}>İlk sayfaya dön</button> : kind === "following" && <Link className="follow-discover-link" to="/explore">Kişileri keşfet</Link>}
    </div>}
    {(cursor || nextCursor) && <nav className="follow-list-pagination" aria-label={`${title} sayfaları`}>
      {history.length ? <button type="button" disabled={loading} onClick={() => goTo(history.at(-1) || "", history.slice(0, -1))}>Önceki</button> : cursor ? <button type="button" onClick={() => goTo("", [])}>İlk sayfa</button> : <span />}
      <button type="button" disabled={loading || !nextCursor} onClick={() => nextCursor && goTo(nextCursor, [...history, cursor].slice(-20))}>Sonraki</button>
    </nav>}
  </section>;
}

function LinkProfileRow({ profile }: { profile: Profile }) {
  return <Link to={`/profile/${profile.id}`} className="follow-list-row">
    <Avatar src={profile.image} name={profile.name} username={profile.username} />
    <span className="follow-list-row-copy">
      <strong>{profile.name}</strong>
      <small>@{profile.username}</small>
      {profile.bio && <span>{profile.bio}</span>}
    </span>
  </Link>;
}
