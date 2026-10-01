import { isRedirect, useRouter } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useMe } from "../ui";
import "./saved-searches.css";

export type SaveSearchTab = "posts" | "people" | "communities";
type SaveSearchActionProps = { query: string; tab: SaveSearchTab };
type SaveState = { key: string; status: "idle" | "pending" | "success" | "error"; message: string };

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/gu, " ");
}

export function SaveSearchAction({ query, tab }: SaveSearchActionProps) {
  const router = useRouter();
  const accountId = useMe().profile.id;
  const normalized = normalizeQuery(query);
  const valid = normalized.length >= 2 && normalized.length <= 80;
  const key = `${accountId}:${tab}:${normalized}`;
  const activeRequest = useRef<{ key: string; id: number } | null>(null);
  const requestSequence = useRef(0);
  const currentKey = useRef(key);
  const [state, setState] = useState<SaveState>({ key, status: "idle", message: "" });
  const visibleState = state.key === key ? state : { key, status: "idle" as const, message: "" };

  useLayoutEffect(() => {
    currentKey.current = key;
    requestSequence.current += 1;
    activeRequest.current = null;
    setState({ key, status: "idle", message: "" });
    return () => {
      requestSequence.current += 1;
      activeRequest.current = null;
    };
  }, [key]);

  async function save() {
    if (!valid || !accountId || activeRequest.current?.key === key || visibleState.status === "pending" || visibleState.status === "success") return;
    const request = { key, id: ++requestSequence.current };
    activeRequest.current = request;
    setState({ key, status: "pending", message: "Kaydediliyor…" });
    const isCurrent = () => requestSequence.current === request.id && currentKey.current === key;
    try {
      await api("/saved-searches", "POST", { query: normalized, tab });
      if (!isCurrent()) return;
      setState({ key, status: "success", message: "Arama kaydedildi." });
      void router.invalidate().catch(() => {
        if (isCurrent()) setState({ key, status: "success", message: "Arama kaydedildi. Liste daha sonra yenilenecek." });
      });
    } catch (cause) {
      if (isRedirect(cause)) {
        if (isCurrent()) await router.navigate({ to: "/sign-in" });
        return;
      }
      if (isCurrent()) setState({ key, status: "error", message: cause instanceof Error && "status" in cause && cause.status === 403
        ? "Bu aramayı kaydetme iznin yok."
        : "Arama kaydedilemedi. Tekrar dene." });
    } finally {
      if (activeRequest.current?.id === request.id) activeRequest.current = null;
    }
  }

  if (!query.trim()) return null;
  return <div className="save-search-action" aria-live="polite">
    <button type="button" className="save-search-button" disabled={!valid || visibleState.status === "pending" || visibleState.status === "success"} onClick={() => void save()}>
      {visibleState.status === "pending" ? "Kaydediliyor…" : visibleState.status === "success" ? "Kaydedildi" : "Aramayı kaydet"}
    </button>
    {!valid && <span className="save-search-hint">Arama 2–80 karakter arasında olmalı.</span>}
    {visibleState.message && visibleState.status !== "pending" && <span className={`save-search-message is-${visibleState.status}`} role={visibleState.status === "error" ? "alert" : "status"}>{visibleState.message}</span>}
  </div>;
}
