import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import type { CreatorAnalytics } from "../../shared/types";
import { Button } from "../components/ui/button";
import "../components/medium-features.css";
export function AnalyticsPage() {
    const data = useLoaderData({ strict: false }) as CreatorAnalytics, navigate = useNavigate();
    const search = useSearch({ strict: false }) as {
        from?: string;
        to?: string;
    };
    const stats = [["Gönderilerin", data.postCount], ["Alınan beğeniler", data.likesReceived], ["Alınan yanıtlar", data.repliesReceived], ["Yeniden paylaşımlar", data.repostsReceived], ["Güncel takipçilerin", data.followerCount]] as const;
    return <section className="feature-page"><header className="feature-heading"><div><h1>İçerik analizi</h1><p>Kendi hesabının kaydedilen gönderi ve etkileşim sayıları.</p></div></header>
    <form className="feature-form" key={`${search.from}:${search.to}`} onSubmit={event => {
        event.preventDefault();
        void navigate({ search: Object.fromEntries(new FormData(event.currentTarget)) as never });
    }}><div className="feature-form-grid"><label>Gönderi başlangıç tarihi (UTC)<input type="date" name="from" defaultValue={search.from}/></label><label>Gönderi bitiş tarihi (UTC)<input type="date" name="to" defaultValue={search.to}/></label></div><div className="feature-actions"><Button type="submit" variant="outline">Uygula</Button><Button type="button" variant="outline" onClick={() => navigate({ search: { from: "", to: "" } as never })}>Tüm tarihler</Button></div></form>
    <p className="feature-note">Gönderiler, yanıt olmayan özgün kişisel ve topluluk paylaşımlarındır. Tarihler bu gönderilerin oluşturulma zamanını filtreler; üzerlerindeki mevcut beğeni, yanıt ve yeniden paylaşımların tümü sayılır. Silinen veya geri alınan kayıtlar sayılmaz. Takipçi sayısı her zaman günceldir.</p>
    <div className="feature-stats">{stats.map(([label, count]) => <article className="feature-stat" key={label}><span>{label}</span><strong>{count}</strong></article>)}</div>
    {!data.postCount && <p className="feature-empty">Bu tarih aralığında gönderin yok. Yeni gönderilerin ve gerçek etkileşimler burada görünür.</p>}
  </section>;
}
