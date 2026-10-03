import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { TextDraft } from "../../shared/types";
import { api } from "../lib/api";
import { getDurableDraftReference, setDurableDraftReference, type ComposerDraftScope } from "../lib/composer-draft";
import "./durable-composer-draft.css";

/** Saves text explicitly; uploaded attachments retain their existing session lifecycle. */
export function useDurableComposerDraft(accountId: string, scope: ComposerDraftScope, value: string, target: string, jobAttachment?: { jobId: string | null } | null) {
  const key = JSON.stringify([accountId, scope]);
  const context = scope.kind === "reply" ? "reply" : scope.kind === "community" || target ? "community" : "personal";
  const targetId = scope.kind === "reply" ? scope.threadId : scope.kind === "community" ? scope.communityId : target || null;
  const operationKey = JSON.stringify([key, context, targetId, jobAttachment]);
  const request = useRef({ key: operationKey, generation: 0, pending: false });
  if (request.current.key !== operationKey) request.current = { key: operationKey, generation: request.current.generation + 1, pending: false };
  const [state, setState] = useState(() => ({ key, draft: getDurableDraftReference(accountId, scope) }));
  let draft = state.draft;
  if (state.key !== key) {
    draft = getDurableDraftReference(accountId, scope);
    setState({ key, draft });
  }
  const [status, setStatus] = useState({ key: operationKey, busy: false, error: "", message: "" });
  const visibleStatus = status.key === operationKey ? status : { busy: false, error: "", message: "" };
  useEffect(() => () => { request.current.generation += 1; request.current.pending = false; }, []);

  async function save() {
    // Protect same-tick clicks before React can render the disabled button.
    if (request.current.pending || !value.trim()) return;
    request.current.pending = true;
    const generation = request.current.generation;
    const current = () => request.current.key === operationKey && request.current.generation === generation;
    setStatus({ key: operationKey, busy: true, error: "", message: "" });
    try {
      const saved = await api<TextDraft>(draft ? `/drafts/${draft.id}` : "/drafts", draft ? "PATCH" : "POST", { text: value, context, targetId, jobId: jobAttachment?.jobId || null, resourceKind: jobAttachment ? "job" : null, version: draft?.version });
      // A completed old request remains in the library but must not overwrite another account/context.
      if (!current()) return;
      setDurableDraftReference(accountId, scope, saved);
      setState({ key, draft: saved });
      setStatus({ key: operationKey, busy: false, error: "", message: "Metin taslağı kaydedildi." });
    } catch (error) {
      if (current()) setStatus({ key: operationKey, busy: false, error: error instanceof Error ? error.message : "Taslak kaydedilemedi.", message: "" });
    } finally {
      if (current()) request.current.pending = false;
    }
  }
  function published() {
    request.current.generation += 1;
    request.current.pending = false;
    setDurableDraftReference(accountId, scope);
    setState({ key, draft: undefined });
    setStatus({ key: operationKey, busy: false, error: "", message: "" });
  }
  const sameContext = draft?.context === context && draft.targetId === targetId;
  return { ...visibleStatus, save, published, publishReference: () => sameContext && draft ? { draftId: draft.id, draftVersion: draft.version } : {}, saved: !!draft };
}

export function DurableDraftControls({ draft, disabled, hasImages }: { draft: ReturnType<typeof useDurableComposerDraft>; disabled: boolean; hasImages: boolean }) {
  return <div className="durable-draft-controls"><div>
    <button type="button" disabled={disabled || draft.busy} onClick={() => void draft.save()}>{draft.busy ? "Taslak kaydediliyor…" : draft.saved ? "Metin taslağını güncelle" : "Metni taslak olarak kaydet"}</button>
    <Link to="/drafts" aria-disabled={draft.busy} onClick={event => { if (draft.busy) event.preventDefault(); }}>Taslaklarım</Link>
  </div>{hasImages && <p>Metin ve ilan eki kaydedilir; görseller bu oturumda kalır.</p>}{draft.message && <p role="status">{draft.message}</p>}{draft.error && <p role="alert" className="durable-draft-error">{draft.error}</p>}</div>;
}
