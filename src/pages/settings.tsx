import { useLoaderData, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { Preferences } from "../../shared/types";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { ErrorMessage, useFormGuard } from "../components/feature-tools";
export function SettingsPage() {
    const initial = useLoaderData({ strict: false }) as Preferences;
    const [values, setValues] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
    const guard = useFormGuard(values, initial), router = useRouter();
    async function save(event: FormEvent) {
        event.preventDefault();
        if (busy)
            return;
        setBusy(true);
        setError("");
        setMessage("");
        try {
            const saved = await api<Preferences>("/preferences", "PATCH", values);
            guard.commit(saved);
            setValues(saved);
            document.documentElement.dataset.reducedMotion = String(saved.reducedMotion);
            setMessage("Ayarların kaydedildi.");
            void router.invalidate().catch(() => setError("Ayarlar kaydedildi, sayfa yenilenemedi."));
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Ayarlar kaydedilemedi.");
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="feature-page"><header className="feature-heading"><div><h1>Ayarlar</h1><p>Tercihlerin hesabına kaydedilir.</p></div></header><form className="feature-form" onSubmit={save}>
    <label className="feature-toggle"><input type="checkbox" checked={values.reducedMotion} onChange={event => setValues(v => ({ ...v, reducedMotion: event.target.checked }))}/>Hareketleri azalt</label><p className="feature-note">Animasyonları ve yumuşak kaydırmayı azaltır. Sisteminin hareket tercihi de uygulanır.</p>
    <label>Varsayılan Ana Sayfa akışı<select value={values.defaultFeed} onChange={event => setValues(v => ({ ...v, defaultFeed: event.target.value as Preferences["defaultFeed"] }))}><option value="all">Senin için</option><option value="latest">En yeni gönderiler</option><option value="following">Takip edilenler</option><option value="communities">Toplulukların</option></select></label>
    <label>Varsayılan bildirim kategorisi<select value={values.notificationKind} onChange={event => setValues(v => ({ ...v, notificationKind: event.target.value as Preferences["notificationKind"] }))}><option value="all">Tümü</option><option value="reply">Yanıtlar</option><option value="like">Beğeniler</option><option value="follow">Takipler</option></select></label><p className="feature-note">Bağlantıdaki akış veya kategori seçimi varsayılanın yerine geçer. Bildirimler kapatılmaz; sadece ilk görünüm değişir.</p>
    <ErrorMessage message={error}/>{message && <p role="status">{message}</p>}<div className="feature-actions"><Button disabled={busy}>{busy ? "Kaydediliyor…" : "Ayarları kaydet"}</Button></div>
  </form></section>;
}
