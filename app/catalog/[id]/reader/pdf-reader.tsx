"use client";

import { useCallback, useEffect, useRef, useState, type WheelEvent } from "react";

type PdfPage = { getViewport: (options: { scale: number }) => { width: number; height: number }; render: (context: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<unknown> } };
type PdfDocument = { numPages: number; getPage: (page: number) => Promise<PdfPage>; destroy?: () => Promise<void> };
type ReaderMode = "continuous" | "single" | "spread";

function trimWhiteMargins(canvas: HTMLCanvasElement) {
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

function ContinuousPage({ pdf, page, fit, scale, onVisible }: { pdf: PdfDocument; page: number; fit: "page" | "width" | "custom"; scale: number; onVisible: (page: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null); const holder = useRef<HTMLElement>(null); const rendered = useRef(false);
  useEffect(() => { const node = holder.current; const target = canvas.current; if (!node || !target) return; let cancelled = false; const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) return; onVisible(page); if (rendered.current) return; rendered.current = true; void (async () => { const source = await pdf.getPage(page); const original = source.getViewport({ scale: 1 }); const availableWidth = Math.max(240, (node.parentElement?.clientWidth ?? 800) - 48); const viewport = source.getViewport({ scale: fit === "custom" ? scale : availableWidth / original.width }); const context = target.getContext("2d"); if (!context || cancelled) return; target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height); await source.render({ canvasContext: context, viewport }).promise; if (!cancelled) trimWhiteMargins(target); })().catch(() => undefined); }, { root: node.parentElement, rootMargin: "-35% 0px -55% 0px" }); observer.observe(node); return () => { cancelled = true; observer.disconnect(); }; }, [fit, onVisible, page, pdf, scale]);
  return <article ref={holder} className="pdf-continuous-page" data-page={page}><canvas ref={canvas}/></article>;
}

export function PdfReader({ documentUrl, title }: { documentUrl: string; title: string }) {
  const viewer = useRef<HTMLElement>(null); const canvasHost = useRef<HTMLDivElement>(null); const thumbnailRail = useRef<HTMLElement>(null); const firstCanvas = useRef<HTMLCanvasElement>(null); const secondCanvas = useRef<HTMLCanvasElement>(null); const documentRef = useRef<PdfDocument | null>(null); const wheelDistance = useRef(0); const lastWheelAt = useRef(0); const currentPageRef = useRef(1); const pagedMode = useRef<"single" | "spread">("single");
  const [pdf, setPdf] = useState<PdfDocument | null>(null); const [page, setPage] = useState(1); const [pageInput, setPageInput] = useState("1"); const [total, setTotal] = useState(0); const [scale, setScale] = useState(1.2); const [fit, setFit] = useState<"page" | "width" | "custom">("page"); const [mode, setMode] = useState<ReaderMode>("continuous"); const [fullscreen, setFullscreen] = useState(false); const [message, setMessage] = useState("正在载入 PDF…");
  const displayedPages = mode === "spread" && page < total ? [page, page + 1] : [page]; const step = mode === "spread" ? 2 : 1;
  const goTo = (target: number) => { const next = Math.min(Math.max(1, target), total || 1); currentPageRef.current = next; setPage(next); setPageInput(String(next)); if (mode === "continuous") requestAnimationFrame(() => canvasHost.current?.querySelector<HTMLElement>(`[data-page="${next}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" })); };
  const changeFit = (next: "page" | "width" | "custom") => { setFit(next); if (next === "custom") setScale(1.2); };
  const onContinuousVisible = useCallback((visible: number) => { if (currentPageRef.current === visible) return; currentPageRef.current = visible; setPage(visible); setPageInput(String(visible)); }, []);
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => { if (mode === "continuous" || !pdf || !total || !event.deltaY) return; const host = event.currentTarget; const direction = Math.sign(event.deltaY); const maximum = host.scrollHeight - host.clientHeight; if (maximum > 2 && ((direction < 0 && host.scrollTop > 2) || (direction > 0 && host.scrollTop < maximum - 2))) return; event.preventDefault(); const now = performance.now(); if (now - lastWheelAt.current > 250) wheelDistance.current = 0; wheelDistance.current += event.deltaY; lastWheelAt.current = now; if (Math.abs(wheelDistance.current) < 48) return; wheelDistance.current = 0; goTo(page + (direction > 0 ? step : -step)); };
  useEffect(() => { let cancelled = false; void (async () => { try { const pdfjsCoreUrl = "/reader-assets/pdf-5.4.624.min.mjs"; const pdfjs = await import(/* webpackIgnore: true */ pdfjsCoreUrl); pdfjs.GlobalWorkerOptions.workerSrc = "/reader-assets/pdf.worker-5.4.624.min.mjs"; const loaded = await pdfjs.getDocument({ url: documentUrl, withCredentials: true, disableRange: false, disableStream: true, disableAutoFetch: true, rangeChunkSize: 65536 }).promise as PdfDocument; if (cancelled) { await loaded.destroy?.(); return; } documentRef.current = loaded; setPdf(loaded); setTotal(loaded.numPages); setMessage(""); } catch (error) { if (!cancelled) setMessage(error instanceof Error && /401|Unauthorized/i.test(error.message) ? "请先登录后阅读此 PDF。" : "PDF 暂时无法加载，请刷新页面后重试。"); } })(); return () => { cancelled = true; void documentRef.current?.destroy?.(); documentRef.current = null; }; }, [documentUrl]);
  useEffect(() => { if (mode !== "continuous") canvasHost.current?.scrollTo({ top: 0, left: 0 }); }, [mode, page]);
  useEffect(() => { const rail = thumbnailRail.current; const thumbnail = rail?.querySelector<HTMLButtonElement>(`button[data-page="${page}"]`); if (!rail || !thumbnail) return; const r = rail.getBoundingClientRect(); const t = thumbnail.getBoundingClientRect(); if (t.top < r.top + 10) rail.scrollBy({ top: t.top - r.top - 10, behavior: "smooth" }); else if (t.bottom > r.bottom - 10) rail.scrollBy({ top: t.bottom - r.bottom + 10, behavior: "smooth" }); }, [page, total]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (!total || (event.key !== "ArrowUp" && event.key !== "ArrowDown") || event.altKey || event.ctrlKey || event.metaKey) return; const target = event.target instanceof HTMLElement ? event.target : null; if (target?.isContentEditable || target?.closest("input, textarea, select, [contenteditable='true']")) return; event.preventDefault(); if (mode === "continuous") { canvasHost.current?.scrollBy({ top: event.key === "ArrowDown" ? 180 : -180, behavior: "smooth" }); return; } goTo(page + (event.key === "ArrowDown" ? step : -step)); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [mode, page, step, total]);
  useEffect(() => { const onFullscreenChange = () => setFullscreen(document.fullscreenElement === viewer.current); document.addEventListener("fullscreenchange", onFullscreenChange); return () => document.removeEventListener("fullscreenchange", onFullscreenChange); }, []);
  useEffect(() => { if (mode === "continuous" || !pdf || !firstCanvas.current || !canvasHost.current) return; let cancelled = false; void (async () => { try { setMessage("正在渲染页面…"); const host = canvasHost.current!; const canvases = [firstCanvas.current, secondCanvas.current]; await Promise.all(displayedPages.map(async (number, index) => { const source = await pdf.getPage(number); const original = source.getViewport({ scale: 1 }); const availableWidth = Math.max(240, (host.clientWidth - 56) / displayedPages.length); const availableHeight = Math.max(320, host.clientHeight - 52); const initialScale = fit === "width" ? availableWidth / original.width : fit === "page" ? Math.min(availableWidth / original.width, availableHeight / original.height) : scale; const canvas = canvases[index]; if (!canvas || cancelled) return; const renderTrimmed = async (renderScale: number) => { const viewport = source.getViewport({ scale: renderScale }); const context = canvas.getContext("2d"); if (!context || cancelled) return; canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); await source.render({ canvasContext: context, viewport }).promise; if (!cancelled) trimWhiteMargins(canvas); }; await renderTrimmed(initialScale); if (cancelled || fit === "custom" || !canvas.width || !canvas.height) return; const contentFit = fit === "width" ? availableWidth / canvas.width : Math.min(availableWidth / canvas.width, availableHeight / canvas.height); if (contentFit > 1.025) await renderTrimmed(initialScale * contentFit); })); if (!cancelled) setMessage(""); } catch { if (!cancelled) setMessage("此页暂时无法渲染。"); } })(); return () => { cancelled = true; }; }, [fit, fullscreen, mode, page, pdf, scale, total]);
  const toggleFullscreen = async () => { if (!viewer.current) return; if (document.fullscreenElement) await document.exitFullscreen(); else await viewer.current.requestFullscreen(); };
  const toggleReadingFlow = () => setMode((value) => value === "continuous" ? pagedMode.current : "continuous");
  const togglePageLayout = () => setMode((value) => { const next = value === "spread" ? "single" : "spread"; pagedMode.current = next; return next; });
  return <section ref={viewer} className="pdf-reader" aria-label={`${title} PDF 阅读器`} aria-keyshortcuts="ArrowUp ArrowDown">
    <div className="reader-toolbar">
      <button type="button" title="上一页" aria-label="上一页" onClick={() => goTo(page - step)} disabled={page <= 1}>‹</button>
      <form onSubmit={(event) => { event.preventDefault(); goTo(Number(pageInput)); }}><input aria-label="跳转页码" inputMode="numeric" value={pageInput} onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ""))}/><span>/ {total || "—"}</span></form>
      <button type="button" title="下一页" aria-label="下一页" onClick={() => goTo(page + step)} disabled={!total || page + step > total}>›</button>
      <span className="reader-toolbar-spacer"/>
      <button type="button" title="适合整页" aria-label="适合整页" className={fit === "page" ? "active" : ""} onClick={() => changeFit("page")}>▣</button>
      <button type="button" title="适合页宽" aria-label="适合页宽" className={fit === "width" ? "active" : ""} onClick={() => changeFit("width")}>↔</button>
      <button type="button" title="缩小" aria-label="缩小" onClick={() => { setFit("custom"); setScale((value) => Math.max(.5, value - .2)); }}>−</button>
      <button type="button" title="放大" aria-label="放大" onClick={() => { setFit("custom"); setScale((value) => Math.min(3.5, value + .2)); }}>＋</button>
      <button type="button" title={mode === "continuous" ? "切换为翻页阅读" : "切换为连续阅读"} aria-label={mode === "continuous" ? "当前为连续阅读，切换为翻页阅读" : "当前为翻页阅读，切换为连续阅读"} className={mode === "continuous" ? "active" : ""} onClick={toggleReadingFlow}>↕</button>
      <button type="button" title={mode === "spread" ? "切换为单页" : "切换为双页"} aria-label={mode === "spread" ? "当前为双页，切换为单页" : "当前为单页，切换为双页"} className={mode === "spread" ? "active" : ""} disabled={mode === "continuous"} onClick={togglePageLayout}>{mode === "spread" ? <span className="reader-icon reader-icon-spread" aria-hidden="true"><i/><i/></span> : "▯"}</button>
      <button type="button" title={fullscreen ? "退出全屏" : "全屏"} aria-label={fullscreen ? "退出全屏" : "全屏"} className={fullscreen ? "active" : ""} onClick={() => void toggleFullscreen()}>⛶</button>
      <button type="button" title="打印当前页" aria-label="打印当前页" onClick={() => window.print()}><span className="reader-icon reader-icon-print" aria-hidden="true"/></button>
    </div>
    <div className="pdf-reader-layout">
      <aside ref={thumbnailRail} className="pdf-thumbnail-rail" aria-label="PDF 页面缩略图">{pdf ? Array.from({ length: total }, (_, index) => <Thumbnail key={index + 1} pdf={pdf} page={index + 1} active={displayedPages.includes(index + 1)} onSelect={() => goTo(index + 1)} />) : <span>加载中…</span>}</aside>
      <div ref={canvasHost} className={`pdf-reader-canvas${mode === "continuous" ? " continuous" : ""}`} onWheel={handleWheel}>{message && <p className={message.includes("无法") || message.includes("请先") ? "reader-status reader-error" : "reader-status"}>{message}</p>}{mode === "continuous" && pdf ? Array.from({ length: total }, (_, index) => <ContinuousPage key={index + 1} pdf={pdf} page={index + 1} fit={fit} scale={scale} onVisible={onContinuousVisible}/>) : <>{pdf && <canvas ref={firstCanvas}/>} {pdf && mode === "spread" && page < total && <canvas ref={secondCanvas}/>}</>}</div>
    </div>
  </section>;
}
