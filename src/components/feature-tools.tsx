import { useBlocker, useNavigate, useSearch } from "@tanstack/react-router";
import { useRef } from "react";
import { Button } from "./ui/button";
import { useContentLoading } from "./loading";
import "./medium-features.css";
export function FeaturePagination({ nextCursor }: {
    nextCursor: string | null;
}) {
    const search = useSearch({ strict: false }) as Record<string, unknown> & {
        cursor?: string;
        cursorHistory?: string[];
    };
    const navigate = useNavigate(), history = search.cursorHistory || [];
    const loading = useContentLoading();
    if (!search.cursor && !nextCursor)
        return null;
    return <nav className="feature-pagination" aria-label="Sayfalar" aria-busy={loading}><Button variant="outline" disabled={loading || !search.cursor} onClick={() => navigate({ search: { ...search, cursor: history.at(-1) || "", cursorHistory: history.slice(0, -1) } as never })}>Önceki</Button><Button variant="outline" disabled={loading || !nextCursor} onClick={() => navigate({ search: { ...search, cursor: nextCursor || "", cursorHistory: [...history, search.cursor || ""].slice(-20) } as never })}>Sonraki</Button></nav>;
}
export function useFormGuard(values: unknown, initial: unknown) {
    const current = useRef(values);
    current.current = values;
    const original = useRef(JSON.stringify(initial));
    const committed = useRef(false);
    const dirty = () => !committed.current && JSON.stringify(current.current) !== original.current;
    useBlocker({ shouldBlockFn: ({ current, next }) => current.pathname !== next.pathname && dirty() && !window.confirm("Kaydedilmemiş değişiklikler silinsin mi?"), enableBeforeUnload: dirty });
    return { commit: (next?: unknown) => {
            if (next !== undefined) {
                original.current = JSON.stringify(next);
                committed.current = false;
            }
            else
                committed.current = true;
        }, dirty };
}
export function ErrorMessage({ message }: {
    message: string;
}) {
    return message ? <p className="feature-error" role="alert">{message}</p> : null;
}
export function externalDomain(value: string) {
    try {
        return new URL(value).hostname;
    }
    catch {
        return "";
    }
}
export function safeExternal(value: string) {
    try {
        const u = new URL(value);
        return u.protocol === "https:" && !u.username && !u.password && !!u.hostname ? u.href : undefined;
    }
    catch {
        return undefined;
    }
}
export function localInput(value: string | null | undefined) {
    if (!value)
        return "";
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function utcInput(value: string) {
    return value ? new Date(value).toISOString() : null;
}
