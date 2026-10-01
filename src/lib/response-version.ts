const versions = new WeakMap<object, number>();
let nextVersion = 0;

/** Allocate request ordering metadata before starting a network request. */
export function allocateResponseVersion(): number {
  nextVersion += 1;
  return nextVersion;
}

/** Tag a parsed response tree without adding enumerable fields to API data. */
export function tagResponseVersion<T>(value: T, version: number): T {
  const seen = new WeakSet<object>();

  function visit(item: unknown): void {
    if (item === null || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    versions.set(item, version);
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
    } else {
      for (const child of Object.values(item)) visit(child);
    }
  }

  visit(value);
  return value;
}

/** Return the request-start version attached to an API response object. */
export function responseVersion(value: unknown): number {
  return value !== null && typeof value === "object" ? versions.get(value) ?? 0 : 0;
}
