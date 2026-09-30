import { invalidateApiCache } from "./lib/api";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { initializeAuth, supabase } from "./lib/supabase";
import { router } from "./router";
import { LoadingSpinner } from "./components/loading";
import { ErrorScreen } from "./components/page-state";
import "./legacy.css";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(<LoadingSpinner label="Uygulama yükleniyor" />);
try {
  await initializeAuth();
  supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") { invalidateApiCache(true); router.navigate({ to: "/sign-in" }); }
  });
  root.render(<RouterProvider router={router} />);
} catch (error) {
  root.render(<ErrorScreen error={error} retry={() => location.reload()} home={<a className="button" href="/">Ana sayfaya dön</a>} />);
}
