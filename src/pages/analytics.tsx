import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import type { CreatorAnalytics } from "../../shared/types";
import { Button } from "../components/ui/button";
import "../components/medium-features.css";
import { FeatureEmpty, FeatureHeader, FeatureSection } from "../components/feature-presentation";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
import { Icon } from "../components/icon";
export function AnalyticsPage() {
    const data = useLoaderData({ strict: false }) as CreatorAnalytics, navigate = useNavigate();
    const loading = useContentLoading(), showLoading = useDelayedLoading(loading);
    const search = useSearch({ strict: false }) as {
        from?: string;
        to?: string;
    };
    const stats = [["Gönderilerin", data.postCount], ["Alınan beğeniler", data.likesReceived], ["Alınan yanıtlar", data.repliesReceived], ["Yeniden paylaşımlar", data.repostsReceived], ["Güncel takipçilerin", data.followerCount]] as const;
    return <section className="feature-page analytics-page"><FeatureHeader title="İçerik analizi" eyebrow="HESABININ ÖZETİ" description="Gönderilerin ve üzerlerindeki mevcut etkileşimleri birlikte incele." />
    <FeatureSection title="Gönderi tarih aralığı" description="UTC tarihleri gönderilerin oluşturulma zamanını filtreler. Takipçi sayısı her zaman günceldir.">
    <form className="feature-form" key={`${search.from}:${search.to}`} onSubmit={event => {
        event.preventDefault();
        void navigate({ search: Object.fromEntries(new FormData(event.currentTarget)) as never });
    }}><div className="feature-form-grid"><label>Başlangıç (UTC)<input type="date" name="from" defaultValue={search.from}/></label><label>Bitiş (UTC)<input type="date" name="to" defaultValue={search.to}/></label></div><div className="feature-actions"><Button type="submit" disabled={loading}>Uygula</Button><Button type="button" variant="outline" disabled={loading} onClick={() => navigate({ search: { from: "", to: "" } as never })}>Tüm tarihler</Button></div></form>
    </FeatureSection>
    <div className="feature-results" aria-busy={loading}>{showLoading ? <LoadingSpinner label="İçerik analizi yükleniyor" /> : <><div className="feature-stats">{stats.map(([label, count], index) => <article className="feature-stat" key={label}><span>{label}</span><strong>{count.toLocaleString("tr-TR")}</strong><p className="feature-note">{index === 4 ? "Şu an hesabını takip edenler" : index === 0 ? "Seçili tarihlerde oluşturulan özgün gönderiler" : "Seçili gönderilerde halen kayıtlı etkileşimler"}</p></article>)}</div>
    {!data.postCount && <FeatureEmpty title="Bu aralıkta gönderin yok" description="Yeni gönderilerin ve kaydedilen etkileşimler burada görünür. Başka bir tarih aralığını da seçebilirsin." icon={<Icon name="analytics" size={24}/>}/>}</>}
    </div>
    <details className="analytics-method"><summary>Sayılar nasıl hesaplanıyor?</summary><p className="feature-note">Gönderiler, yanıt olmayan özgün kişisel ve topluluk paylaşımlarındır. Tarihler bu gönderilerin oluşturulma zamanını filtreler; üzerlerindeki mevcut beğeni, yanıt ve yeniden paylaşımların tümü sayılır. Silinen veya geri alınan kayıtlar sayılmaz.</p></details>
  </section>;
}
