import { invalidateApiCache } from "./lib/api";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { initializeAuth, supabase } from "./lib/supabase";
import { router } from "./router";
import { LoadingSpinner } from "./components/loading";
import { ErrorScreen } from "./components/page-state";
import { ToastViewport } from "./components/toast";
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

const root = createRoot(document.getElementById("root")!);
root.render(<LoadingSpinner label="Uygulama yükleniyor" />);
try {
  await initializeAuth();
  supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") { invalidateApiCache(true); router.navigate({ to: "/sign-in" }); }
  });
  root.render(<><RouterProvider router={router} /><ToastViewport /></>);
} catch (error) {
  root.render(<ErrorScreen error={error} retry={() => location.reload()} home={<a className="button" href="/">Ana sayfaya dön</a>} />);
}
