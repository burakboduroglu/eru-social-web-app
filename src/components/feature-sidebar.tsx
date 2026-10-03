import { Link } from "@tanstack/react-router";
import { Icon } from "./icon";
import "./feature-sidebar.css";

type Guidance = {
  title: string;
  icon: string;
  description: string;
  tips: string[];
  links: { to: string; label: string; icon: string; search?: { filter: "mine"; cursor: string; cursorHistory: string[] } }[];
};

const guidance: Record<string, Guidance> = {
  articles: { title: "Okumaya ve yazmaya alan", icon: "article", description: "Üyelerin deneyimlerini yazılar üzerinden keşfet.", tips: ["Yazılarını önce özel taslak olarak kaydedebilirsin.", "Yayınlanan yazılar ve kendi taslakların ayrı görünümlerde yer alır."], links: [{ to: "/articles", label: "Yazıları keşfet", icon: "article" }, { to: "/articles/new", label: "Yeni yazı oluştur", icon: "article" }] },
  events: { title: "Topluluğunla buluş", icon: "calendar", description: "Etkinlikler ve toplantı bağlantıları mevcut topluluk üyelerine görünür.", tips: ["Saatler bulunduğun saat diliminde gösterilir.", "Katılım tercihin yalnızca sana görünür."], links: [{ to: "/events", label: "Etkinliklere göz at", icon: "calendar" }, { to: "/communities", label: "Toplulukları keşfet", icon: "community" }] },
  discussions: { title: "Konuları birlikte işle", icon: "community", description: "Başlıklar topluluk üyelerine görünür; görüşler düz metin olarak sıralanır.", tips: ["Aynı topluluktaki aynı başlık tek kayıtta toplanır.", "Takip ve kayıt yalnızca sana görünür; bildirim göndermez."], links: [{ to: "/discussions", label: "Başlıklara göz at", icon: "community" }, { to: "/communities", label: "Toplulukları keşfet", icon: "community" }] },
  drafts: { title: "Kaldığın yerden devam et", icon: "article", description: "Metin taslakların kişisel gönderi, topluluk gönderisi veya yanıt olarak saklanır.", tips: ["Taslak, kaydedildiği paylaşım yerinde açılır.", "Görseller kalıcı metin taslağına dahil değildir."], links: [{ to: "/", label: "Yeni gönderi yaz", icon: "home" }, { to: "/articles", label: "Yazı taslaklarına git", icon: "article", search: { filter: "mine", cursor: "", cursorHistory: [] } }] },
  settings: { title: "Tercihlerin sana ait", icon: "settings", description: "Akış ve bildirim kategorisi tercihleri ilk açılan görünümü belirler.", tips: ["Bildirim kategorisini değiştirmek bildirimleri kapatmaz.", "Hareket azaltma tercihi animasyonları ve yumuşak kaydırmayı azaltır."], links: [{ to: "/", label: "Akışa dön", icon: "home" }, { to: "/notifications", label: "Bildirimlerini aç", icon: "notification" }] },
  analytics: { title: "Sayıların kapsamı", icon: "analytics", description: "Gönderilerin ve üzerlerindeki halen kayıtlı etkileşimlerin özeti.", tips: ["Tarih aralığı gönderilerin oluşturulma zamanına uygulanır.", "Takipçi sayısı tarih aralığından bağımsız olarak günceldir."], links: [{ to: "/", label: "Akışa dön", icon: "home" }] },
  lists: { title: "Sana özel akışlar", icon: "list", description: "Seçtiğin kişileri özel listelerde toplayabilirsin.", tips: ["Listeyi ve üyelerini yalnızca sen görebilirsin.", "Liste üyeliği takip ilişkini değiştirmez.", "Akış, kişisel gönderileri ve yeniden paylaşımları içerir."], links: [{ to: "/lists", label: "Listelerini aç", icon: "list" }, { to: "/lists/new", label: "Yeni liste oluştur", icon: "list" }] },
  "saved-searches": { title: "Aramalarına hızlı dön", icon: "search", description: "Kaydedilen aramalar, arama metnini ve görünümünü birlikte açar.", tips: ["Aramalarını yalnızca sen görebilirsin.", "Yeni bir aramayı Keşfet sayfasından kaydedebilirsin."], links: [{ to: "/explore", label: "Keşfet’te ara", icon: "search" }] },
  bookmarks: { title: "Sonra okumak için", icon: "bookmark", description: "İlgini çeken gönderileri özel kütüphanende bir arada tut.", tips: ["Bir gönderinin seçeneklerinden Kaydet’i seçebilirsin.", "Kaydettiklerini yalnızca sen görebilirsin."], links: [{ to: "/", label: "Akışı keşfet", icon: "home" }, { to: "/saved-searches", label: "Kaydedilen aramaların", icon: "search" }] },
};

export function hasFeatureSidebar(pathname: string) {
  return Object.hasOwn(guidance, pathname.split("/")[1]);
}

export function FeatureSidebar({ pathname }: { pathname: string }) {
  if (!hasFeatureSidebar(pathname)) return null;
  const content = guidance[pathname.split("/")[1]];
  return <section className="feature-sidebar" aria-label="Bu sayfa hakkında">
    <header><Icon name={content.icon} size={20}/><h2>{content.title}</h2></header>
    <p>{content.description}</p>
    <ul>{content.tips.map(tip => <li key={tip}>{tip}</li>)}</ul>
    <nav aria-label="İlgili sayfalar">{content.links.map(link => <Link key={link.to} to={link.to as never} search={link.search as never}><Icon name={link.icon} size={18}/>{link.label}</Link>)}</nav>
  </section>;
}
