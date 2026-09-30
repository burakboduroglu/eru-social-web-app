type PendingEntry = {
  state: "pending";
  promise: Promise<unknown>;
};

type CachedEntry = {
  state: "cached";
  value: unknown;
  expiresAt: number;
};

type Entry = PendingEntry | CachedEntry;

/** A small in-memory cache that coalesces concurrent requests by key. */
export class RequestCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxEntries = 100,
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError("maxEntries must be a positive integer.");
    }
  }

  get<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const current = this.entries.get(key);
    if (current?.state === "pending") {
      this.touch(key, current);
      return current.promise as Promise<T>;
    }
    if (current?.state === "cached") {
      if (current.expiresAt > this.now()) {
        this.touch(key, current);
        return Promise.resolve(current.value as T);
      }
      this.entries.delete(key);
    }

    this.makeRoom();
    const pending: PendingEntry = {
      state: "pending",
      promise: Promise.resolve().then(loader),
    };
    this.entries.set(key, pending);

    pending.promise = pending.promise.then(
      value => {
        // Invalidation or a replacement request may have removed this entry.
        // Its current callers still receive the value, but it cannot repopulate
        // the cache or disturb the newer entry.
        if (this.entries.get(key) === pending) {
          this.entries.set(key, {
            state: "cached",
            value,
            expiresAt: this.now() + Math.max(0, ttlMs),
          });
        }
        return value;
      },
      error => {
        if (this.entries.get(key) === pending) this.entries.delete(key);
        throw error;
      },
    );
    return pending.promise as Promise<T>;
  }

  invalidate(predicate?: (key: string) => boolean): void {
    for (const key of this.entries.keys()) {
      if (!predicate || predicate(key)) this.entries.delete(key);
    }
  }

  private touch(key: string, entry: Entry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private makeRoom(): void {
    if (this.entries.size < this.maxEntries) return;
    // Prefer removing the least-recently-used completed value. If every entry
    // is pending, evict the oldest pending key; its callers still resolve and
    // its completion is guarded by entry identity above.
    let victim: string | undefined;
    for (const [key, entry] of this.entries) {
      if (entry.state === "cached") {
        victim = key;
        break;
      }
      victim ??= key;
    }
    if (victim !== undefined) this.entries.delete(victim);
  }
}
