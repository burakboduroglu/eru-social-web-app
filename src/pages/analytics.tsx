import { isRedirect, useLoaderData, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import type { CreatorAnalytics } from "../../shared/types";
import { Button } from "../components/ui/button";
import "../components/medium-features.css";
import { FeatureEmpty, FeatureHeader, FeatureSection } from "../components/feature-presentation";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
import { Icon } from "../components/icon";
import { api, invalidateApiCache } from "../lib/api";
import { ErrorMessage } from "../components/feature-tools";

type AnalyticsData = { analytics: CreatorAnalytics; loadError?: undefined } | { analytics: null; loadError: string };
export async function loadAnalytics(search: { from?: string; to?: string }): Promise<AnalyticsData> {
    const params = new URLSearchParams();
    if (search.from) params.set("from", search.from);
    if (search.to) params.set("to", search.to);
    try { return { analytics: await api<CreatorAnalytics>(`/analytics${params.size ? `?${params}` : ""}`) }; }
    catch (error) {
        if (isRedirect(error)) throw error;
        return { analytics: null, loadError: error instanceof Error ? error.message : "İçerik analizi yüklenemedi. Tekrar dene." };
    }
}
export function AnalyticsPage() {
    const data = useLoaderData({ strict: false }) as AnalyticsData, navigate = useNavigate(), router = useRouter();
    const loading = useContentLoading(), showLoading = useDelayedLoading(loading);
    const search = useSearch({ strict: false }) as {
        from?: string;
        to?: string;
    };
    const stats = data.analytics ? [["Gönderilerin", data.analytics.postCount], ["Alınan beğeniler", data.analytics.likesReceived], ["Alınan yanıtlar", data.analytics.repliesReceived], ["Yeniden paylaşımlar", data.analytics.repostsReceived], ["Güncel takipçilerin", data.analytics.followerCount]] as const : [];
    return <section className="feature-page analytics-page"><FeatureHeader title="İçerik analizi" eyebrow="HESABININ ÖZETİ" description="Gönderilerin ve üzerlerindeki mevcut etkileşimleri birlikte incele." />
    <FeatureSection title="Gönderi tarih aralığı" description="UTC tarihleri gönderilerin oluşturulma zamanını filtreler. Takipçi sayısı her zaman günceldir.">
    <form className="feature-form" key={`${search.from}:${search.to}`} onSubmit={event => {
        event.preventDefault();
        void navigate({ search: Object.fromEntries(new FormData(event.currentTarget)) as never });
    }}><div className="feature-form-grid"><label>Başlangıç (UTC)<input type="date" name="from" defaultValue={search.from}/></label><label>Bitiş (UTC)<input type="date" name="to" defaultValue={search.to}/></label></div><div className="feature-actions"><Button type="submit" disabled={loading}>Uygula</Button><Button type="button" variant="outline" disabled={loading} onClick={() => navigate({ search: { from: "", to: "" } as never })}>Tüm tarihler</Button></div></form>
    </FeatureSection>
    <div className="feature-results" aria-busy={loading}>{showLoading ? <LoadingSpinner label="İçerik analizi yükleniyor" /> : data.loadError ? <FeatureSection title="İçerik analizi yüklenemedi"><ErrorMessage message={data.loadError} /><Button variant="outline" disabled={loading} onClick={() => { invalidateApiCache(); void router.invalidate(); }}>Tekrar dene</Button></FeatureSection> : <><div className="feature-stats">{stats.map(([label, count], index) => <article className="feature-stat" key={label}><span>{label}</span><strong>{count.toLocaleString("tr-TR")}</strong><p className="feature-note">{index === 4 ? "Şu an hesabını takip edenler" : index === 0 ? "Seçili tarihlerde oluşturulan özgün gönderiler" : "Seçili gönderilerde halen kayıtlı etkileşimler"}</p></article>)}</div>
    {!data.analytics?.postCount && <FeatureEmpty title="Bu aralıkta gönderin yok" description="Yeni gönderilerin ve kaydedilen etkileşimler burada görünür. Başka bir tarih aralığını da seçebilirsin." icon={<Icon name="analytics" size={24}/>}/>}</>}
    </div>
    <details className="analytics-method"><summary>Sayılar nasıl hesaplanıyor?</summary><p className="feature-note">Gönderiler, yanıt olmayan özgün kişisel ve topluluk paylaşımlarındır. Tarihler bu gönderilerin oluşturulma zamanını filtreler; üzerlerindeki mevcut beğeni, yanıt ve yeniden paylaşımların tümü sayılır. Silinen veya geri alınan kayıtlar sayılmaz.</p></details>
  </section>;
}
