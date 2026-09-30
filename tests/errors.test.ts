import { describe, expect, test } from "bun:test";
import { ApiError, describePageError, parseRetryAfter } from "../src/lib/errors";

describe("describePageError", () => {
  test("classifies API statuses and sets retry behavior", () => {
    const cases = [
      [404, "not-found", false],
      [403, "forbidden", false],
      [401, "unauthorized", false],
      [429, "rate-limit", true],
      [503, "unavailable", true],
      [500, "unavailable", true],
      [400, "request", false],
    ] as const;

    for (const [status, kind, retryable] of cases) {
      const result = describePageError(new ApiError(status, "private server detail"));
      expect(result.kind).toBe(kind);
      expect(result.retryable).toBe(retryable);
      expect(result.description).not.toContain("private server detail");
    }
  });

  test("distinguishes offline and network failures", () => {
    expect(describePageError(new TypeError("Failed to fetch"), false).kind).toBe("offline");
    expect(describePageError(new TypeError("Failed to fetch"), true).kind).toBe("network");
    expect(describePageError(new Error("secret token value")).kind).toBe("unexpected");
    expect(describePageError(new Error("secret token value")).description).not.toContain("secret token value");
  });

  test("keeps Retry-After metadata separate from error copy", () => {
    const error = new ApiError(429, "wait", 30);
    expect(error.retryAfter).toBe(30);
    expect(describePageError(error).kind).toBe("rate-limit");
  });
});

describe("parseRetryAfter", () => {
  test("parses numeric seconds", () => {
    expect(parseRetryAfter("12", 0)).toBe(12);
    expect(parseRetryAfter(" 1.5 ", 0)).toBe(1.5);
  });

  test("parses HTTP dates as seconds and clamps past dates", () => {
    const now = Date.parse("Wed, 21 Oct 2015 07:27:00 GMT");
    expect(parseRetryAfter("Wed, 21 Oct 2015 07:27:30 GMT", now)).toBe(30);
    expect(parseRetryAfter("Wed, 21 Oct 2015 07:26:30 GMT", now)).toBe(0);
  });

  test("rejects missing and invalid values", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("tomorrow-ish")).toBeNull();
    expect(parseRetryAfter("-3")).toBeNull();
  });
});
