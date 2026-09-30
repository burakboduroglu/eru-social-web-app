/** Collects safe duration values for a standard Server-Timing response header. */
export class ServerTiming {
  private readonly entries: Array<{ name: string; duration: number }> = [];

  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await operation();
    } finally {
      this.add(name, performance.now() - start);
    }
  }

  add(name: string, durationMs: number): void {
    // Server-Timing metric names are tokens; reject arbitrary text so values,
    // identifiers, and other request data can never enter the header.
    if (!/^[A-Za-z][A-Za-z0-9_*-]*$/.test(name)) {
      throw new TypeError("Invalid Server-Timing metric name.");
    }
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new TypeError("Server-Timing duration must be a finite non-negative number.");
    }
    this.entries.push({ name, duration: durationMs });
  }

  toHeaderValue(): string {
    return this.entries
      .map(({ name, duration }) => `${name};dur=${duration.toFixed(1)}`)
      .join(", ");
  }
}
