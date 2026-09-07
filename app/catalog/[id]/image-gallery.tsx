"use client";

import { useEffect, useRef, useState } from "react";

type ImageGalleryProps = { images: string[]; title: string };

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [active, setActive] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fittedSize, setFittedSize] = useState<{ width: number; height: number } | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const current = images[active] ?? images[0];
  const hasMultiple = images.length > 1;
  const resetView = () => { setZoom(1); setFittedSize(null); };
  const selectImage = (index: number) => { setActive(index); resetView(); };
  const showPrevious = () => { setActive((index) => (index - 1 + images.length) % images.length); resetView(); };
  const showNext = () => { setActive((index) => (index + 1) % images.length); resetView(); };
  const fitImage = (image: HTMLImageElement) => {
    const viewport = stage.current;
    if (!viewport || !image.naturalWidth || !image.naturalHeight) return;
    const ratio = Math.min((viewport.clientWidth - 48) / image.naturalWidth, (viewport.clientHeight - 48) / image.naturalHeight);
    setFittedSize({ width: Math.max(1, Math.floor(image.naturalWidth * ratio)), height: Math.max(1, Math.floor(image.naturalHeight * ratio)) });
  };

  useEffect(() => {
    if (!viewerOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
      if (hasMultiple && event.key === "ArrowLeft") showPrevious();
      if (hasMultiple && event.key === "ArrowRight") showNext();
    };
    document.addEventListener("keydown", onKeyDown);
    closeButton.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [viewerOpen, hasMultiple, images.length]);

  if (!current) return <div className="detail-image-empty">暂无可公开浏览的图片</div>;
  return <div className="image-gallery">
    <button type="button" className="image-gallery-main" onClick={() => { resetView(); setViewerOpen(true); }} aria-label={`放大查看${title}图片`}><img src={current} alt={title} /><span>点击放大查看</span></button>
    {hasMultiple && <div className="image-gallery-thumbnails" aria-label="图片列表">{images.map((image, index) => <button type="button" className={index === active ? "active" : ""} onClick={() => selectImage(index)} aria-label={`查看第 ${index + 1} 张图片`} key={image}><img src={image} alt="" /></button>)}</div>}
    {viewerOpen && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={`${title} 图片查看器`} onMouseDown={(event) => { if (event.target === event.currentTarget) setViewerOpen(false); }}>
      <div className="image-lightbox-toolbar"><span>{title}{hasMultiple ? ` · ${active + 1} / ${images.length}` : ""}</span><button ref={closeButton} type="button" onClick={() => setViewerOpen(false)} aria-label="关闭图片查看器">关闭 ×</button></div>
      <div ref={stage} className="image-lightbox-stage" onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.max(1, Math.min(4, value + (event.deltaY < 0 ? 0.2 : -0.2)))); }}>
        {hasMultiple && <button type="button" className="image-lightbox-nav image-lightbox-prev" onClick={showPrevious} aria-label="上一张图片">‹</button>}
        <div className="image-lightbox-canvas" style={fittedSize ? { width: fittedSize.width * zoom, height: fittedSize.height * zoom } : undefined}><img src={current} alt={title} onLoad={(event) => fitImage(event.currentTarget)} /></div>
        {hasMultiple && <button type="button" className="image-lightbox-nav image-lightbox-next" onClick={showNext} aria-label="下一张图片">›</button>}
        <span className="image-lightbox-help">滚轮缩放 · 右侧滚动条查看</span>
      </div>
      {hasMultiple && <div className="image-lightbox-thumbnails" aria-label="图片缩略图">{images.map((image, index) => <button type="button" className={index === active ? "active" : ""} onClick={() => selectImage(index)} aria-label={`查看第 ${index + 1} 张图片`} key={image}><img src={image} alt="" /></button>)}</div>}
    </div>}
  </div>;
}
