import { HttpError, uuid } from "./validation";

export type KeysetCursor = { createdAt: string; id: string };
export function decodeCursor(value: string | null): KeysetCursor | undefined {
  if (value === null) return undefined;
  try {
    if (!value || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) throw new Error();
    const cursor = JSON.parse(bytes.toString("utf8")) as KeysetCursor;
    if (!cursor || typeof cursor.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.createdAt)) throw new Error();
    // Date validates the calendar only; the original microseconds survive.
    if (new Date(cursor.createdAt).toISOString().slice(0, 19) !== cursor.createdAt.slice(0, 19)) throw new Error();
    return { createdAt: cursor.createdAt, id: uuid(cursor.id) };
  } catch {
    throw new HttpError(400, "Geçersiz sayfa imleci.");
  }
}
export function encodeCursor(cursor: KeysetCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
