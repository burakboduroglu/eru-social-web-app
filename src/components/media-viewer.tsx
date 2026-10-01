import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";
import type { PostImage } from "./media-attachments";
import "./media-attachments.css";

export function MediaViewer({ images, index, onIndexChange, onClose }: {
  images: PostImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onClose, onIndexChange });
  const currentIndex = useRef(index);
  const imageCount = useRef(images.length);
  callbacks.current = { onClose, onIndexChange };
  currentIndex.current = index;
  imageCount.current = images.length;
  const image = images[index];

  useEffect(() => {
    if (!image) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        callbacks.current.onClose();
      } else if (event.key === "ArrowLeft" && imageCount.current > 1) {
        event.preventDefault();
        callbacks.current.onIndexChange((currentIndex.current + imageCount.current - 1) % imageCount.current);
      } else if (event.key === "ArrowRight" && imageCount.current > 1) {
        event.preventDefault();
        callbacks.current.onIndexChange((currentIndex.current + 1) % imageCount.current);
      } else if (event.key === "Tab" && dialog.current) {
        const focusable = [...dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex='-1'])")];
        if (!focusable.length) {
          event.preventDefault();
          dialog.current.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [Boolean(image)]);

  if (!image || typeof document === "undefined") return null;
  const alt = image.altText?.trim() || `Gönderi görseli ${index + 1}`;

  return createPortal(<div
    className="media-viewer-backdrop"
    onClick={event => {
      event.stopPropagation();
      if (event.target === event.currentTarget) onClose();
    }}
    onKeyDown={event => event.stopPropagation()}
  >
    <div ref={dialog} className="media-viewer-dialog" role="dialog" aria-modal="true" aria-label="Görsel görüntüleyici" tabIndex={-1}>
      <header className="media-viewer-toolbar">
        <span>{images.length > 1 ? `${index + 1} / ${images.length}` : "Görsel"}</span>
        <button ref={closeRef} type="button" className="media-viewer-control" aria-label="Görseli kapat" onClick={onClose}><Icon name="close" size={22} /></button>
      </header>
      <div className="media-viewer-stage">
        {images.length > 1 && <button type="button" className="media-viewer-control media-viewer-prev" aria-label="Önceki görsel" onClick={() => onIndexChange((index + images.length - 1) % images.length)}><Icon name="back" size={22} /></button>}
        {failedUrl === image.url ? <p className="media-image-fallback" role="status">Görsel yüklenemedi. {alt}</p> : <img key={image.url} src={image.url} alt={alt} onError={() => setFailedUrl(image.url)} />}
        {images.length > 1 && <button type="button" className="media-viewer-control media-viewer-next" aria-label="Sonraki görsel" onClick={() => onIndexChange((index + 1) % images.length)}><Icon name="back" size={22} /></button>}
      </div>
      {image.altText?.trim() && <p className="media-viewer-caption">{image.altText}</p>}
    </div>
  </div>, document.body);
}
