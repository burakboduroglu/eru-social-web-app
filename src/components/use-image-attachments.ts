import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError, parseRetryAfter } from "../lib/errors";
import {
  ImageUploadState,
  MAX_IMAGE_ATTACHMENTS,
  validateImageSelection,
  type ImageUploadTicket,
} from "../lib/image-upload-state";
import { supabase } from "../lib/supabase";
import type { StagedImage } from "./media-attachments";

type UploadedImage = {
  objectPath: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
};

type ActiveUpload = {
  scopeKey: string;
  ticket: ImageUploadTicket;
  controller: AbortController;
  accessToken?: string;
};

export type ReadyImageReference = { objectPath: string; altText: string; position: number };

function requestKey(scopeKey: string, clientId: string) {
  return JSON.stringify([scopeKey, clientId]);
}

function uploadError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "Görsel yüklenemedi. Tekrar dene.";
}

async function readJson<T>(response: Response): Promise<T> {
  const parsed: unknown = await response.json().catch(() => ({}));
  const data = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  if (!response.ok) {
    throw new ApiError(response.status, typeof data.error === "string" ? data.error : "Görsel yüklenemedi.", parseRetryAfter(response.headers.get("Retry-After")));
  }
  return data as T;
}

function validUpload(data: UploadedImage): boolean {
  return typeof data.objectPath === "string" && data.objectPath.length > 0
    && typeof data.url === "string" && data.url.length > 0
    && ["image/jpeg", "image/png", "image/webp"].includes(data.mimeType)
    && Number.isSafeInteger(data.byteSize) && data.byteSize > 0
    && Number.isSafeInteger(data.width) && data.width > 0
    && Number.isSafeInteger(data.height) && data.height > 0;
}

async function deleteUploadedImage(objectPath: string, accessToken: string) {
  try {
    await fetch(`/api/media/images?path=${encodeURIComponent(objectPath)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      keepalive: true,
    });
  } catch {
    // Orphan cleanup is best effort; the server also rejects deletion of referenced images.
  }
}

/** Owns staged image uploads for exactly one account and composer context. */
export function useImageAttachments(accountId: string, contextId: string) {
  const scopeKey = JSON.stringify([accountId, contextId]);
  const [view, setView] = useState<{ scopeKey: string; items: StagedImage[] }>(() => ({ scopeKey, items: [] }));
  const [selectionState, setSelectionState] = useState<{ scopeKey: string; message: string }>(() => ({ scopeKey, message: "" }));
  const activeScope = useRef(scopeKey);
  const itemsByScope = useRef(new Map<string, StagedImage[]>());
  const uploads = useRef(new Map<string, ActiveUpload>());
  const accessTokens = useRef(new Map<string, string>());
  const objectUrls = useRef(new Set<string>());
  const registry = useRef<ImageUploadState | null>(null);

  if (!registry.current) registry.current = new ImageUploadState(scopeKey);
  registry.current.setScope(scopeKey);
  activeScope.current = scopeKey;
  if (view.scopeKey !== scopeKey) {
    itemsByScope.current.set(scopeKey, []);
    setView({ scopeKey, items: [] });
  }
  if (!itemsByScope.current.has(scopeKey)) itemsByScope.current.set(scopeKey, view.scopeKey === scopeKey ? view.items : []);

  const items = view.scopeKey === scopeKey ? view.items : [];

  const commitItems = useCallback((forScope: string, next: StagedImage[]) => {
    itemsByScope.current.set(forScope, next);
    if (activeScope.current === forScope) setView({ scopeKey: forScope, items: next });
  }, []);

  const revokePreview = useCallback((url: string) => {
    if (!objectUrls.current.delete(url)) return;
    URL.revokeObjectURL(url);
  }, []);

  const cleanupOwnedObject = useCallback(async (objectPath: string) => {
    const token = accessTokens.current.get(objectPath);
    accessTokens.current.delete(objectPath);
    if (token) await deleteUploadedImage(objectPath, token);
  }, []);

  const disposeItem = useCallback(async (forScope: string, item: StagedImage) => {
    const key = requestKey(forScope, item.clientId);
    const active = uploads.current.get(key);
    if (active) {
      registry.current?.cancel(active.ticket);
      active.controller.abort();
      uploads.current.delete(key);
    }
    revokePreview(item.previewUrl);
    if (item.objectPath) await cleanupOwnedObject(item.objectPath);
  }, [cleanupOwnedObject, revokePreview]);

  const disposeScope = useCallback(async (forScope: string, clearVisible = false) => {
    const scopedItems = itemsByScope.current.get(forScope) ?? [];
    itemsByScope.current.delete(forScope);
    if (activeScope.current === forScope) registry.current?.invalidateAll();

    const work: Promise<void>[] = [];
    for (const [key, active] of uploads.current) {
      if (active.scopeKey !== forScope) continue;
      active.controller.abort();
      uploads.current.delete(key);
    }
    for (const item of scopedItems) work.push(disposeItem(forScope, item));
    if (clearVisible && activeScope.current === forScope) setView({ scopeKey: forScope, items: [] });
    await Promise.allSettled(work);
  }, [disposeItem]);

  useEffect(() => {
    setSelectionState(current => current.scopeKey === scopeKey && !current.message ? current : { scopeKey, message: "" });
    return () => { void disposeScope(scopeKey); };
  }, [disposeScope, scopeKey]);

  const setItems: Dispatch<SetStateAction<StagedImage[]>> = useCallback(nextOrUpdate => {
    if (activeScope.current !== scopeKey) return;
    const previous = itemsByScope.current.get(scopeKey) ?? [];
    const next = typeof nextOrUpdate === "function" ? nextOrUpdate(previous) : nextOrUpdate;
    const nextIds = new Set(next.map(item => item.clientId));
    commitItems(scopeKey, next);
    for (const removed of previous) if (!nextIds.has(removed.clientId)) void disposeItem(scopeKey, removed);
  }, [commitItems, disposeItem, scopeKey]);

  const startUpload = useCallback(async (item: StagedImage) => {
    const file = item.file;
    if (!file || activeScope.current !== scopeKey) return;
    const currentRegistry = registry.current;
    if (!currentRegistry) return;
    const ticket = currentRegistry.begin(item.clientId);
    const controller = new AbortController();
    const key = requestKey(scopeKey, item.clientId);
    const active: ActiveUpload = { scopeKey, ticket, controller };
    uploads.current.set(key, active);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== accountId) throw new ApiError(401, "Tekrar giriş yapmalısın.");
      active.accessToken = session.access_token;
      if (!currentRegistry.isCurrent(ticket)) return;

      const response = await fetch("/api/media/images", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": file.type,
        },
        body: file,
        signal: controller.signal,
      });
      const uploaded = await readJson<UploadedImage>(response);
      if (!validUpload(uploaded) || uploaded.mimeType !== file.type || uploaded.byteSize !== file.size) {
        if (typeof uploaded.objectPath === "string" && uploaded.objectPath && active.accessToken) {
          await deleteUploadedImage(uploaded.objectPath, active.accessToken);
        }
        throw new Error("Sunucudan geçerli görsel bilgisi alınamadı.");
      }
      if (!currentRegistry.isCurrent(ticket)) {
        await deleteUploadedImage(uploaded.objectPath, session.access_token);
        return;
      }

      accessTokens.current.set(uploaded.objectPath, session.access_token);
      const latest = itemsByScope.current.get(scopeKey) ?? [];
      commitItems(scopeKey, latest.map(current => current.clientId === item.clientId
        ? {
            ...current,
            file: undefined,
            objectPath: uploaded.objectPath,
            previewUrl: current.previewUrl,
            mimeType: uploaded.mimeType,
            byteSize: uploaded.byteSize,
            width: uploaded.width,
            height: uploaded.height,
            status: "ready",
            error: undefined,
          }
        : current));
    } catch (error) {
      if (currentRegistry.isCurrent(ticket)) {
        const latest = itemsByScope.current.get(scopeKey) ?? [];
        commitItems(scopeKey, latest.map(current => current.clientId === item.clientId
          ? { ...current, status: "error", error: uploadError(error) }
          : current));
      }
    } finally {
      if (uploads.current.get(key) === active) uploads.current.delete(key);
    }
  }, [accountId, commitItems, scopeKey]);

  const selectFiles = useCallback((files: File[]) => {
    if (activeScope.current !== scopeKey) return;
    setSelectionState({ scopeKey, message: "" });
    const current = itemsByScope.current.get(scopeKey) ?? [];
    const { accepted, errors } = validateImageSelection(files, current.length);
    if (!accepted.length) {
      setSelectionState({ scopeKey, message: errors.join(" ") });
      return;
    }

    const additions: StagedImage[] = [];
    const selectionErrors = [...errors];
    for (const file of accepted) {
      try {
        const previewUrl = URL.createObjectURL(file);
        objectUrls.current.add(previewUrl);
        additions.push({
          clientId: crypto.randomUUID(),
          previewUrl,
          file,
          mimeType: file.type,
          byteSize: file.size,
          altText: "",
          status: "uploading",
        });
      } catch {
        selectionErrors.push(`${file.name}: Önizleme hazırlanamadı. Başka bir görsel seç.`);
      }
    }
    setSelectionState({ scopeKey, message: selectionErrors.join(" ") });
    if (!additions.length) return;
    commitItems(scopeKey, [...current, ...additions]);
    for (const item of additions) void startUpload(item);
  }, [commitItems, scopeKey, startUpload]);

  const retry = useCallback((item: StagedImage) => {
    if (activeScope.current !== scopeKey || !item.file) return;
    const current = itemsByScope.current.get(scopeKey) ?? [];
    if (!current.some(value => value.clientId === item.clientId)) return;
    const next = current.map(value => value.clientId === item.clientId
      ? { ...value, status: "uploading" as const, error: undefined }
      : value);
    commitItems(scopeKey, next);
    const retryItem = next.find(value => value.clientId === item.clientId);
    if (retryItem) void startUpload(retryItem);
  }, [commitItems, scopeKey, startUpload]);

  const remove = useCallback((clientId: string) => {
    setItems(current => current.filter(item => item.clientId !== clientId));
  }, [setItems]);

  const discard = useCallback(async () => {
    setSelectionState({ scopeKey, message: "" });
    await disposeScope(scopeKey, true);
  }, [disposeScope, scopeKey]);

  const clearAfterPublish = useCallback(() => {
    setSelectionState({ scopeKey, message: "" });
    registry.current?.invalidateAll();
    for (const [key, active] of uploads.current) {
      if (active.scopeKey !== scopeKey) continue;
      active.controller.abort();
      uploads.current.delete(key);
    }
    const current = itemsByScope.current.get(scopeKey) ?? [];
    for (const item of current) revokePreview(item.previewUrl);
    // These paths now belong to the published post and must never be cleaned up here.
    for (const item of current) if (item.objectPath) accessTokens.current.delete(item.objectPath);
    itemsByScope.current.set(scopeKey, []);
    if (activeScope.current === scopeKey) setView({ scopeKey, items: [] });
  }, [revokePreview, scopeKey]);

  const readyMedia: ReadyImageReference[] = items.flatMap((item, position) => item.status === "ready" && item.objectPath
    ? [{ objectPath: item.objectPath, altText: item.altText.slice(0, 1000), position }]
    : []);
  const hasPending = items.some(item => item.status === "uploading");
  const hasErrors = items.some(item => item.status === "error");
  const canPublishImages = items.length === 0 || (items.length <= MAX_IMAGE_ATTACHMENTS && !hasPending && !hasErrors && readyMedia.length === items.length);

  return {
    items,
    setItems,
    selectFiles,
    retry,
    remove,
    clearAfterPublish,
    discard,
    readyMedia,
    hasPending,
    hasErrors,
    canPublishImages,
    selectionError: selectionState.scopeKey === scopeKey ? selectionState.message : "",
  };
}
