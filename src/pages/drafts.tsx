import { Link, useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { TextDraft, ResourcePage } from "../../shared/types";
import { api } from "../lib/api";
import { useMe } from "../ui";
import { setComposerDraft, setDurableDraftReference, forgetDurableDraft, hasUnsentComposerDraft, type ComposerDraftScope } from "../lib/composer-draft";
import { Button } from "../components/ui/button";
import { ErrorMessage, FeaturePagination } from "../components/feature-tools";
import { FeatureEmpty, FeatureHeader } from "../components/feature-presentation";
import { Icon } from "../components/icon";
import { LoadingSpinner, useContentLoading, useDelayedLoading } from "../components/loading";
export function loadDrafts(cursor = "") {
    return api<ResourcePage<TextDraft>>(`/drafts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}
export function DraftsPage() {
    const data = useLoaderData({ strict: false }) as ResourcePage<TextDraft>, { profile } = useMe(), navigate = useNavigate(), router = useRouter();
    const [busy, setBusy] = useState(""), [error, setError] = useState("");
    const loading = useContentLoading(), showLoading = useDelayedLoading(loading);
    async function resume(id: string) {
        if (busy)
            return;
        setBusy(id);
        setError("");
        try {
            const draft = await api<TextDraft>(`/drafts/${id}`);
            if (!draft.available)
                throw new Error(draft.unavailableReason || "Taslak kullanılamıyor.");
            const scope: ComposerDraftScope = draft.context === "personal" ? { kind: "root" } : draft.context === "community" ? { kind: "community", communityId: draft.targetId! } : { kind: "reply", threadId: draft.targetId! };
            if (hasUnsentComposerDraft(profile.id, scope) && !window.confirm("Bu paylaşım yerindeki gönderilmemiş metin taslakla değiştirilsin mi?"))
                return;
            setComposerDraft(profile.id, scope, { value: draft.text, target: draft.context === "community" ? draft.targetId! : "" });
            setDurableDraftReference(profile.id, scope, draft);
            await navigate({ to: draft.context === "personal" ? "/" : draft.context === "community" ? `/communities/${draft.targetId}` : `/thread/${draft.targetId}` });
            setTimeout(() => document.querySelector<HTMLTextAreaElement>(draft.context === "reply" ? `#reply-${draft.targetId}` : "#compose-post")?.focus(), 100);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Taslak açılamadı.");
        }
        finally {
            setBusy("");
        }
    }
    async function remove(id: string) {
        if (busy || !window.confirm("Kaydedilen taslak silinsin mi?"))
            return;
        setBusy(id);
        setError("");
        try {
            await api(`/drafts/${id}`, "DELETE");
            forgetDurableDraft(profile.id, id);
            await router.invalidate();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Taslak silinemedi.");
        }
        finally {
            setBusy("");
        }
    }
    return <section className="feature-page drafts-page">
      <FeatureHeader title="Metin taslakların" eyebrow="ÖZEL KÜTÜPHANE" description="Yarım kalan gönderilerine devam et. Taslaklarını yalnızca sen görebilirsin." />
      <p className="feature-note">Görseller kalıcı metin taslağına dahil değildir. İlan ve yazı taslakları kendi sayfalarında yer alır.</p>
      <ErrorMessage message={error}/>
      <div className="feature-results" aria-busy={loading}>
        {showLoading ? <LoadingSpinner label="Taslaklar yükleniyor" /> : data.items.length ? <div className="feature-list">{data.items.map(draft => <article className="feature-card draft-card" key={draft.id}>
          <div className="draft-context-row"><span className="feature-status"><Icon name={draft.context === "personal" ? "user" : draft.context === "community" ? "community" : "reply"} size={16}/>{draft.context === "personal" ? "Kişisel gönderi" : draft.context === "community" ? "Topluluk gönderisi" : "Yanıt"}</span><time dateTime={draft.updatedAt}>Kaydedildi: {new Date(draft.updatedAt).toLocaleString("tr-TR")}</time></div>
          <p className="draft-excerpt">{draft.text}</p>
          {!draft.available && <p className="feature-error">{draft.unavailableReason || "Bu taslağın paylaşım yeri artık kullanılamıyor."}</p>}
          <div className="feature-actions"><Button disabled={loading || !!busy || !draft.available} onClick={() => resume(draft.id)}>{busy === draft.id ? "İşleniyor…" : "Devam et"}</Button><Button className="feature-danger-action" variant="ghost" disabled={loading || !!busy} onClick={() => remove(draft.id)} aria-label="Kaydedilen metin taslağını sil"><Icon name="delete" size={16}/>Sil</Button></div>
        </article>)}</div> : <FeatureEmpty title="Henüz metin taslağın yok" description="Gönderi yazarken taslak olarak kaydet. Daha sonra aynı paylaşım yerinde devam edebilirsin." icon={<Icon name="article" size={24}/>} action={<Button asChild><Link to="/">Gönderi yaz</Link></Button>}/>}
      </div>
      <FeaturePagination nextCursor={data.nextCursor}/>
    </section>;
}
