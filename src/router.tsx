import { LoadingSpinner, usePageTransition, useDelayedLoading } from "./components/loading";
import { RouteError, NotFoundPage } from "./components/page-state";
import { Brand } from "./brand";
import { AccountMenu } from "./components/account-menu";
import { DiscoverySidebar } from "./components/discovery-sidebar";
import { BookmarksPage, loadBookmarks } from "./pages/bookmarks";
import { clearComposerDraftsForAccount, hasComposerDraftsForAccount } from "./lib/composer-draft";
import { FollowListPage } from "./components/follow-list";
import { useContentLoading } from "./components/loading";
import { useState } from "react";
import { createRootRoute, createRoute, createRouter, Outlet, Link, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { api } from "./lib/api";
import { supabase } from "./lib/supabase";
import type { Me, ProfileListPage, ProfilePage, TimelinePage } from "../shared/types";
import { useLoaderData, useParams } from "@tanstack/react-router";
import { ActivityPage, loadActivity } from "./pages/activity";
import { NotificationBadge } from "./components/notification-badge";
import { AuthPage, ConfirmPage } from "./pages/auth";
import { HomePage, ThreadPageView, ProfilePageView, ProfileEditor, ExplorePage, CommunitiesPage, CreateCommunityPage, CommunityPageView, SearchForm } from "./pages/social";
import { SharePage } from "./pages/share";
import { Avatar, ErrorNotice, Icon, useMe } from "./ui";

const root = createRootRoute({ component: Outlet, pendingComponent: LoadingSpinner, pendingMs: 0, errorComponent: RouteError, notFoundComponent: NotFoundPage });
// A live session makes the auth screens pointless, so send those visits home.
async function redirectIfSignedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) throw redirect({ to: "/" });
}
const signin = createRoute({ getParentRoute: () => root, path: "/sign-in", beforeLoad: redirectIfSignedIn, component: () => <AuthPage /> });
const signup = createRoute({ getParentRoute: () => root, path: "/sign-up", beforeLoad: redirectIfSignedIn, component: () => <AuthPage signup /> });
const confirmRoute = createRoute({
  getParentRoute: () => root, path: "/auth/confirm", component: ConfirmPage,
  validateSearch: (search: Record<string, unknown>) => ({ token_hash: String(search.token_hash || ""), type: String(search.type || ""), code: String(search.code || "") }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    let error: unknown = new Error("Invalid confirmation link");
    if (deps.token_hash && deps.type === "email") ({ error } = await supabase.auth.verifyOtp({ token_hash: deps.token_hash, type: "email" }));
    else if (deps.code) ({ error } = await supabase.auth.exchangeCodeForSession(deps.code));
    if (error) throw new Error("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
    throw redirect({ to: "/onboarding" });
  },
});

const sidebarLinks = [
  { route: "/", label: "Ana Sayfa", icon: "home" },
  { route: "/explore", label: "Keşfet", icon: "search" },
  { route: "/notifications", label: "Bildirimler", icon: "notification" },
  { route: "/communities", label: "Topluluklar", icon: "community" },
  { route: "/profile", label: "Profil", icon: "user" },
];
function Shell() {
  const { profile, communities, suggestedCommunities } = useMe();
  const unreadCount = useRouterState({ select: state => (state.matches.find(match => match.routeId === "/authenticated")?.loaderData as { unreadCount?: number } | undefined)?.unreadCount ?? 0 });
  const pathname = useRouterState({ select: state => state.location.pathname });
  const exploreQuery = useRouterState({
    select: (state): string => {
      const search = state.location.search as { q?: unknown };
      return state.location.pathname === "/explore" && typeof search.q === "string" ? search.q : "";
    },
  });
  const [error, setError] = useState("");
  const pageTransition = usePageTransition();
  const showSpinner = useDelayedLoading(pageTransition);
  const links = sidebarLinks.map(link => ({ ...link, to: link.route === "/profile" ? `/profile/${profile.id}` : link.route }));
  const active = (to: string) => to === "/" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  async function signOut() {
    if (hasComposerDraftsForAccount(profile.id) && !window.confirm("Taslak silinsin ve çıkış yapılsın mı?")) return;
    const { error } = await supabase.auth.signOut();
    if (error) setError("Çıkış yapılamadı.");
    else { clearComposerDraftsForAccount(profile.id); window.location.assign("/sign-in"); }
  }
  return <div className="x-shell">
    <aside className="x-sidebar"><Brand /><nav className="x-nav" aria-label="Ana menü">{links.map(link => <Link to={link.to} key={link.to} className={active(link.to) ? "active" : ""} aria-current={active(link.to) ? "page" : undefined}><span className="nav-icon"><Icon name={link.icon} size={27} />{link.route === "/notifications" && <NotificationBadge count={unreadCount} />}</span><span>{link.label}</span></Link>)}</nav>
      <Link to="/" className="x-compose-link" onClick={() => setTimeout(() => document.getElementById("compose-post")?.focus(), 100)}>Gönderi yayınla</Link>
      <div className="x-account"><Link to={`/profile/${profile.id}`} className="row"><Avatar name={profile.name} username={profile.username} src={profile.image} /><span><strong>{profile.name || "Yeni üye"}</strong><small>@{profile.username || "profilini-tamamla"}</small></span></Link><AccountMenu onSignOut={signOut} /></div><ErrorNotice message={error} />
    </aside>
    <main className="x-main"><div className="x-topbar"><Brand /><AccountMenu onSignOut={signOut} /></div><div hidden={showSpinner} aria-busy={pageTransition}><Outlet /></div>{showSpinner && <LoadingSpinner label="Sayfa yükleniyor" />}</main>
    <aside className="x-rightbar">{pathname !== "/explore" && <SearchForm initial={exploreQuery} />}<DiscoverySidebar suggested={suggestedCommunities} joined={communities} /><footer>© {new Date().getFullYear()} social-web</footer></aside>
    <nav className="x-mobile-nav" aria-label="Mobil menü">{links.map(link => <Link to={link.to} key={link.to} aria-label={link.route === "/notifications" && unreadCount ? `${link.label}, ${unreadCount} okunmamış bildirim` : link.label} aria-current={active(link.to) ? "page" : undefined} className={active(link.to) ? "active" : ""}><span className="nav-icon"><Icon name={link.icon} size={25} />{link.route === "/notifications" && <NotificationBadge count={unreadCount} />}</span></Link>)}</nav>
  </div>;
}

const authenticated = createRoute({
  getParentRoute: () => root, id: "authenticated", component: Shell, pendingComponent: LoadingSpinner, pendingMs: 0,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/sign-in" });
  },
  // Parent and child loaders run together, so the profile request no longer
  // blocks the feed request on every navigation.
  loader: async ({ location }) => {
    const [me, activity] = await Promise.all([api<Me>("/me"), api<{ unreadCount: number }>("/notifications/unread").catch(() => ({ unreadCount: 0 }))]);
    if (!me.profile.onboarded && !["/onboarding", "/profile/edit"].includes(location.pathname)) throw redirect({ to: "/onboarding" });
    return { me, unreadCount: activity.unreadCount };
  },
});
function pagination(search: Record<string, unknown>) {
  const value = Number(search.page || 0);
  return { page: Number.isSafeInteger(value) && value >= 0 && value <= 10000 ? value : 0 };
}
export function cursorSearch(search: Record<string, unknown>) {
  const cursor = typeof search.cursor === "string" ? search.cursor.slice(0, 1024) : "";
  const cursorHistory = Array.isArray(search.cursorHistory) ? search.cursorHistory.filter((item): item is string => typeof item === "string" && item.length <= 1024).slice(-20) : [];
  return { cursor, cursorHistory };
}
const bookmarksRoute = createRoute({ getParentRoute: () => authenticated, path: "/bookmarks", validateSearch: cursorSearch, loaderDeps: ({ search }) => ({ cursor: search.cursor }), loader: ({ deps }) => loadBookmarks(deps.cursor), component: BookmarksPage });
const home = createRoute({
  getParentRoute: () => authenticated, path: "/",
  validateSearch: search => ({ ...pagination(search), ...cursorSearch(search), feed: search.feed === "communities" ? "communities" : search.feed === "following" ? "following" : search.feed === "latest" ? "latest" : "all", snapshot: typeof search.snapshot === "string" ? search.snapshot.slice(0, 36) : "" }),
  loaderDeps: ({ search }) => ({ page: search.page, feed: search.feed, snapshot: search.snapshot, cursor: search.cursor }),
  loader: ({ deps }) => api(`/threads?page=${deps.page}&feed=${deps.feed}${deps.snapshot ? `&snapshot=${encodeURIComponent(deps.snapshot)}` : ""}${deps.feed === "following" && deps.cursor ? `&cursor=${encodeURIComponent(deps.cursor)}` : ""}`),
  component: HomePage,
});
const onboarding = createRoute({ getParentRoute: () => authenticated, path: "/onboarding", component: ProfileEditor });
const edit = createRoute({ getParentRoute: () => authenticated, path: "/profile/edit", component: ProfileEditor });
const user = createRoute({
  getParentRoute: () => authenticated, path: "/profile/$id",
  validateSearch: search => ({ ...pagination(search), ...cursorSearch(search), tab: search.tab === "replies" ? "replies" : "posts", snapshot: typeof search.snapshot === "string" ? search.snapshot.slice(0, 36) : "" }),
  loaderDeps: ({ search }) => ({ page: search.page, tab: search.tab, snapshot: search.snapshot, cursor: search.cursor }),
  loader: async ({ params, deps }) => {
    const [profile, timeline] = await Promise.all([
      api<ProfilePage>(`/profiles/${params.id}?tab=${deps.tab}&page=${deps.page}`),
      deps.tab === "posts" ? api<TimelinePage>(`/profiles/${params.id}/timeline${deps.snapshot ? `?snapshot=${encodeURIComponent(deps.snapshot)}${deps.cursor ? `&cursor=${encodeURIComponent(deps.cursor)}` : ""}` : ""}`) : undefined,
    ]);
    return { ...profile, timeline };
  },
  component: ProfilePageView,
});
function FollowRoutePage({ kind }: { kind: "followers" | "following" }) {
  const data = useLoaderData({ strict: false }) as ProfileListPage;
  const params = useParams({ strict: false }) as { id: string };
  const loading = useDelayedLoading(useContentLoading());
  return <FollowListPage profileId={params.id} kind={kind} {...data} loading={loading} />;
}
const followersRoute = createRoute({ getParentRoute: () => authenticated, path: "/profile/$id/followers", validateSearch: cursorSearch, loaderDeps: ({ search }) => ({ cursor: search.cursor }), loader: ({ params, deps }) => api(`/profiles/${params.id}/followers${deps.cursor ? `?cursor=${encodeURIComponent(deps.cursor)}` : ""}`), component: () => <FollowRoutePage kind="followers" /> });
const followingRoute = createRoute({ getParentRoute: () => authenticated, path: "/profile/$id/following", validateSearch: cursorSearch, loaderDeps: ({ search }) => ({ cursor: search.cursor }), loader: ({ params, deps }) => api(`/profiles/${params.id}/following${deps.cursor ? `?cursor=${encodeURIComponent(deps.cursor)}` : ""}`), component: () => <FollowRoutePage kind="following" /> });
const thread = createRoute({ getParentRoute: () => authenticated, path: "/thread/$id", validateSearch: pagination, loaderDeps: ({ search }) => search, loader: ({ params, deps }) => api(`/threads/${params.id}?page=${deps.page}`), component: ThreadPageView });
const share = createRoute({ getParentRoute: () => authenticated, path: "/thread/share/$id", loader: ({ params }) => api(`/threads/${params.id}?page=0`), component: SharePage });
const explore = createRoute({ getParentRoute: () => authenticated, path: "/explore", validateSearch: search => ({ q: String(search.q || "").slice(0, 80), tab: search.tab === "people" || search.tab === "communities" ? search.tab : "posts" }), loaderDeps: ({ search }) => ({ q: search.q }), loader: ({ deps }) => api(`/search?q=${encodeURIComponent(deps.q)}`), component: ExplorePage });
const groups = createRoute({ getParentRoute: () => authenticated, path: "/communities", loader: () => api("/communities"), component: CommunitiesPage });
const createGroup = createRoute({ getParentRoute: () => authenticated, path: "/communities/new", component: CreateCommunityPage });
const group = createRoute({ getParentRoute: () => authenticated, path: "/communities/$id", validateSearch: pagination, loaderDeps: ({ search }) => search, loader: ({ params, deps }) => api(`/communities/${params.id}?page=${deps.page}`), component: CommunityPageView });
const notifications = createRoute({ getParentRoute: () => authenticated, path: "/notifications", validateSearch: search => ({ ...cursorSearch(search), kind: (search.kind === "reply" || search.kind === "like" || search.kind === "follow" ? search.kind : "all") as "reply" | "like" | "follow" | "all" }), loaderDeps: ({ search }) => ({ kind: search.kind, cursor: search.cursor }), loader: ({ deps }) => loadActivity(deps.kind, deps.cursor), component: ActivityPage });
export const router = createRouter({ routeTree: root.addChildren([signin, signup, confirmRoute, authenticated.addChildren([home, onboarding, edit, user, followersRoute, followingRoute, thread, share, explore, groups, createGroup, group, notifications, bookmarksRoute])]), defaultPreload: "intent", defaultPreloadDelay: 120, defaultErrorComponent: RouteError, defaultNotFoundComponent: NotFoundPage, defaultPendingComponent: LoadingSpinner, defaultPendingMs: Infinity, defaultPendingMinMs: 0 });
