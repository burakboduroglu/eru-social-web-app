import { describe, expect, test } from "bun:test";
import {
  clearComposerDraft,
  clearComposerDraftsForAccount,
  getComposerDraft,
  hasUnsentComposerDraft,
  setComposerAttachments,
  hasComposerDraftsForAccount,
  isComposerDraftNonEmpty,
  setComposerDraft,
  type ComposerDraft,
  type ComposerDraftScope,
} from "../src/lib/composer-draft";

const root: ComposerDraftScope = { kind: "root" };
const community: ComposerDraftScope = { kind: "community", communityId: "community-a" };
const reply: ComposerDraftScope = { kind: "reply", threadId: "thread-a" };

function save(account: string, scope: ComposerDraftScope, draft: Partial<ComposerDraft>) {
  setComposerDraft(account, scope, { value: "", target: "", ...draft });
}

describe("composer draft store", () => {
  test("protects image-only drafts and removes their guards on account teardown", () => {
    setComposerAttachments("image-owner", root, true);
    expect(hasUnsentComposerDraft("image-owner", root)).toBe(true);
    expect(hasComposerDraftsForAccount("image-owner")).toBe(true);
    expect(hasUnsentComposerDraft("other-owner", root)).toBe(false);
    setComposerDraft("image-owner", root, { value: "", target: "" });
    expect(hasUnsentComposerDraft("image-owner", root)).toBe(true);
    clearComposerDraftsForAccount("image-owner");
    expect(hasUnsentComposerDraft("image-owner", root)).toBe(false);
    expect(hasComposerDraftsForAccount("image-owner")).toBe(false);
  });
  test("isolates drafts by account and root, community, and reply context", () => {
    save("account-a", root, { value: "root draft" });
    save("account-a", community, { value: "community draft", target: "community-a" });
    save("account-a", reply, { value: "reply draft" });
    save("account-b", root, { value: "other account" });

    expect(getComposerDraft("account-a", root).value).toBe("root draft");
    expect(getComposerDraft("account-a", community).value).toBe("community draft");
    expect(getComposerDraft("account-a", reply).value).toBe("reply draft");
    expect(getComposerDraft("account-b", root).value).toBe("other account");
    expect(getComposerDraft("account-b", community).value).toBe("");
  });

  test("restores a context's latest value and clears only that context", () => {
    save("account-clear", root, { value: "first" });
    save("account-clear", root, { value: "updated" });
    save("account-clear", reply, { value: "keep me" });

    expect(getComposerDraft("account-clear", root).value).toBe("updated");
    clearComposerDraft("account-clear", root);
    expect(getComposerDraft("account-clear", root)).toEqual({ value: "", target: "" });
    expect(getComposerDraft("account-clear", reply).value).toBe("keep me");
  });

  test("destination-only selection is retained but does not count as an unsent draft", () => {
    save("account-target", root, { target: "community-a" });

    const draft = getComposerDraft("account-target", root);
    expect(draft).toEqual({ value: "", target: "community-a" });
    expect(isComposerDraftNonEmpty(draft)).toBe(false);
    expect(isComposerDraftNonEmpty({ ...draft, value: "   " })).toBe(false);
    expect(isComposerDraftNonEmpty({ ...draft, value: "hello" })).toBe(true);
  });

  test("clears only the departing account's in-memory drafts", () => {
    save("account-session-a", root, { value: "private draft" });
    save("account-session-a", reply, { value: "private reply" });
    save("account-session-b", root, { value: "another account" });

    clearComposerDraftsForAccount("account-session-a");
    const clearedDraft = getComposerDraft("account-session-a", root);
    expect(clearedDraft.value).toBe("");
    expect(isComposerDraftNonEmpty(clearedDraft)).toBe(false);
    expect(hasComposerDraftsForAccount("account-session-a")).toBe(false);
    expect(getComposerDraft("account-session-a", reply).value).toBe("");
    expect(getComposerDraft("account-session-b", root).value).toBe("another account");
    expect(hasComposerDraftsForAccount("account-session-b")).toBe(true);
  });
});
