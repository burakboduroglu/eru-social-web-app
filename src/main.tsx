import { invalidateApiCache } from "./lib/api";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { initializeAuth, supabase } from "./lib/supabase";
import { router } from "./router";
import { LoadingSpinner } from "./components/loading";
import { ErrorScreen } from "./components/page-state";
import { ToastViewport } from "./components/toast";
import { clearBookmarkState } from "./lib/bookmark-state";
import { clearComposerDraftsForAccount } from "./lib/composer-draft";
import { clearFollowState } from "./lib/follow-state";
import { clearRepostState } from "./lib/repost-state";
import "./legacy.css";
import "./styles.css";
import "./components/menus.css";
import "./components/discover.css";
import "./components/pixel.css";
import "./components/discovery-sidebar.css";
import "./components/account-menu.css";
import "./components/proportions.css";
import "./components/page-chrome.css";
import "./components/post-menu-layer.css";
import "./components/responsive.css";
import "./components/pickers.css";
import "./components/input-focus.css";
import "./components/thread-detail.css";
import "./components/link-preview.css";
import "./components/toast.css";
import "./components/social-experience.css";
import "./components/reposts.css";

const root = createRoot(document.getElementById("root")!);
root.render(<LoadingSpinner label="Uygulama yükleniyor" />);
try {
  await initializeAuth();
  let previousAccountId: string | undefined;
  supabase.auth.onAuthStateChange((event, session) => {
    const accountId = session?.user.id;
    if (event === "SIGNED_OUT" || (previousAccountId && previousAccountId !== accountId)) {
      if (previousAccountId) clearComposerDraftsForAccount(previousAccountId);
      clearBookmarkState();
      clearFollowState();
      clearRepostState();
      invalidateApiCache(true);
    }
    previousAccountId = accountId;
    if (event === "SIGNED_OUT") { void router.navigate({ to: "/sign-in" }); }
  });
  root.render(<><RouterProvider router={router} /><ToastViewport /></>);
} catch (error) {
  root.render(<ErrorScreen error={error} retry={() => location.reload()} home={<a className="button" href="/">Ana sayfaya dön</a>} />);
}
