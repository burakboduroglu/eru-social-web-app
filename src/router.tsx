import { LoadingSpinner, usePageTransition, useDelayedLoading } from "./components/loading";
import { RouteError, NotFoundPage } from "./components/page-state";
import { Brand } from "./brand";
import { useState } from "react";
import { createRootRoute, createRoute, createRouter, Outlet, Link, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { api } from "./lib/api";
import { supabase } from "./lib/supabase";
import type { Me } from "../shared/types";
import { AuthPage, ConfirmPage } from "./pages/auth";
import { HomePage, ThreadPageView, ProfilePageView, ProfileEditor, ExplorePage, CommunitiesPage, CreateCommunityPage, CommunityPageView, NotificationsPage, SearchForm } from "./pages/social";
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
  { route: "/", label: "Anasayfa", icon: "home" },
  { route: "/explore", label: "Keşfet", icon: "search" },
  { route: "/notifications", label: "Bildirimler", icon: "notification" },
  { route: "/communities", label: "Topluluklar", icon: "community" },
  { route: "/profile", label: "Profil", icon: "user" },
];
function Shell() {
  const { profile, communities, suggestedCommunities } = useMe();
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
  async function signOut() { const { error } = await supabase.auth.signOut(); if (error) setError("Çıkış yapılamadı."); else window.location.assign("/sign-in"); }
  return <div className="x-shell">
    <aside className="x-sidebar"><Brand /><nav className="x-nav" aria-label="Ana menü">{links.map(link => <Link to={link.to} key={link.to} className={active(link.to) ? "active" : ""} aria-current={active(link.to) ? "page" : undefined}><Icon name={link.icon} size={27} /><span>{link.label}</span></Link>)}</nav>
      <Link to="/" className="x-compose-link" onClick={() => setTimeout(() => document.getElementById("compose-post")?.focus(), 100)}>Gönderi yayınla</Link>
      <div className="x-account"><Link to={`/profile/${profile.id}`} className="row"><Avatar name={profile.name} username={profile.username} src={profile.image} /><span><strong>{profile.name || "Yeni üye"}</strong><small>@{profile.username || "profilini-tamamla"}</small></span></Link><button type="button" onClick={signOut} aria-label="Çıkış yap"><Icon name="logout" size={20} /></button></div><ErrorNotice message={error} />
    </aside>
    <main className="x-main"><div className="x-topbar"><Brand /><button type="button" onClick={signOut} aria-label="Çıkış yap"><Icon name="logout" size={22} /></button></div><div hidden={showSpinner} aria-busy={pageTransition}><Outlet /></div>{showSpinner && <LoadingSpinner label="Sayfa yükleniyor" />}</main>
    <aside className="x-rightbar">{pathname !== "/explore" && <SearchForm initial={exploreQuery} />}<section className="x-suggestions"><h2>Toplulukları keşfet</h2>{suggestedCommunities.length ? suggestedCommunities.map(c => <Link key={c.id} to={`/communities/${c.id}`} className="x-community"><Avatar src={c.image} name={c.name} username={c.username} /><span><strong>{c.name}</strong><small>{c.memberCount} üye</small></span></Link>) : <p>İlgi alanlarına göre yeni insanlarla tanış.</p>}<Link to="/communities" className="x-more">Daha fazla göster</Link></section>{communities.length > 0 && <section className="x-suggestions"><h2>Toplulukların</h2>{communities.slice(0, 4).map(c => <Link key={c.id} to={`/communities/${c.id}`} className="x-community"><Avatar src={c.image} name={c.name} username={c.username} /><strong>{c.name}</strong></Link>)}</section>}<footer>© {new Date().getFullYear()} social-web</footer></aside>
    <nav className="x-mobile-nav" aria-label="Mobil menü">{links.map(link => <Link to={link.to} key={link.to} aria-label={link.label} aria-current={active(link.to) ? "page" : undefined} className={active(link.to) ? "active" : ""}><Icon name={link.icon} size={25} /></Link>)}</nav>
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
    const me = await api<Me>("/me");
    if (!me.profile.onboarded && !["/onboarding", "/profile/edit"].includes(location.pathname)) throw redirect({ to: "/onboarding" });
    return { me };
  },
});
function pagination(search: Record<string, unknown>) {
  const value = Number(search.page || 0);
  return { page: Number.isSafeInteger(value) && value >= 0 && value <= 10000 ? value : 0 };
}
const home = createRoute({ getParentRoute: () => authenticated, path: "/", validateSearch: search => ({ ...pagination(search), feed: search.feed === "communities" ? "communities" : search.feed === "latest" ? "latest" : "all", snapshot: typeof search.snapshot === "string" ? search.snapshot.slice(0, 36) : "" }), loaderDeps: ({ search }) => search, loader: ({ deps }) => api(`/threads?page=${deps.page}&feed=${deps.feed}${deps.snapshot ? `&snapshot=${encodeURIComponent(deps.snapshot)}` : ""}`), component: HomePage });
const onboarding = createRoute({ getParentRoute: () => authenticated, path: "/onboarding", component: ProfileEditor });
const edit = createRoute({ getParentRoute: () => authenticated, path: "/profile/edit", component: ProfileEditor });
const user = createRoute({ getParentRoute: () => authenticated, path: "/profile/$id", validateSearch: search => ({ ...pagination(search), tab: search.tab === "replies" ? "replies" : "posts" }), loaderDeps: ({ search }) => search, loader: ({ params, deps }) => api(`/profiles/${params.id}?tab=${deps.tab}&page=${deps.page}`), component: ProfilePageView });
const thread = createRoute({ getParentRoute: () => authenticated, path: "/thread/$id", validateSearch: pagination, loaderDeps: ({ search }) => search, loader: ({ params, deps }) => api(`/threads/${params.id}?page=${deps.page}`), component: ThreadPageView });
const share = createRoute({ getParentRoute: () => authenticated, path: "/thread/share/$id", loader: ({ params }) => api(`/threads/${params.id}?page=0`), component: SharePage });
const explore = createRoute({ getParentRoute: () => authenticated, path: "/explore", validateSearch: search => ({ q: String(search.q || "").slice(0, 80), tab: search.tab === "people" || search.tab === "communities" ? search.tab : "posts" }), loaderDeps: ({ search }) => ({ q: search.q }), loader: ({ deps }) => api(`/search?q=${encodeURIComponent(deps.q)}`), component: ExplorePage });
const groups = createRoute({ getParentRoute: () => authenticated, path: "/communities", loader: () => api("/communities"), component: CommunitiesPage });
const createGroup = createRoute({ getParentRoute: () => authenticated, path: "/communities/new", component: CreateCommunityPage });
const group = createRoute({ getParentRoute: () => authenticated, path: "/communities/$id", validateSearch: pagination, loaderDeps: ({ search }) => search, loader: ({ params, deps }) => api(`/communities/${params.id}?page=${deps.page}`), component: CommunityPageView });
const notifications = createRoute({ getParentRoute: () => authenticated, path: "/notifications", validateSearch: pagination, loaderDeps: ({ search }) => search, loader: ({ deps }) => api(`/notifications?page=${deps.page}`), component: NotificationsPage });
export const router = createRouter({ routeTree: root.addChildren([signin, signup, confirmRoute, authenticated.addChildren([home, onboarding, edit, user, thread, share, explore, groups, createGroup, group, notifications])]), defaultPreload: "intent", defaultPreloadDelay: 120, defaultErrorComponent: RouteError, defaultNotFoundComponent: NotFoundPage, defaultPendingComponent: LoadingSpinner, defaultPendingMs: Infinity, defaultPendingMinMs: 0 });
