import { HttpError } from "./validation";
export function enumValue<T extends string>(value: unknown, choices: readonly T[]): T {
    if (typeof value !== "string" || !choices.includes(value as T))
        throw new HttpError(400, "Geçersiz seçenek.");
    return value as T;
}
export function versionValue(value: unknown) {
    if (!Number.isSafeInteger(value) || Number(value) < 1)
        throw new HttpError(400, "Kayıt sürümü gerekli.");
    return Number(value);
}
export function externalHttps(value: unknown, optional = false): string {
    if (optional && (value === undefined || value === null || value === ""))
        return "";
    if (typeof value !== "string" || value.length > 2048 || /[\s\x00-\x1f]/.test(value))
        throw new HttpError(400, "Geçerli bir HTTPS bağlantısı gir.");
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || !url.hostname || url.username || url.password || !/^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^\s]*)?$/.test(value))
            throw new Error();
        return url.href;
    }
    catch {
        throw new HttpError(400, "Geçerli bir HTTPS bağlantısı gir.");
    }
}
export function utcDate(value: unknown, optional = false): string | null {
    if (optional && (value === null || value === undefined || value === ""))
        return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))
        throw new HttpError(400, "Geçerli bir tarih ve saat gir.");
    return new Date(value).toISOString();
}
