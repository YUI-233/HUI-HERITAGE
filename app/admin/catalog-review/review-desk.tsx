"use client";

import { useEffect, useState } from "react";
import { ReviewChanges } from "./review-changes";
import type { CatalogReviewSnapshot } from "../../../lib/catalog-review-baseline";

type RecordItem = { id: string; type: "manuscript" | "artifact"; title: string; status: string; source: string | null };
type Attachment = { id: string; mimeType: string; storageKey: string; visibility: string };
type ReviewDetail = RecordItem & { language?: string | null; author?: string | null; dynasty?: string | null; eraDetail?: string | null; publicationDate?: string | null; imprintPublisher?: string | null; versionType?: string | null; binding?: string | null; volumeCount?: number | null; categories?: string[]; description?: string | null; category?: string | null; era?: string | null; material?: string | null; keywords?: string[]; media: Attachment[]; baseline?: CatalogReviewSnapshot | null; comparisonUnavailable?: boolean };

const value = (item: string | null | undefined) => item?.trim() || "未填写";

function metadata(detail: ReviewDetail) {
  return detail.type === "manuscript"
    ? [["作者", value(detail.author)], ["作者年代", value(detail.dynasty)], ["册数", detail.volumeCount ? `${detail.volumeCount} 册` : "未填写"], ["刊刻年份", value(detail.eraDetail)], ["刊刻时间", value(detail.publicationDate)], ["刊刻主体", value(detail.imprintPublisher)], ["版本", value(detail.versionType)], ["装帧", value(detail.binding)], ["分类", detail.categories?.length ? detail.categories.join("、") : "未填写"], ["资料来源", value(detail.source)]]
    : [["类别", value(detail.category)], ["年代", value(detail.era)], ["材质", value(detail.material)], ["资料来源", value(detail.source)]];
}

export function CatalogReviewDesk() {
  const [items, setItems] = useState<RecordItem[]>([]);
  const [details, setDetails] = useState<Record<string, ReviewDetail>>({});
  const [viewedAttachments, setViewedAttachments] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [message, setMessage] = useState("正在读取待审核资料…");

  const load = async () => {
    const response = await fetch("/api/admin/catalog");
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "读取失败。");
    const pending = (data as RecordItem[]).filter((item) => item.status === "PENDING");
    setItems(pending);
    setDetails({});
    setViewedAttachments({});
    setSelected(null);
    setMessage(pending.length ? `当前有 ${pending.length} 条待审核资料。` : "当前没有待审核资料。");
  };

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  const openDetail = async (item: RecordItem) => {
    setSelected(item);
    if (details[item.id]) return;
    const response = await fetch(`/api/admin/catalog-review/${item.id}?type=${item.type}`);
    const data = await response.json();
    if (!response.ok) { setSelected(null); return setMessage(data.message ?? "读取资料详情失败。"); }
    setDetails((current) => ({ ...current, [item.id]: data }));
  };

  const markAttachmentViewed = (item: RecordItem, attachmentId: string) => setViewedAttachments((current) => ({ ...current, [item.id]: Array.from(new Set([...(current[item.id] ?? []), attachmentId])) }));

  const review = async (item: RecordItem, decision: "APPROVED" | "NEEDS_REVISION" | "REJECTED") => {
    const detail = details[item.id];
    const opened = viewedAttachments[item.id] ?? [];
    if (decision === "APPROVED" && (!detail || !detail.media.length || detail.media.some((media) => !opened.includes(media.id)))) return setMessage("请先查看完整资料信息，并逐个打开全部附件后再通过并公开。");
    const comment = window.prompt("审核说明（可留空）：") ?? "";
    const response = await fetch("/api/admin/catalog-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, type: item.type, decision, comment, confirmedViewed: decision !== "APPROVED" || Boolean(detail) }) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.message ?? "审核失败。");
    setMessage(decision === "APPROVED" ? "审核通过，资料已公开。" : "审核结论已保存。");
    setSelected(null);
    await load();
  };

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  const selectedDetail = selected ? details[selected.id] : null;
  const opened = selected ? viewedAttachments[selected.id] ?? [] : [];
  const canApprove = Boolean(selectedDetail && selectedDetail.media.length && selectedDetail.media.every((media) => opened.includes(media.id)));

  return <div className="catalog-editor catalog-review-desk">
    <div className="catalog-review-toolbar"><div><b>待审核资料</b><small>点击资料名称后，在弹窗内核对信息、查看附件并完成审核。</small></div><button type="button" className="secondary" onClick={() => void load()}>刷新待审核资料</button></div>
    <div className="catalog-review-list">{items.length ? items.map((item) => <button type="button" className="catalog-review-entry" key={item.id} onClick={() => void openDetail(item)}><span className="catalog-review-entry-copy"><span>{item.type === "manuscript" ? "古籍 · 待审核" : "文物 · 待审核"}</span><b>{item.title}</b></span><span className="catalog-review-entry-action">查看并审核</span></button>) : <p className="review-empty">暂无待审核资料。</p>}</div>
    <p className="catalog-editor-message">{message}</p>
    {selected && <div className="catalog-review-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <article className="catalog-review-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-review-modal-title">
        <header><div><small>{selected.type === "manuscript" ? "古籍 · 待审核" : "文物 · 待审核"}</small><h2 id="catalog-review-modal-title">{selected.title}</h2></div><button type="button" className="review-modal-close" onClick={() => setSelected(null)}>关闭</button></header>
        {selectedDetail ? <div className="catalog-review-detail"><ReviewChanges detail={selectedDetail}/><section><h3>书目信息</h3><dl>{metadata(selectedDetail).map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>{selectedDetail.description && <div className="review-description"><b>备注</b><p>{selectedDetail.description}</p></div>}{selectedDetail.keywords?.length ? <div className="review-keywords"><b>主题词</b><span>{selectedDetail.keywords.join("、")}</span></div> : null}</section><section><h3>提交附件</h3>{selectedDetail.media.length ? <div className="review-attachments">{selectedDetail.media.map((media) => <a href={`/api/admin/catalog-review/${selected.id}/media/${media.id}`} target="_blank" rel="noreferrer" key={media.id} onClick={() => markAttachmentViewed(selected, media.id)}><b>{media.mimeType === "application/pdf" ? `${selectedDetail.title} · pdf` : `${selectedDetail.title} · 图片`}</b><span>{opened.includes(media.id) ? "已查看" : "点击查看"}</span></a>)}</div> : <p className="review-missing-attachment">未提交附件，不能通过并公开。</p>}</section></div> : <p className="catalog-review-loading">正在读取资料详情…</p>}
        <footer><div>{selectedDetail ? canApprove ? <span className="review-ready">资料与附件已全部查看，可以通过。</span> : <span>通过前需查看全部附件。</span> : <span>正在读取资料信息与附件。</span>}</div><div className="catalog-review-actions"><button type="button" disabled={!canApprove} onClick={() => void review(selected, "APPROVED")}>通过并公开</button><button type="button" className="secondary" onClick={() => void review(selected, "NEEDS_REVISION")}>要求补充</button><button type="button" className="secondary" onClick={() => void review(selected, "REJECTED")}>退回</button></div></footer>
      </article>
    </div>}
  </div>;
}
