import { createHash } from "node:crypto";
import { HttpError } from "./validation";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export type ImageMetadata = { mimeType: "image/jpeg" | "image/png" | "image/webp"; byteSize: number; width: number; height: number; sha256: string };
const invalid = () => new HttpError(400, "Geçerli bir JPEG, PNG veya WebP görseli seç.");
function dimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 40_000_000) {
    throw new HttpError(400, "Görsel boyutları en fazla 8192 × 8192 ve 40 milyon piksel olmalı.");
  }
  return { width, height };
}

// Container and dimension validation, not a full compressed-pixel decoder.
export function inspectImage(bytes: Uint8Array, claimedType: string): ImageMetadata {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new HttpError(400, "Görsel en fazla 5 MiB olmalı.");
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let mimeType: ImageMetadata["mimeType"];
  let size: { width: number; height: number } | undefined;
  if (data.length >= 33 && data.subarray(0, 8).equals(new Uint8Array([137,80,78,71,13,10,26,10]))) {
    mimeType = "image/png";
    let offset = 8;
    let header = false, pixels = false, end = false;
    while (offset + 12 <= data.length) {
      const length = data.readUInt32BE(offset);
      if (offset + length + 12 > data.length) throw invalid();
      const kind = data.toString("ascii", offset + 4, offset + 8);
      if (!header && kind !== "IHDR") throw invalid();
      if (kind === "IHDR") {
        if (header || length !== 13 || data[offset + 18] !== 0 || data[offset + 19] !== 0 || data[offset + 20] > 1) throw invalid();
        size = dimensions(data.readUInt32BE(offset + 8), data.readUInt32BE(offset + 12));
        const depth = data[offset + 16], color = data[offset + 17];
        const depths: Record<number, number[]> = { 0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16] };
        if (!depths[color]?.includes(depth)) throw invalid();
        header = true;
      } else if (kind === "IDAT") pixels ||= length > 0;
      else if (kind === "acTL") throw new HttpError(400, "Hareketli görseller için GIF seçiciyi kullan.");
      else if (kind === "IEND") {
        if (length !== 0 || offset + 12 !== data.length) throw invalid();
        end = true;
      }
      offset += length + 12;
    }
    if (!header || !pixels || !end || offset !== data.length) throw invalid();
  } else if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    mimeType = "image/webp";
    if (data.readUInt32LE(4) + 8 !== data.length) throw invalid();
    let offset = 12, pixels = false;
    while (offset + 8 <= data.length) {
      const length = data.readUInt32LE(offset + 4), start = offset + 8;
      if (start + length + (length % 2) > data.length) throw invalid();
      const kind = data.toString("ascii", offset, offset + 4);
      if (kind === "ANIM" || kind === "ANMF") throw new HttpError(400, "Hareketli görseller için GIF seçiciyi kullan.");
      if (kind === "VP8X") {
        if (length !== 10 || (data[start] & 2)) throw invalid();
        size = dimensions(data.readUIntLE(start + 4, 3) + 1, data.readUIntLE(start + 7, 3) + 1);
      } else if (kind === "VP8 ") {
        if (length <= 10 || (data[start] & 1) || !data.subarray(start + 3, start + 6).equals(new Uint8Array([157,1,42]))) throw invalid();
        const frame = dimensions(data.readUInt16LE(start + 6) & 0x3fff, data.readUInt16LE(start + 8) & 0x3fff);
        if (size && (size.width !== frame.width || size.height !== frame.height)) throw invalid();
        size = frame; pixels = true;
      } else if (kind === "VP8L") {
        if (length <= 5 || data[start] !== 47) throw invalid();
        const bits = data.readUInt32LE(start + 1);
        if (bits >>> 29) throw invalid();
        const frame = dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
        if (size && (size.width !== frame.width || size.height !== frame.height)) throw invalid();
        size = frame; pixels = true;
      }
      offset = start + length + (length % 2);
    }
    if (!pixels || !size || offset !== data.length) throw invalid();
  } else if (data.length >= 4 && data[0] === 255 && data[1] === 216) {
    mimeType = "image/jpeg";
    let offset = 2, pixels = false, end = false;
    while (offset < data.length) {
      if (data[offset++] !== 255) throw invalid();
      while (data[offset] === 255) offset += 1;
      const marker = data[offset++];
      if (marker === 217) { end = offset === data.length; break; }
      if (marker === undefined || marker === 0 || marker === 216 || (marker >= 208 && marker <= 215)) throw invalid();
      if (offset + 2 > data.length) throw invalid();
      const length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) throw invalid();
      if ([192,193,194].includes(marker)) {
        if (length < 8 || data[offset + 2] !== 8 || ![1,3,4].includes(data[offset + 7]) || length !== 8 + 3 * data[offset + 7]) throw invalid();
        size = dimensions(data.readUInt16BE(offset + 5), data.readUInt16BE(offset + 3));
      }
      offset += length;
      if (marker === 218) {
        if (!size || length < 6) throw invalid();
        const start = offset;
        while (offset + 1 < data.length) {
          if (data[offset] === 255) {
            const next = data[offset + 1];
            if (next === 0 || (next >= 208 && next <= 215)) { offset += 2; continue; }
            break;
          }
          offset += 1;
        }
        pixels ||= offset > start;
      }
    }
    if (!size || !pixels || !end) throw invalid();
  } else throw invalid();
  if (!size || claimedType.split(";")[0].trim().toLowerCase() !== mimeType) throw invalid();
  return { mimeType, byteSize: bytes.length, ...size, sha256: createHash("sha256").update(bytes).digest("hex") };
}
