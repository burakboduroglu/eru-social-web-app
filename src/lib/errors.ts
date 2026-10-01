export class ApiError extends Error {
  readonly status: number;
  readonly retryAfter: number | null;

  constructor(status: number, message: string, retryAfter: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function parseRetryAfter(header: string | null, now = Date.now()): number | null {
  if (header === null) return null;
  const value = header.trim();
  if (!value) return null;

  if (/^-\d+(?:\.\d+)?$/.test(value)) return null;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number.isFinite(Number(value)) ? Number(value) : null;

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, (timestamp - now) / 1000);
}

export type PageErrorKind =
  | "expired"
  | "not-found"
  | "forbidden"
  | "unavailable"
  | "offline"
  | "network"
  | "rate-limit"
  | "unauthorized"
  | "request"
  | "unexpected";

export type PageErrorDescription = {
  kind: PageErrorKind;
  title: string;
  description: string;
  eyebrow: string;
  retryable: boolean;
};

const descriptions: Record<PageErrorKind, Omit<PageErrorDescription, "kind">> = {
  expired: {
    title: "Akışın süresi doldu",
    description: "Güncel gönderilerle ilk sayfadan devam etmek için tekrar dene.",
    eyebrow: "Akışı yenile",
    retryable: true,
  },
  "not-found": {
    title: "Sayfa bulunamadı",
    description: "Aradığın içerik kaldırılmış veya bağlantı değişmiş olabilir.",
    eyebrow: "Burada bir şey yok",
    retryable: false,
  },
  forbidden: {
    title: "Bu içeriğe erişemiyorsun",
    description: "Bu sayfayı görüntülemek için gerekli iznin yok.",
    eyebrow: "Erişim kısıtlı",
    retryable: false,
  },
  unavailable: {
    title: "Şu anda hizmet veremiyoruz",
    description: "Bir sorun oluştu. Biraz bekleyip yeniden deneyebilirsin.",
    eyebrow: "Geçici sorun",
    retryable: true,
  },
  offline: {
    title: "İnternet bağlantın yok",
    description: "Bağlantını kontrol et. Yeniden çevrimiçi olduğunda tekrar deneyebilirsin.",
    eyebrow: "Bağlantı yok",
    retryable: true,
  },
  network: {
    title: "Bağlantı kurulamadı",
    description: "Sunucuya ulaşamadık. Bağlantını kontrol edip tekrar deneyebilirsin.",
    eyebrow: "Bağlantı sorunu",
    retryable: true,
  },
  "rate-limit": {
    title: "Biraz yavaşlayalım",
    description: "Çok fazla istekte bulundun. Biraz bekleyip tekrar deneyebilirsin.",
    eyebrow: "Kısa bir mola",
    retryable: true,
  },
  unauthorized: {
    title: "Oturumun sona ermiş",
    description: "Devam etmek için yeniden giriş yap.",
    eyebrow: "Giriş gerekli",
    retryable: false,
  },
  request: {
    title: "İstek tamamlanamadı",
    description: "İşlem sırasında bir sorun oluştu. Bilgileri kontrol edip tekrar deneyebilirsin.",
    eyebrow: "İşlem başarısız",
    retryable: false,
  },
  unexpected: {
    title: "Beklenmeyen bir sorun oluştu",
    description: "Sayfa yüklenirken bir sorun oluştu. Biraz sonra tekrar deneyebilirsin.",
    eyebrow: "Bir şeyler ters gitti",
    retryable: true,
  },
};

export function describePageError(error: unknown, online = true): PageErrorDescription {
  let kind: PageErrorKind = "unexpected";

  if (error instanceof ApiError) {
    if (error.status === 410) kind = "expired";
    else if (error.status === 404) kind = "not-found";
    else if (error.status === 403) kind = "forbidden";
    else if (error.status === 401) kind = "unauthorized";
    else if (error.status === 429) kind = "rate-limit";
    else if (error.status === 503 || error.status >= 500) kind = "unavailable";
    else if (error.status >= 400) kind = "request";
  } else if (!online) {
    kind = "offline";
  } else if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    kind = "network";
  }

  return { kind, ...descriptions[kind] };
}
