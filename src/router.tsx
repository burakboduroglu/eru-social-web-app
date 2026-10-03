import { SidebarNavigation } from "./components/sidebar-navigation";
import { mobileNavigation } from "./components/navigation-config";
import { DiscussionsPage, DiscussionDetailPage, loadSubjects, loadSubject } from "./pages/discussions";
import { EventsPage, EventFormPage, EventDetailPage, loadEvents } from "./pages/events";
import { AnalyticsPage, loadAnalytics } from "./pages/analytics";
import { SettingsPage } from "./pages/settings";
import { defaultPreferences, effectiveFeed, effectiveNotificationKind } from "../shared/preferences";
import { DraftsPage, loadDrafts } from "./pages/drafts";
import { ArticlesPage, ArticleFormPage, ArticleDetailPage, loadArticles } from "./pages/articles";
import { JobsPage, JobFormPage, JobDetailPage, JobRouteError, loadJobs, loadJobDetail, jobSearch } from "./pages/jobs";
import { LoadingSpinner, usePageTransition, useDelayedLoading } from "./components/loading";
import { RouteError, NotFoundPage } from "./components/page-state";
import { Brand } from "./brand";
import { MoreNavigation } from "./components/more-navigation";
import { AccountMenu } from "./components/account-menu";
import { DiscoverySidebar } from "./components/discovery-sidebar";
import { FeatureSidebar, hasFeatureSidebar } from "./components/feature-sidebar";
import { BookmarksPage, loadBookmarks } from "./pages/bookmarks";
import { ListsPage, ListFormPage, ListDetailPage, loadLists, loadList, loadListContent } from "./pages/lists";
import { SavedSearchesPageView, loadSavedSearches } from "./pages/saved-searches";
import { clearComposerDraftsForAccount, hasComposerDraftsForAccount } from "./lib/composer-draft";
import { FollowListPage } from "./components/follow-list";
import { useContentLoading } from "./components/loading";
import { useState, useEffect } from "react";
import { createRootRoute, createRoute, createRouter, Outlet, Link, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { api } from "./lib/api";
import { supabase } from "./lib/supabase";
import type { Preferences, Me, ProfileListPage, ProfilePage, TimelinePage } from "../shared/types";
import { useLoaderData, useParams } from "@tanstack/react-router";
import { ActivityPage, loadActivity } from "./pages/activity";
import { NotificationBadge } from "./components/notification-badge";
import { AuthPage, ConfirmPage } from "./pages/auth";
import { HomePage, ThreadPageView, ProfilePageView, ProfileEditor, ExplorePage, CommunitiesPage, CreateCommunityPage, CommunityPageView, SearchForm } from "./pages/social";
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


function Shell() {
  const { profile, communities, suggestedCommunities } = useMe();
  const preferences=useRouterState({select:state=>(state.matches.find(match=>match.routeId==="/authenticated")?.loaderData as {preferences?:Preferences}|undefined)?.preferences||defaultPreferences});
  useEffect(()=>{document.documentElement.dataset.reducedMotion=String(preferences.reducedMotion);return()=>{delete document.documentElement.dataset.reducedMotion;};},[preferences.reducedMotion]);
  const unreadCount = useRouterState({ select: state => (state.matches.find(match => match.routeId === "/authenticated")?.loaderData as { unreadCount?: number } | undefined)?.unreadCount ?? 0 });
  const pathname = useRouterState({ select: state => state.location.pathname });
  const resolvedPathname = useRouterState({ select: state => state.resolvedLocation?.pathname || "" });
  const isJobsBrowsing = (path: string) => path === "/jobs" || /^\/jobs\/[^/]+$/.test(path) && path !== "/jobs/new";
  const jobsBrowsing = isJobsBrowsing(pathname);
  const keepJobsContent = jobsBrowsing && isJobsBrowsing(resolvedPathname);
  const exploreQuery = useRouterState({
    select: (state): string => {
      const search = state.location.search as { q?: unknown };
      return state.location.pathname === "/explore" && typeof search.q === "string" ? search.q : "";
    },
  });
  const [error, setError] = useState("");
  const pageTransition = usePageTransition();
  const showSpinner = useDelayedLoading(pageTransition && !keepJobsContent);
  const links = mobileNavigation.map(link => ({ ...link, to: link.to === "/profile" ? `/profile/${profile.id}` : link.to }));
  const active = (to: string) => to === "/" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  async function signOut() {
    if (hasComposerDraftsForAccount(profile.id) && !window.confirm("Taslak silinsin ve çıkış yapılsın mı?")) return;
    const { error } = await supabase.auth.signOut();
    if (error) setError("Çıkış yapılamadı.");
    else { clearComposerDraftsForAccount(profile.id); window.location.assign("/sign-in"); }
  }
  return <div className={`x-shell${jobsBrowsing ? " x-shell-jobs" : pathname.startsWith("/jobs/") ? " x-shell-jobs-editor" : ""}`}>
    <aside className="x-sidebar"><Brand /><nav className="x-nav" aria-label="Ana menü"><SidebarNavigation profileId={profile.id} unreadCount={unreadCount} /></nav>
      <Link to="/" className="x-compose-link" onClick={() => setTimeout(() => document.getElementById("compose-post")?.focus(), 100)}>Gönderi yayınla</Link>
      <div className="x-account"><Link to={`/profile/${profile.id}`} className="row"><Avatar name={profile.name} username={profile.username} src={profile.image} /><span><strong>{profile.name || "Yeni üye"}</strong><small>@{profile.username || "profilini-tamamla"}</small></span></Link><AccountMenu onSignOut={signOut} /></div><ErrorNotice message={error} />
    </aside>
    <main className="x-main"><div className="x-topbar"><Brand /><div className="x-topbar-actions"><MoreNavigation compact /><AccountMenu onSignOut={signOut} /></div></div><div hidden={showSpinner} aria-busy={pageTransition}><Outlet /></div>{showSpinner && <LoadingSpinner label="Sayfa yükleniyor" />}</main>
    <aside className="x-rightbar">{hasFeatureSidebar(pathname) ? <FeatureSidebar pathname={pathname} /> : <>{pathname !== "/explore" && <SearchForm initial={exploreQuery} />}<DiscoverySidebar suggested={suggestedCommunities} joined={communities} /></>}<footer>© {new Date().getFullYear()} social-web</footer></aside>
    <nav className="x-mobile-nav" aria-label="Mobil menü">{links.map(link => <Link to={link.to} key={link.to} aria-label={link.to === "/notifications" && unreadCount ? `${link.label}, ${unreadCount} okunmamış bildirim` : link.label} aria-current={active(link.to) ? "page" : undefined} className={active(link.to) ? "active" : ""}><span className="nav-icon"><Icon name={link.icon} size={25} />{link.to === "/notifications" && <NotificationBadge count={unreadCount} />}</span></Link>)}</nav>
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
    const [me, activity, preferences] = await Promise.all([api<Me>("/me"), api<{ unreadCount: number }>("/notifications/unread").catch(() => ({ unreadCount: 0 })), api<Preferences>("/preferences").catch(()=>defaultPreferences)]);
    if (!me.profile.onboarded && !["/onboarding", "/profile/edit"].includes(location.pathname)) throw redirect({ to: "/onboarding" });
    return { me, unreadCount: activity.unreadCount, preferences };
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
const listsRoute = createRoute({ getParentRoute: () => authenticated, path: "/lists", validateSearch: cursorSearch, loaderDeps: ({ search }) => ({ cursor: search.cursor }), loader: ({ deps }) => loadLists(deps.cursor), component: ListsPage });
const createListRoute = createRoute({ getParentRoute: () => authenticated, path: "/lists/new", component: () => <ListFormPage mode="create" /> });
const editListRoute = createRoute({ getParentRoute: () => authenticated, path: "/lists/$id/edit", loader: ({ params }) => loadList(params.id), component: () => {
  const { id } = useParams({ strict: false }) as { id: string };
  return <ListFormPage key={id} mode="edit" />;
} });
const listRoute = createRoute({
  getParentRoute: () => authenticated, path: "/lists/$id",
  validateSearch: search => ({ ...cursorSearch(search), tab: search.tab === "members" ? "members" as const : "posts" as const, snapshot: typeof search.snapshot === "string" ? search.snapshot.slice(0, 36) : "" }),
  loaderDeps: ({ search }) => ({ cursor: search.cursor, tab: search.tab, snapshot: search.snapshot }),
  loader: ({ params, deps }) => loadListContent(params.id, deps), component: ListDetailPage,
});
const savedSearchesRoute = createRoute({ getParentRoute: () => authenticated, path: "/saved-searches", validateSearch: cursorSearch, loaderDeps: ({ search }) => ({ cursor: search.cursor }), loader: ({ deps }) => loadSavedSearches(deps.cursor), component: SavedSearchesPageView });
const jobsSearch = (s: Record<string, unknown>) => ({ ...cursorSearch(s), ...jobSearch(s) });
const jobsRoute=createRoute({getParentRoute:()=>authenticated,path:"/jobs",validateSearch:jobsSearch,loaderDeps:({search})=>search,loader:({deps})=>loadJobs(deps),component:JobsPage,errorComponent:JobRouteError});
const jobNewRoute=createRoute({getParentRoute:()=>authenticated,path:"/jobs/new",validateSearch:jobsSearch,component:JobFormPage});
const jobEditRoute=createRoute({getParentRoute:()=>authenticated,path:"/jobs/$id/edit",validateSearch:jobsSearch,loader:({params})=>api(`/jobs/${params.id}`),component:()=> <JobFormPage edit/>});
const jobDetailRoute=createRoute({getParentRoute:()=>authenticated,path:"/jobs/$id",validateSearch:jobsSearch,loaderDeps:({search})=>search,loader:({params,deps})=>loadJobDetail(params.id,deps),component:JobDetailPage,errorComponent:JobRouteError});
const articleSearch = (s: Record<string, unknown>) => ({ ...cursorSearch(s), filter: s.filter === "mine" ? "mine" : "all" });
const articlesRoute=createRoute({getParentRoute:()=>authenticated,path:"/articles",validateSearch:articleSearch,loaderDeps:({search})=>search,loader:({deps})=>loadArticles(deps),component:ArticlesPage});
const articleNewRoute=createRoute({getParentRoute:()=>authenticated,path:"/articles/new",validateSearch:articleSearch,component:ArticleFormPage});
const articleEditRoute=createRoute({getParentRoute:()=>authenticated,path:"/articles/$id/edit",validateSearch:articleSearch,loader:({params})=>api(`/articles/${params.id}`),component:()=> <ArticleFormPage edit/>});
const articleDetailRoute=createRoute({getParentRoute:()=>authenticated,path:"/articles/$id",validateSearch:articleSearch,loader:({params})=>api(`/articles/${params.id}`),component:ArticleDetailPage});
const draftsRoute=createRoute({getParentRoute:()=>authenticated,path:"/drafts",validateSearch:cursorSearch,loaderDeps:({search})=>({cursor:search.cursor}),loader:({deps})=>loadDrafts(deps.cursor),component:DraftsPage});
const eventSearch = (s: Record<string, unknown>) => ({ ...cursorSearch(s), period: s.period === "past" ? "past" : "upcoming", communityId: typeof s.communityId === "string" ? s.communityId.slice(0, 36) : "" });
const eventsRoute=createRoute({getParentRoute:()=>authenticated,path:"/events",validateSearch:eventSearch,loaderDeps:({search})=>search,loader:({deps})=>loadEvents(deps),component:EventsPage});
const eventNewRoute=createRoute({getParentRoute:()=>authenticated,path:"/events/new",validateSearch:eventSearch,component:EventFormPage});
const eventEditRoute=createRoute({getParentRoute:()=>authenticated,path:"/events/$id/edit",validateSearch:eventSearch,loader:({params})=>api(`/events/${params.id}`),component:()=> <EventFormPage edit/>});
const eventDetailRoute=createRoute({getParentRoute:()=>authenticated,path:"/events/$id",validateSearch:eventSearch,loader:({params})=>api(`/events/${params.id}`),component:EventDetailPage});
const home = createRoute({
  getParentRoute: () => authenticated, path: "/",
  validateSearch: search => ({ ...pagination(search), ...cursorSearch(search), feed: search.feed === "communities" ? "communities" : search.feed === "following" ? "following" : search.feed === "latest" ? "latest" : search.feed==="all"?"all":"", snapshot: typeof search.snapshot === "string" ? search.snapshot.slice(0, 36) : "", shareJob: typeof search.shareJob === "string" ? search.shareJob.slice(0, 36) : "" }),
  loaderDeps: ({ search }) => ({ page: search.page, feed: search.feed, snapshot: search.snapshot, cursor: search.cursor }),
  loader: async ({ deps }) => {
    const preferences=deps.feed?defaultPreferences:await api<Preferences>("/preferences").catch(()=>defaultPreferences);
    const feed=effectiveFeed(deps.feed,preferences);
    const result=await api<Record<string,unknown>>(`/threads?page=${deps.page}&feed=${feed}${deps.snapshot ? `&snapshot=${encodeURIComponent(deps.snapshot)}` : ""}${feed === "following" && deps.cursor ? `&cursor=${encodeURIComponent(deps.cursor)}` : ""}`);
    return {...result,effectiveFeed:feed};
  },
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
const share = createRoute({ getParentRoute: () => authenticated, path: "/thread/share/$id", beforeLoad: ({ params }) => { throw redirect({ to: "/thread/$id", params: { id: params.id }, replace: true }); } });
const explore = createRoute({ getParentRoute: () => authenticated, path: "/explore", validateSearch: search => ({ ...cursorSearch(search), q: String(search.q || "").slice(0, 80), tab: search.tab === "people" || search.tab === "communities" ? search.tab : "posts" }), loaderDeps: ({ search }) => ({ q: search.q, tab: search.tab, cursor: search.cursor }), loader: ({ deps }) => deps.q.trim() ? api(`/explore?q=${encodeURIComponent(deps.q)}&tab=${deps.tab}${deps.cursor ? `&cursor=${encodeURIComponent(deps.cursor)}` : ""}`) : api("/search"), component: ExplorePage });
const groups = createRoute({ getParentRoute: () => authenticated, path: "/communities", loader: () => api("/communities"), component: CommunitiesPage });
const createGroup = createRoute({ getParentRoute: () => authenticated, path: "/communities/new", component: CreateCommunityPage });
const group = createRoute({ getParentRoute: () => authenticated, path: "/communities/$id", validateSearch: pagination, loaderDeps: ({ search }) => search, loader: ({ params, deps }) => api(`/communities/${params.id}?page=${deps.page}`), component: CommunityPageView });
const notifications = createRoute({ getParentRoute: () => authenticated, path: "/notifications", validateSearch: search => ({ ...cursorSearch(search), kind: (search.kind === "reply" || search.kind === "like" || search.kind === "follow" || search.kind==="all" ? search.kind : "") as "reply" | "like" | "follow" | "all" | "" }), loaderDeps: ({ search }) => ({ kind: search.kind, cursor: search.cursor }), loader: async ({ deps }) => { const preferences=deps.kind?defaultPreferences:await api<Preferences>("/preferences").catch(()=>defaultPreferences);const kind=effectiveNotificationKind(deps.kind,preferences);return {...await loadActivity(kind,deps.cursor),effectiveKind:kind}; }, component: ActivityPage });
const analyticsRoute=createRoute({getParentRoute:()=>authenticated,path:"/analytics",validateSearch:s=>({from:String(s.from||"").slice(0,10),to:String(s.to||"").slice(0,10)}),loaderDeps:({search})=>search,loader:({deps})=>loadAnalytics(deps),component:AnalyticsPage});
const settingsRoute=createRoute({getParentRoute:()=>authenticated,path:"/settings",loader:()=>api<Preferences>("/preferences"),component:SettingsPage});
const discussionSearch = (s: Record<string, unknown>) => ({ ...cursorSearch(s), filter: s.filter === "following" || s.filter === "saved" ? s.filter : "all", q: typeof s.q === "string" ? s.q.slice(0, 120) : "", communityId: typeof s.communityId === "string" ? s.communityId.slice(0, 36) : "" });
const discussionsRoute=createRoute({getParentRoute:()=>authenticated,path:"/discussions",validateSearch:discussionSearch,loaderDeps:({search})=>search,loader:({deps})=>loadSubjects(deps),component:DiscussionsPage});
const discussionDetailRoute=createRoute({getParentRoute:()=>authenticated,path:"/discussions/$id",validateSearch:cursorSearch,loaderDeps:({search})=>({cursor:search.cursor}),loader:({params,deps})=>loadSubject(params.id,deps.cursor),component:DiscussionDetailPage});
export const router = createRouter({ routeTree: root.addChildren([signin, signup, confirmRoute, authenticated.addChildren([home, onboarding, edit, user, followersRoute, followingRoute, thread, share, explore, groups, createGroup, group, notifications, bookmarksRoute, listsRoute, createListRoute, editListRoute, listRoute, savedSearchesRoute,jobsRoute,jobNewRoute,jobEditRoute,jobDetailRoute,articlesRoute,articleNewRoute,articleEditRoute,articleDetailRoute,draftsRoute,settingsRoute,analyticsRoute,eventsRoute,eventNewRoute,eventEditRoute,eventDetailRoute,discussionsRoute,discussionDetailRoute])]), defaultPreload: "intent", defaultPreloadDelay: 120, defaultErrorComponent: RouteError, defaultNotFoundComponent: NotFoundPage, defaultPendingComponent: LoadingSpinner, defaultPendingMs: Infinity, defaultPendingMinMs: 0 });
