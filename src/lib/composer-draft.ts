export type ComposerDraftScope =
  | { kind: "root" }
  | { kind: "community"; communityId: string }
  | { kind: "reply"; threadId: string };

export type ComposerDraft = {
  value: string;
  target: string;
};

const emptyDraft: ComposerDraft = { value: "", target: "" };
const drafts = new Map<string, ComposerDraft>();
const attachmentDrafts = new Set<string>();

export function composerDraftKey(accountId: string, scope: ComposerDraftScope): string {
  return JSON.stringify([accountId, scope.kind, scope.kind === "root" ? "" : scope.kind === "community" ? scope.communityId : scope.threadId]);
}

export function getComposerDraft(accountId: string, scope: ComposerDraftScope): ComposerDraft {
  return drafts.get(composerDraftKey(accountId, scope)) ?? emptyDraft;
}

export function setComposerDraft(accountId: string, scope: ComposerDraftScope, draft: ComposerDraft): void {
  const key = composerDraftKey(accountId, scope);
  if (isComposerDraftNonEmpty(draft)) drafts.set(key, { value: draft.value, target: draft.target });
  else if (draft.target) drafts.set(key, { value: "", target: draft.target });
  else drafts.delete(key);
}

export function clearComposerDraft(accountId: string, scope: ComposerDraftScope): void {
  const key = composerDraftKey(accountId, scope);
  drafts.delete(key);
  attachmentDrafts.delete(key);
}

export function setComposerAttachments(accountId: string, scope: ComposerDraftScope, dirty: boolean): void {
  const key = composerDraftKey(accountId, scope);
  if (dirty) attachmentDrafts.add(key);
  else attachmentDrafts.delete(key);
}

export function hasUnsentComposerDraft(accountId: string, scope: ComposerDraftScope): boolean {
  return isComposerDraftNonEmpty(getComposerDraft(accountId, scope)) || attachmentDrafts.has(composerDraftKey(accountId, scope));
}

export function isComposerDraftNonEmpty(draft: ComposerDraft): boolean {
  return draft.value.trim().length > 0;
}

/** Clears the in-memory drafts for one account, for explicit session teardown. */
export function clearComposerDraftsForAccount(accountId: string): void {
  const prefix = `[${JSON.stringify(accountId)},`;
  for (const key of drafts.keys()) {
    if (key.startsWith(prefix)) drafts.delete(key);
  }
  for (const key of attachmentDrafts) if (key.startsWith(prefix)) attachmentDrafts.delete(key);
}

export function hasComposerDraftsForAccount(accountId: string): boolean {
  const prefix = `[${JSON.stringify(accountId)},`;
  for (const [key, draft] of drafts) {
    if (key.startsWith(prefix) && isComposerDraftNonEmpty(draft)) return true;
  }
  for (const key of attachmentDrafts) if (key.startsWith(prefix)) return true;
  return false;
}
