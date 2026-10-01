import { useRef, useState, type ChangeEvent } from "react";
import { Icon } from "./icon";
import { MediaViewer } from "./media-viewer";
import { MAX_IMAGE_ATTACHMENTS, validateImageSelection } from "../lib/image-upload-state";
import "./media-attachments.css";

export type StagedImageStatus = "uploading" | "ready" | "error";

export type StagedImage = {
  clientId: string;
  previewUrl: string;
  file?: File;
  objectPath?: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  altText: string;
  status: StagedImageStatus;
  error?: string;
};

export function MediaAttachments({
  items,
  disabled = false,
  onChange,
  onSelectFiles,
  onRetry,
}: {
  items: StagedImage[];
  disabled?: boolean;
  onChange: (items: StagedImage[]) => void;
  onSelectFiles: (files: File[]) => void;
  onRetry?: (item: StagedImage) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [selectionError, setSelectionError] = useState("");

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    setSelectionError("");
    if (!files.length) return;

    const { accepted, errors } = validateImageSelection(files, items.length);
    setSelectionError(errors.join(" "));
    if (accepted.length) onSelectFiles(accepted);
  }

  function remove(clientId: string) {
    onChange(items.filter(item => item.clientId !== clientId));
  }

  function updateAltText(clientId: string, altText: string) {
    onChange(items.map(item => item.clientId === clientId ? { ...item, altText: altText.slice(0, 1000) } : item));
  }

  return <section className="media-attachments" aria-label="Gönderi görselleri">
    <input
      ref={input}
      className="media-file-input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      disabled={disabled || items.length >= MAX_IMAGE_ATTACHMENTS}
      aria-label="JPEG, PNG veya WebP görselleri seç"
      onChange={selectFiles}
    />
    <div className="media-attachments-heading">
      <span>Görseller <small>{items.length}/{MAX_IMAGE_ATTACHMENTS}</small></span>
      <button
        type="button"
        className="media-add-button"
        disabled={disabled || items.length >= MAX_IMAGE_ATTACHMENTS}
        onClick={() => input.current?.click()}
      ><Icon name="camera" size={18} /><span>Görsel ekle</span></button>
    </div>
    {selectionError && <p className="media-selection-error" role="alert">{selectionError}</p>}
    {!!items.length && <div className={`staged-image-grid staged-image-count-${items.length}`}>
      {items.map((item, index) => <article key={item.clientId} className="staged-image-card">
        <div className="staged-image-preview">
          <img src={item.previewUrl} alt={item.altText.trim() || `Gönderi görseli ${index + 1}`} />
          {item.status === "uploading" && <span className="staged-image-status" role="status">Yükleniyor…</span>}
          {item.status === "error" && <span className="staged-image-status is-error" role="status">{item.error || "Yükleme başarısız"}</span>}
          <button
            type="button"
            className="staged-image-remove"
            aria-label={item.status === "uploading" ? "Görsel yüklemesini iptal et" : "Görseli kaldır"}
            disabled={disabled}
            onClick={() => remove(item.clientId)}
          ><Icon name="close" size={16} /></button>
        </div>
        <label className="staged-image-alt">
          <span>Alternatif metin</span>
          <textarea
            value={item.altText}
            maxLength={1000}
            rows={2}
            disabled={disabled}
            placeholder="Görseli kısaca açıkla"
            onChange={event => updateAltText(item.clientId, event.currentTarget.value)}
          />
        </label>
        {item.status === "error" && onRetry && <button type="button" className="staged-image-retry" disabled={disabled} onClick={() => onRetry(item)}>Tekrar dene</button>}
      </article>)}
    </div>}
  </section>;
}

export type PostImage = {
  id: string;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  position?: number;
};

export function PostImages({ images }: { images: PostImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const ordered = [...images].sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  if (!ordered.length) return null;

  return <>
    <div className={`post-image-grid post-image-count-${Math.min(ordered.length, 4)}`}>
      {ordered.map((image, index) => {
        const alt = image.altText?.trim() || `Gönderi görseli ${index + 1}`;
        const ratio = ordered.length === 1 && image.width && image.height ? `${image.width} / ${image.height}` : undefined;
        return <button
          type="button"
          key={image.id}
          className="post-image-thumb"
          style={ratio ? { aspectRatio: ratio } : undefined}
          aria-label={`${alt} görselini büyük görüntüle`}
          onClick={event => { event.stopPropagation(); setActiveIndex(index); }}
          onKeyDown={event => event.stopPropagation()}
        >{failedImages.has(image.id) ? <span className="media-image-fallback" role="img" aria-label={alt}>Görsel yüklenemedi</span> : <img src={image.url} alt={alt} loading="lazy" onError={() => setFailedImages(previous => new Set(previous).add(image.id))} />}</button>;
      })}
    </div>
    {activeIndex !== null && <MediaViewer
      images={ordered}
      index={activeIndex}
      onIndexChange={setActiveIndex}
      onClose={() => setActiveIndex(null)}
    />}
  </>;
}
