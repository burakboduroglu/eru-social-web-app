import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ApiError, describePageError } from "../lib/errors";
import { Illustration, type IllustrationName } from "./illustration";
import { invalidateApiCache } from "../lib/api";
import { Button } from "./ui/button";

export function StatePanel({ title, description, kind = "empty", eyebrow, action, pageHeading = false }: {
  title: string; description?: ReactNode; kind?: IllustrationName; eyebrow?: string; action?: ReactNode; pageHeading?: boolean;
}) {
  const Heading = pageHeading ? "h1" : "h2";
  return <section className="state-card">
    <Illustration name={kind} />
    <div className="state-copy">{eyebrow && <p className="state-code">{eyebrow}</p>}<Heading>{title}</Heading>{description && <p>{description}</p>}</div>
    {action && <div className="state-actions">{action}</div>}
  </section>;
}
export function ErrorScreen({ error, retry, home, back }: { error: unknown; retry: () => void | Promise<unknown>; home: ReactNode; back?: () => void }) {
  const description = describePageError(error, typeof navigator === "undefined" || navigator.onLine);
  const api = error instanceof ApiError ? error : null;
  const delay = api && [429, 503].includes(api.status) ? Math.ceil(api.retryAfter || 0) : 0;
  const [wait, setWait] = useState(delay), [busy, setBusy] = useState(false);
  useEffect(() => { setWait(delay); if (!delay) return; const timer = setInterval(() => setWait(value => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [delay, error]);
  const missing = description.kind === "not-found";
  return <div className="page-state" role={missing ? undefined : "alert"}>
    <StatePanel pageHeading kind={missing ? "no-results" : "server-down"} title={description.title} description={description.description} eyebrow={missing ? "404" : api ? String(api.status) : description.eyebrow}
      action={<>
        <div className="state-buttons">
          {missing && back && <Button variant="outline" onClick={back}>Geri dön</Button>}
          {description.retryable && <Button disabled={busy || wait > 0} onClick={async () => { setBusy(true); try { await retry(); } catch { /* The boundary owns the next error state. */ } finally { setBusy(false); } }}>{wait > 0 ? `${wait} sn sonra tekrar dene` : busy ? "Yeniden deneniyor…" : "Tekrar dene"}</Button>}
          {home}
        </div>
        {!missing && <details className="state-details"><summary>Hata ayrıntıları</summary><dl>
          <dt>Durum</dt><dd>{description.eyebrow}</dd>
          {api && <><dt>HTTP kodu</dt><dd>{api.status}</dd></>}
          <dt>Sayfa</dt><dd>{typeof location !== "undefined" ? location.pathname : "/"}</dd>
          {wait > 0 && <><dt>Bekleme süresi</dt><dd>{wait} saniye</dd></>}
        </dl></details>}
      </>} />
  </div>;
}
export function RouteError({ error, reset }: { error: unknown; reset?: () => void }) {
  const router = useRouter();
  return <ErrorScreen error={error} retry={async () => {
    invalidateApiCache();
    if (error instanceof ApiError && error.status === 410) {
      await router.navigate({ to: router.state.location.pathname, search: { ...router.state.location.search, page: 0, cursor: "", cursorHistory: [], snapshot: "" } as never, replace: true });
    } else await router.invalidate();
    reset?.();
  }}
    back={() => router.history.length > 1 ? router.history.back() : router.navigate({ to: "/" })}
    home={<Button variant="outline" asChild><Link to={error instanceof ApiError && error.status === 401 ? "/sign-in" : "/"}>{error instanceof ApiError && error.status === 401 ? "Giriş yap" : "Ana sayfaya dön"}</Link></Button>} />;
}
export function NotFoundPage() { return <RouteError error={new ApiError(404, "Not found")} />; }
