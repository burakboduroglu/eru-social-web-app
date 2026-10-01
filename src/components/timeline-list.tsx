import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { TimelinePage } from "../../shared/types";
import { PostCard } from "../ui";
import { RepostAttribution } from "./repost-action";
import { Button } from "./ui/button";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "./loading";

export function TimelineList({ data, following = false }: { data: TimelinePage; following?: boolean }) {
  const search = useSearch({ strict: false }) as Record<string, unknown> & { cursor?: string; cursorHistory?: string[] };
  const navigate = useNavigate();
  const loading = useContentLoading();
  const showLoading = useDelayedLoading(loading);
  const cursor = search.cursor || "";
  const history = search.cursorHistory || [];
  function goTo(next: string, cursorHistory: string[], fresh = false) {
    void navigate({ search: { ...search, cursor: next, cursorHistory, snapshot: fresh ? "" : data.snapshot } as never });
  }
  return <>
    {showLoading ? <LoadingSpinner /> : data.entries.length ? <div className="x-post-list">{data.entries.map(entry => <div key={entry.post.id} className="timeline-entry">
      {entry.repost && <RepostAttribution actor={{ ...entry.repost.actor, username: entry.repost.actor.username || "" }} />}
      <PostCard post={entry.post} />
    </div>)}</div> : <div className="follow-list-empty">
      <h2>{following && data.followingCount === 0 ? "Henüz kimseyi takip etmiyorsun" : "Bu akışta henüz gönderi yok"}</h2>
      <p>{following ? "Takip ettiğin kişilerin kişisel gönderileri ve yeniden paylaşımları burada görünür. Topluluk gönderileri Toplulukların sekmesindedir." : "Gönderiler ve yeniden paylaşımlar burada görünür."}</p>
      {following && <Link className="follow-discover-link" to="/explore">Kişileri keşfet</Link>}
    </div>}
    {(cursor || data.nextCursor) && <nav className="bookmarks-pagination" aria-label="Akış sayfaları">
      {history.length ? <Button variant="outline" disabled={loading} onClick={() => goTo(history.at(-1) || "", history.slice(0, -1))}>Önceki</Button> : cursor ? <Button variant="outline" disabled={loading} onClick={() => goTo("", [], true)}>İlk sayfa</Button> : <span />}
      <Button variant="outline" disabled={loading || !data.nextCursor} onClick={() => data.nextCursor && goTo(data.nextCursor, [...history, cursor].slice(-20))}>Sonraki</Button>
    </nav>}
  </>;
}
