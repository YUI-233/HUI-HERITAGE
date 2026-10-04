"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PdfPage = { getViewport: (options: { scale: number }) => { width: number; height: number }; render: (context: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<unknown> } };
type PdfDocument = { numPages: number; getPage: (page: number) => Promise<PdfPage>; destroy?: () => Promise<void> };
type ReaderMode = "single" | "spread";

function trimWhiteMargins(canvas: HTMLCanvasElement, maxEdgeRatio = 1) {
  const context = canvas.getContext("2d");
  if (!context || !canvas.width || !canvas.height) return;
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let top = height; let bottom = -1; let left = width; let right = -1;
  const isContent = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    return pixels[offset] < 245 || pixels[offset + 1] < 245 || pixels[offset + 2] < 245;
  };
  for (let y = 0; y < height; y += 1) {
    let ink = 0;
    for (let x = 0; x < width; x += 3) if (isContent(x, y)) ink += 1;
    if (ink > 2) { top = Math.min(top, y); bottom = y; }
  }
  for (let x = 0; x < width; x += 1) {
    let ink = 0;
    for (let y = Math.max(0, top); y <= Math.min(height - 1, bottom); y += 3) if (isContent(x, y)) ink += 1;
    if (ink > 2) { left = Math.min(left, x); right = x; }
  }
  if (bottom < top || right < left) return;
  const maxHorizontalTrim = Math.floor(width * maxEdgeRatio);
  const maxVerticalTrim = Math.floor(height * maxEdgeRatio);
  left = Math.min(left, maxHorizontalTrim);
  right = Math.max(right, width - maxHorizontalTrim - 1);
  top = Math.min(top, maxVerticalTrim);
  bottom = Math.max(bottom, height - maxVerticalTrim - 1);
  const croppedWidth = right - left + 1; const croppedHeight = bottom - top + 1;
  if (croppedWidth === width && croppedHeight === height) return;
  const copy = document.createElement("canvas"); copy.width = croppedWidth; copy.height = croppedHeight;
  copy.getContext("2d")?.drawImage(canvas, left, top, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
  canvas.width = croppedWidth; canvas.height = croppedHeight;
  canvas.getContext("2d")?.drawImage(copy, 0, 0);
}

function Thumbnail({ pdf, page, active, onSelect }: { pdf: PdfDocument; page: number; active: boolean; onSelect: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null); const holder = useRef<HTMLButtonElement>(null);
  useEffect(() => { const node = holder.current; const target = canvas.current; if (!node || !target) return; let cancelled = false; const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) return; observer.disconnect(); void (async () => { const source = await pdf.getPage(page); const viewport = source.getViewport({ scale: .14 }); const context = target.getContext("2d"); if (!context || cancelled) return; target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height); await source.render({ canvasContext: context, viewport }).promise; if (!cancelled) trimWhiteMargins(target); })().catch(() => undefined); }, { root: node.parentElement, rootMargin: "280px 0px" }); observer.observe(node); return () => { cancelled = true; observer.disconnect(); }; }, [pdf, page]);
  return <button ref={holder} type="button" data-page={page} className={active ? "active" : ""} onClick={onSelect} aria-label={`跳转至第 ${page} 页`}><canvas ref={canvas}/><span>{page}</span></button>;
}

function ContinuousPage({ pdf, page, fit, scale, columns, onVisible }: { pdf: PdfDocument; page: number; fit: "page" | "width" | "custom"; scale: number; columns: 1 | 2; onVisible?: (page: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null); const holder = useRef<HTMLElement>(null); const rendered = useRef(false);
  useEffect(() => {
    const node = holder.current; const target = canvas.current; const host = node?.closest<HTMLDivElement>(".pdf-reader-canvas");
    if (!node || !target || !host) return;
    rendered.current = false;
    let cancelled = false;
    const visibleObserver = onVisible ? new IntersectionObserver(([entry]) => { if (entry.isIntersecting) onVisible(page); }, { root: host, rootMargin: "-35% 0px -55% 0px" }) : null;
    const renderObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || rendered.current) return;
      rendered.current = true;
      renderObserver.disconnect();
      void (async () => {
        const source = await pdf.getPage(page);
        const original = source.getViewport({ scale: 1 });
        const availableWidth = Math.max(120, (host.clientWidth - (columns === 2 ? 100 : 60)) / columns);
        const availableHeight = Math.max(320, host.clientHeight - 64);
        const renderScale = fit === "custom" ? scale : fit === "width" ? availableWidth / original.width : Math.min(availableWidth / original.width, availableHeight / original.height);
        const viewport = source.getViewport({ scale: renderScale });
        const context = target.getContext("2d");
        if (!context || cancelled) return;
        target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
        await source.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) trimWhiteMargins(target, .04);
      })().catch(() => undefined);
    }, { root: host, rootMargin: "110% 0px 110% 0px" });
    visibleObserver?.observe(node); renderObserver.observe(node);
    return () => { cancelled = true; visibleObserver?.disconnect(); renderObserver.disconnect(); };
  }, [columns, fit, onVisible, page, pdf, scale]);
  return <article ref={holder} className="pdf-continuous-page" data-page={page}><canvas ref={canvas}/></article>;
}

export function PdfReader({ documentUrl, title }: { documentUrl: string; title: string }) {
  const viewer = useRef<HTMLElement>(null); const canvasHost = useRef<HTMLDivElement>(null); const thumbnailRail = useRef<HTMLElement>(null); const documentRef = useRef<PdfDocument | null>(null); const currentPageRef = useRef(1);
  const [pdf, setPdf] = useState<PdfDocument | null>(null); const [page, setPage] = useState(1); const [pageInput, setPageInput] = useState("1"); const [total, setTotal] = useState(0); const [scale, setScale] = useState(1.2); const [fit, setFit] = useState<"page" | "width" | "custom">("page"); const [mode, setMode] = useState<ReaderMode>("single"); const [fullscreen, setFullscreen] = useState(false); const [message, setMessage] = useState("正在载入 PDF…");
  const displayedPages = mode === "spread" && page < total ? [page, page + 1] : [page]; const step: 1 | 2 = mode === "spread" ? 2 : 1;
  const scrollToPage = (target: number, behavior: ScrollBehavior = "smooth") => { const host = canvasHost.current; const pageNode = host?.querySelector<HTMLElement>(`[data-page="${target}"]`); if (!host || !pageNode) return; host.scrollTo({ top: host.scrollTop + pageNode.getBoundingClientRect().top - host.getBoundingClientRect().top - 24, behavior }); };
  const goTo = (target: number) => { const bounded = Math.min(Math.max(1, target), total || 1); const next = mode === "spread" ? Math.floor((bounded - 1) / 2) * 2 + 1 : bounded; currentPageRef.current = next; setPage(next); setPageInput(String(next)); scrollToPage(next); };
  const changeFit = (next: "page" | "width" | "custom") => { setFit(next); if (next === "custom") setScale(1.2); };
  const toggleFit = () => changeFit(fit === "page" ? "width" : "page");
  const onContinuousVisible = useCallback((visible: number) => { if (currentPageRef.current === visible) return; currentPageRef.current = visible; setPage(visible); setPageInput(String(visible)); }, []);
  useEffect(() => { let cancelled = false; void (async () => { try { const pdfjsCoreUrl = "/reader-assets/pdf-5.4.624.min.mjs"; const pdfjs = await import(/* webpackIgnore: true */ pdfjsCoreUrl); pdfjs.GlobalWorkerOptions.workerSrc = "/reader-assets/pdf.worker-5.4.624.min.mjs"; const loaded = await pdfjs.getDocument({ url: documentUrl, withCredentials: true, disableRange: false, disableStream: true, disableAutoFetch: true, rangeChunkSize: 65536 }).promise as PdfDocument; if (cancelled) { await loaded.destroy?.(); return; } documentRef.current = loaded; setPdf(loaded); setTotal(loaded.numPages); setMessage(""); } catch (error) { if (!cancelled) setMessage(error instanceof Error && /401|Unauthorized/i.test(error.message) ? "请先登录后阅读此 PDF。" : "PDF 暂时无法加载，请刷新页面后重试。"); } })(); return () => { cancelled = true; void documentRef.current?.destroy?.(); documentRef.current = null; }; }, [documentUrl]);
  useEffect(() => { const next = mode === "spread" ? Math.floor((currentPageRef.current - 1) / 2) * 2 + 1 : currentPageRef.current; currentPageRef.current = next; setPage(next); setPageInput(String(next)); requestAnimationFrame(() => scrollToPage(next, "instant")); }, [mode]);
  useEffect(() => { const rail = thumbnailRail.current; const thumbnail = rail?.querySelector<HTMLButtonElement>(`button[data-page="${page}"]`); if (!rail || !thumbnail) return; const r = rail.getBoundingClientRect(); const t = thumbnail.getBoundingClientRect(); if (t.top < r.top + 10) rail.scrollBy({ top: t.top - r.top - 10, behavior: "smooth" }); else if (t.bottom > r.bottom - 10) rail.scrollBy({ top: t.bottom - r.bottom + 10, behavior: "smooth" }); }, [page, total]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (!total || (event.key !== "ArrowUp" && event.key !== "ArrowDown") || event.altKey || event.ctrlKey || event.metaKey) return; const target = event.target instanceof HTMLElement ? event.target : null; if (target?.isContentEditable || target?.closest("input, textarea, select, [contenteditable='true']")) return; event.preventDefault(); canvasHost.current?.scrollBy({ top: event.key === "ArrowDown" ? 180 : -180, behavior: "smooth" }); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [total]);
  useEffect(() => { const onFullscreenChange = () => setFullscreen(document.fullscreenElement === viewer.current); document.addEventListener("fullscreenchange", onFullscreenChange); return () => document.removeEventListener("fullscreenchange", onFullscreenChange); }, []);
  const toggleFullscreen = async () => { if (!viewer.current) return; if (document.fullscreenElement) await document.exitFullscreen(); else await viewer.current.requestFullscreen(); };
  const togglePageLayout = () => setMode((value) => value === "spread" ? "single" : "spread");
  return <section ref={viewer} className="pdf-reader" aria-label={`${title} PDF 阅读器`} aria-keyshortcuts="ArrowUp ArrowDown">
    <div className="reader-toolbar">
      <div className="reader-toolbar-group reader-page-controls" aria-label="页码控制">
        <button type="button" title="上一页" aria-label="上一页" onClick={() => goTo(page - step)} disabled={page <= 1}>‹</button>
        <form onSubmit={(event) => { event.preventDefault(); goTo(Number(pageInput)); }}><input aria-label="跳转页码" inputMode="numeric" value={pageInput} onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ""))}/><span>共 {total || "—"} 页</span></form>
        <button type="button" title="下一页" aria-label="下一页" onClick={() => goTo(page + step)} disabled={!total || page + step > total}>›</button>
      </div>
      <span className="reader-toolbar-spacer"/>
      <div className="reader-toolbar-group reader-view-controls" aria-label="缩放控制">
        <button type="button" title="缩小" aria-label="缩小" onClick={() => { setFit("custom"); setScale((value) => Math.max(.5, value - .2)); }}>−</button>
        <button type="button" className={`reader-fit-button${fit !== "custom" ? " active" : ""}`} title={fit === "page" ? "切换为适合页宽" : "切换为适合整页"} aria-label={fit === "page" ? "当前为整页，点击切换为页宽" : "点击切换为整页"} onClick={toggleFit}>{fit === "page" ? "整页" : fit === "width" ? "页宽" : `${Math.round(scale * 100)}%`}</button>
        <button type="button" title="放大" aria-label="放大" onClick={() => { setFit("custom"); setScale((value) => Math.min(3.5, value + .2)); }}>＋</button>
        <button type="button" className={`reader-layout-button${mode === "spread" ? " active" : ""}`} title={mode === "spread" ? "切换为单页" : "切换为双页"} aria-label={mode === "spread" ? "当前为双页，点击切换为单页" : "当前为单页，点击切换为双页"} onClick={togglePageLayout}>{mode === "spread" ? "双页" : "单页"}</button>
        <button type="button" title={fullscreen ? "退出全屏" : "全屏"} aria-label={fullscreen ? "退出全屏" : "全屏"} className={fullscreen ? "active" : ""} onClick={() => void toggleFullscreen()}>⛶</button>
      </div>
    </div>
    <div className="pdf-reader-layout">
      <aside ref={thumbnailRail} className="pdf-thumbnail-rail" aria-label="PDF 页面缩略图"><div className="pdf-thumbnail-heading"><b>页面</b><span>{total ? `${total} 页` : "载入中"}</span></div>{pdf ? Array.from({ length: total }, (_, index) => <Thumbnail key={index + 1} pdf={pdf} page={index + 1} active={displayedPages.includes(index + 1)} onSelect={() => goTo(index + 1)} />) : <span className="pdf-thumbnail-loading">加载中…</span>}</aside>
      <div ref={canvasHost} className="pdf-reader-canvas continuous">{message && <p className={message.includes("无法") || message.includes("请先") ? "reader-status reader-error" : "reader-status"}>{message}</p>}{pdf && Array.from({ length: Math.ceil(total / step) }, (_, row) => { const first = row * step + 1; return <div key={first} className={`pdf-page-row${mode === "spread" ? " spread" : ""}`}><ContinuousPage pdf={pdf} page={first} fit={fit} scale={scale} columns={step} onVisible={onContinuousVisible}/>{mode === "spread" && first + 1 <= total && <ContinuousPage pdf={pdf} page={first + 1} fit={fit} scale={scale} columns={2}/>}</div>; })}</div>
    </div>
  </section>;
}
