import { Link, useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { TextDraft, ResourcePage } from "../../shared/types";
import { api } from "../lib/api";
import { useMe } from "../ui";
import { setComposerDraft, setDurableDraftReference, forgetDurableDraft, hasUnsentComposerDraft, type ComposerDraftScope } from "../lib/composer-draft";
import { Button } from "../components/ui/button";
import { ErrorMessage, FeaturePagination } from "../components/feature-tools";
export function loadDrafts(cursor = "") {
    return api<ResourcePage<TextDraft>>(`/drafts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}
export function DraftsPage() {
    const data = useLoaderData({ strict: false }) as ResourcePage<TextDraft>, { profile } = useMe(), navigate = useNavigate(), router = useRouter();
    const [busy, setBusy] = useState(""), [error, setError] = useState("");
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
    return <section className="feature-page"><header className="feature-heading"><div><h1>Metin taslakların</h1><p>Yalnızca sen görebilirsin. Görseller kalıcı taslağa dahil değildir.</p></div></header><ErrorMessage message={error}/><div className="feature-list">{data.items.map(draft => <article className="feature-card" key={draft.id}><div className="feature-meta"><span>{draft.context === "personal" ? "Kişisel gönderi" : draft.context === "community" ? "Topluluk gönderisi" : "Yanıt"}</span><span>{new Date(draft.updatedAt).toLocaleString("tr-TR")}</span></div><p className="feature-body">{draft.text}</p>{!draft.available && <p className="feature-error">{draft.unavailableReason}</p>}<div className="feature-actions"><Button disabled={!!busy || !draft.available} onClick={() => resume(draft.id)}>Devam et</Button><Button variant="outline" disabled={!!busy} onClick={() => remove(draft.id)}>Sil</Button></div></article>)}</div>{!data.items.length && <p className="feature-empty">Henüz kaydedilen metin taslağın yok. <Link to="/">Gönderi yazarken taslak olarak kaydet.</Link></p>}<FeaturePagination nextCursor={data.nextCursor}/></section>;
}
