import { useCallback, useEffect, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import {
  clearComposerDraft,
  getComposerDraft,
  hasUnsentComposerDraft,
  setComposerAttachments,
  setComposerDraft,
  type ComposerDraftScope,
} from "../lib/composer-draft";

/** Keeps unsent composer state in memory for this account and composition context. */
export function useComposerDraft(accountId: string, scope: ComposerDraftScope, options: { hasAttachments?: boolean; onDiscard?: () => void } = {}) {
  const scopeKey = JSON.stringify([accountId, scope]);
  const [state, setState] = useState(() => ({
    scopeKey,
    draft: getComposerDraft(accountId, scope),
  }));
  useEffect(() => {
    setComposerAttachments(accountId, scope, !!options.hasAttachments);
    return () => setComposerAttachments(accountId, scope, false);
  }, [accountId, scopeKey, options.hasAttachments]);

  // Route params can change while React reuses the same page component. Switch
  // to the new account/context before rendering its composer or accepting input.
  let draft = state.draft;
  if (state.scopeKey !== scopeKey) {
    draft = getComposerDraft(accountId, scope);
    setState({ scopeKey, draft });
  }

  const update = useCallback((next: (value: string) => string) => {
    setState(current => {
      const currentDraft = current.scopeKey === scopeKey ? current.draft : getComposerDraft(accountId, scope);
      const nextDraft = { ...currentDraft, value: next(currentDraft.value) };
      setComposerDraft(accountId, scope, nextDraft);
      return { scopeKey, draft: nextDraft };
    });
  }, [accountId, scope, scopeKey]);

  const setValue = useCallback<React.Dispatch<React.SetStateAction<string>>>(value => {
    update(current => typeof value === "function" ? value(current) : value);
  }, [update]);

  const setTarget = useCallback<React.Dispatch<React.SetStateAction<string>>>(target => {
    setState(current => {
      const currentDraft = current.scopeKey === scopeKey ? current.draft : getComposerDraft(accountId, scope);
      const nextDraft = {
        ...currentDraft,
        target: typeof target === "function" ? target(currentDraft.target) : target,
      };
      setComposerDraft(accountId, scope, nextDraft);
      return { scopeKey, draft: nextDraft };
    });
  }, [accountId, scope, scopeKey]);

  const clearDraft = useCallback(() => {
    clearComposerDraft(accountId, scope);
    setState({ scopeKey, draft: { value: "", target: "" } });
  }, [accountId, scope, scopeKey]);
  const setJobAttachment = useCallback((jobAttachment: { jobId: string | null } | null) => {
    setState(current => {
      const currentDraft = current.scopeKey === scopeKey ? current.draft : getComposerDraft(accountId, scope);
      const nextDraft = { ...currentDraft, jobAttachment };
      setComposerDraft(accountId, scope, nextDraft);
      return { scopeKey, draft: nextDraft };
    });
  }, [accountId, scope, scopeKey]);

  // Read the store inside the guards so session teardown can clear the map
  // without waiting for this mounted hook to rerender first.
  const hasUnsentText = useCallback(
    () => hasUnsentComposerDraft(accountId, scope),
    [accountId, scope],
  );
  useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (current.pathname === next.pathname || !hasUnsentText()) return false;
      const discard = window.confirm("Taslak silinsin ve sayfadan ayrılınsın mı?");
      if (discard) { clearDraft(); options.onDiscard?.(); }
      return !discard;
    },
    enableBeforeUnload: hasUnsentText,
  });

  return { value: draft.value, setValue, target: draft.target, setTarget, clearDraft, jobAttachment: draft.jobAttachment || null, setJobAttachment };
}
