import { decodeCursor, encodeCursor, type KeysetCursor } from "./cursor";
import { HttpError } from "./validation";
export function scopedCursor(value: string | null, scope: string): KeysetCursor | undefined {
    if (value === null)
        return undefined;
    try {
        if (!value || value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value))
            throw new Error();
        const bytes = Buffer.from(value, "base64url");
        if (bytes.toString("base64url") !== value)
            throw new Error();
        const parsed = JSON.parse(bytes.toString("utf8"));
        if (parsed.scope !== scope || typeof parsed.key !== "string")
            throw new Error();
        return decodeCursor(parsed.key);
    }
    catch {
        throw new HttpError(400, "Sayfa imleci bu aramaya ait değil. İlk sayfadan başla.");
    }
}
export function nextScopedCursor(scope: string, row: KeysetCursor) {
    const key = encodeCursor({ createdAt: row.createdAt, id: row.id });
    return Buffer.from(JSON.stringify({ scope, key })).toString("base64url");
}
