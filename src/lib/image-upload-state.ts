export const MAX_IMAGE_ATTACHMENTS = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ImageUploadTicket = {
  scopeKey: string;
  clientId: string;
  generation: number;
  attempt: number;
};

export type ImageSelection = { accepted: File[]; errors: string[] };

export function validateImageSelection(files: File[], existingCount: number): ImageSelection {
  let slots = Math.max(0, MAX_IMAGE_ATTACHMENTS - existingCount);
  const accepted: File[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      errors.push(`${file.name}: JPEG, PNG veya WebP seç.`);
    } else if (file.size === 0) {
      errors.push(`${file.name}: Boş bir dosya seçemezsin.`);
    } else if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`${file.name}: En fazla 5 MB olabilir.`);
    } else if (slots === 0) {
      errors.push("Bir gönderiye en fazla 4 görsel ekleyebilirsin.");
    } else {
      accepted.push(file);
      slots -= 1;
    }
  }
  return { accepted, errors };
}

/** Invalidates stale upload completions after retry, removal, discard, or context change. */
export class ImageUploadState {
  private scopeKey: string;
  private generation = 0;
  private attempts = new Map<string, number>();

  constructor(scopeKey: string) {
    this.scopeKey = scopeKey;
  }

  setScope(scopeKey: string) {
    if (scopeKey === this.scopeKey) return;
    this.scopeKey = scopeKey;
    this.generation += 1;
    this.attempts.clear();
  }

  begin(clientId: string): ImageUploadTicket {
    const attempt = (this.attempts.get(clientId) ?? 0) + 1;
    this.attempts.set(clientId, attempt);
    return { scopeKey: this.scopeKey, clientId, generation: this.generation, attempt };
  }

  cancel(ticket: ImageUploadTicket) {
    if (!this.isCurrent(ticket)) return;
    this.attempts.set(ticket.clientId, ticket.attempt + 1);
  }

  invalidateAll() {
    this.generation += 1;
    this.attempts.clear();
  }

  isCurrent(ticket: ImageUploadTicket) {
    return ticket.scopeKey === this.scopeKey
      && ticket.generation === this.generation
      && this.attempts.get(ticket.clientId) === ticket.attempt;
  }
}
