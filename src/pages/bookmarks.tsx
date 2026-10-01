import { Link, useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import { useDelayedLoading, useContentLoading, LoadingSpinner } from "../components/loading";
import { StatePanel } from "../components/page-state";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import type { BookmarksPage as BookmarksPageData } from "../../shared/types";
import { PostCard } from "../ui";
import "../components/bookmarks.css";

type BookmarkSearch = { cursor?: string; cursorHistory?: string[] };

export function BookmarksPage() {
  const data = useLoaderData({ strict: false }) as BookmarksPageData;
  const search = useSearch({ strict: false }) as BookmarkSearch;
  const navigate = useNavigate();
  const loading = useContentLoading();
  const showLoading = useDelayedLoading(loading);
  const cursor = search.cursor || "";
  const history = Array.isArray(search.cursorHistory) ? search.cursorHistory.slice(-20) : [];

  function goTo(cursorValue: string, cursorHistory: string[]) {
    void navigate({ to: "/bookmarks", search: { cursor: cursorValue, cursorHistory } as never });
  }

  if (showLoading) return <LoadingSpinner />;
  return <section className="bookmarks-page">
    <header className="bookmarks-heading">
      <h1>Kaydedilenler</h1>
      <p>Kaydettiğin gönderileri yalnızca sen görebilirsin.</p>
    </header>
    {data.posts.length ? <div className="x-post-list">{data.posts.map(post => <PostCard key={post.id} post={post} />)}</div> : !cursor && !data.nextCursor ? <div className="bookmarks-empty">
      <StatePanel kind="empty" title="Henüz kaydedilmiş gönderi yok" description="Bir gönderinin seçeneklerinden Kaydet'i seç. Kaydettiklerin burada yalnızca sana görünür." action={<Button variant="outline" asChild><Link to="/">Ana sayfaya dön</Link></Button>} />
    </div> : <div className="bookmarks-empty"><StatePanel kind="no-results" title="Bu sayfada gönderi yok" description="Kaydedilenler listesinin ilk sayfasına dönerek diğer gönderileri görüntüleyebilirsin." action={<Button variant="outline" onClick={() => goTo("", [])}>İlk sayfaya dön</Button>} /></div>}
    {(cursor || data.nextCursor) && <nav className="bookmarks-pagination" aria-label="Kaydedilen gönderi sayfaları">
      {history.length > 0 ? <Button variant="outline" disabled={loading} onClick={() => {
        const previous = history.at(-1) || "";
        goTo(previous, history.slice(0, -1));
      }}>Önceki</Button> : cursor ? <Button variant="outline" onClick={() => goTo("", [])}>İlk sayfa</Button> : <span />}
      <Button variant="outline" disabled={loading || !data.nextCursor} onClick={() => data.nextCursor && goTo(data.nextCursor, [...history, cursor].slice(-20))}>Sonraki</Button>
    </nav>}
  </section>;
}

export async function loadBookmarks(cursor: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return api<BookmarksPageData>(`/bookmarks${query}`);
}
