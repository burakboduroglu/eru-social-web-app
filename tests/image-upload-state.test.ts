import { describe, expect, test } from "bun:test";
import {
  ImageUploadState,
  MAX_IMAGE_BYTES,
  validateImageSelection,
} from "../src/lib/image-upload-state";

describe("image upload state", () => {
  test("invalidates an earlier completion when an upload is retried", () => {
    const state = new ImageUploadState("account-a:root");
    const firstAttempt = state.begin("image-a");
    const retry = state.begin("image-a");

    expect(state.isCurrent(firstAttempt)).toBe(false);
    expect(state.isCurrent(retry)).toBe(true);
  });

  test("invalidates removed uploads and all uploads on discard or context change", () => {
    const state = new ImageUploadState("account-a:root");
    const removed = state.begin("image-a");
    state.cancel(removed);
    expect(state.isCurrent(removed)).toBe(false);

    const pending = state.begin("image-b");
    state.invalidateAll();
    expect(state.isCurrent(pending)).toBe(false);

    const previousContext = state.begin("image-c");
    state.setScope("account-b:reply-1");
    expect(state.isCurrent(previousContext)).toBe(false);
    expect(state.isCurrent(state.begin("image-c"))).toBe(true);
  });

  test("validates MIME, byte size, and the remaining four-image capacity", () => {
    const supported = new File(["ok"], "photo.png", { type: "image/png" });
    const empty = new File([], "empty.png", { type: "image/png" });
    const boundary = new File([new Uint8Array(MAX_IMAGE_BYTES)], "boundary.jpg", { type: "image/jpeg" });
    const tooLarge = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "large.webp", { type: "image/webp" });
    const unsupported = new File(["gif"], "motion.gif", { type: "image/gif" });
    const fourth = new File(["ok"], "four.jpg", { type: "image/jpeg" });
    const overLimit = new File(["ok"], "five.jpg", { type: "image/jpeg" });
    const result = validateImageSelection([supported, empty, tooLarge, unsupported, fourth, overLimit], 2);

    expect(result.accepted).toEqual([supported, fourth]);
    expect(result.errors).toHaveLength(4);
    expect(validateImageSelection([boundary], 0).accepted).toEqual([boundary]);
    expect(validateImageSelection([supported], 4).accepted).toEqual([]);
  });
});
