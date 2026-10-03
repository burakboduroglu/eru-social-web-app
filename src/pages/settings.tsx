import { useLoaderData, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { Preferences } from "../../shared/types";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { ErrorMessage, useFormGuard } from "../components/feature-tools";
import { FeatureHeader, FeatureSection } from "../components/feature-presentation";
export function SettingsPage() {
    const initial = useLoaderData({ strict: false }) as Preferences;
    const [values, setValues] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
    const guard = useFormGuard(values, initial), router = useRouter();
    function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
        setValues(current => ({ ...current, [key]: value }));
        setMessage("");
        setError("");
    }
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
    return <section className="feature-page settings-page">
      <FeatureHeader title="Ayarlar" description="Akışını ve görünümünü sana göre düzenle. Tercihlerin hesabına kaydedilir." />
      <form className="feature-form" onSubmit={save}>
        <FeatureSection title="Görünüm ve hareket" description="Animasyonların ve kaydırmanın nasıl davranacağını seç.">
          <label className="feature-toggle"><input type="checkbox" disabled={busy} checked={values.reducedMotion} onChange={event => update("reducedMotion", event.target.checked)}/><span>Hareketleri azalt<span className="settings-control-description">Animasyonları ve yumuşak kaydırmayı azaltır. Sisteminin hareket tercihi de uygulanır.</span></span></label>
        </FeatureSection>
        <FeatureSection title="Başlangıç görünümleri" description="Ana sayfayı ve bildirimleri açtığında önce hangi içeriği görmek istediğini seç.">
          <div className="settings-fields"><label>Varsayılan Ana Sayfa akışı<select disabled={busy} value={values.defaultFeed} onChange={event => update("defaultFeed", event.target.value as Preferences["defaultFeed"])}><option value="all">Senin için</option><option value="latest">En yeni gönderiler</option><option value="following">Takip edilenler</option><option value="communities">Toplulukların</option></select></label>
          <label>Varsayılan bildirim kategorisi<select disabled={busy} value={values.notificationKind} onChange={event => update("notificationKind", event.target.value as Preferences["notificationKind"])}><option value="all">Tümü</option><option value="reply">Yanıtlar</option><option value="like">Beğeniler</option><option value="follow">Takipler</option></select></label></div>
          <p className="feature-note">Bağlantıdaki akış veya kategori seçimi varsayılanın yerine geçer. Bu tercih bildirimleri kapatmaz.</p>
        </FeatureSection>
        <div className="settings-save-area"><ErrorMessage message={error}/><p className="feature-note" role="status" aria-live="polite">{busy ? "Tercihlerin kaydediliyor…" : guard.dirty() ? "Kaydedilmemiş değişikliklerin var." : message || "Tercihlerin güncel."}</p><Button disabled={busy || !guard.dirty()}>{busy ? "Kaydediliyor…" : "Ayarları kaydet"}</Button></div>
      </form>
    </section>;
}
