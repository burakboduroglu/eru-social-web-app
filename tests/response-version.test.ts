import { describe, expect, test } from "bun:test";
import { allocateResponseVersion, responseVersion, tagResponseVersion } from "../src/lib/response-version";

describe("response version metadata", () => {
  test("tags nested response objects without changing their JSON shape", () => {
    const response = { posts: [{ id: "post-1", actor: { id: "user-1" } }] };
    const version = allocateResponseVersion();

    expect(tagResponseVersion(response, version)).toBe(response);
    expect(responseVersion(response)).toBe(version);
    expect(responseVersion(response.posts)).toBe(version);
    expect(responseVersion(response.posts[0])).toBe(version);
    expect(responseVersion(response.posts[0].actor)).toBe(version);
    expect(JSON.stringify(response)).toBe('{"posts":[{"id":"post-1","actor":{"id":"user-1"}}]}');
  });

  test("orders versions monotonically and leaves untagged primitives at zero", () => {
    const first = allocateResponseVersion();
    const second = allocateResponseVersion();
    expect(second).toBeGreaterThan(first);
    expect(responseVersion({})).toBe(0);
    expect(responseVersion(false)).toBe(0);
  });
});
