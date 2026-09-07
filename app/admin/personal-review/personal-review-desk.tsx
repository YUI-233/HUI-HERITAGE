"use client";

import { useEffect, useMemo, useState } from "react";

type QueueItem = {
  id: string;
  type: "BOOK" | "ARTIFACT";
  title: string;
  creator: string | null;
  era: string | null;
  eraDetail: string | null;
  publicationDate: string | null;
  imprintPublisher: string | null;
  editionOrCategory: string | null;
  price: string | null;
  binding: string | null;
  categories: string[];
  volumeCount: number;
  serialNumber: string;
  ownerEmail: string;
  ownerName: string | null;
  description: string | null;
  media: Array<{ id: string; mimeType: string }>;
};

const typeLabel = (type: QueueItem["type"]) => type === "BOOK" ? "个人藏书" : "个人藏品";
const reviewMediaUrl = (item: QueueItem, media: QueueItem["media"][number]) => `/api/admin/personal-submissions/${item.id}/media/${media.id}`;
const formatAuthorWithEra = (creator?: string | null, era?: string | null) => {
  const name = creator?.trim() || "佚名";
  const period = era?.trim();
  return period ? `[${period}] ${name}` : name;
};

export function PersonalReviewDesk() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("正在读取待审核公开申请…");
  const [reviewing, setReviewing] = useState(false);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  const load = async () => {
    const response = await fetch("/api/admin/personal-submissions", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "无法读取待审核公开申请。");
    setItems(body);
    setSelectedId((current) => body.some((item: QueueItem) => item.id === current) ? current : body[0]?.id ?? "");
    setComment("");
    setMessage(body.length ? `当前有 ${body.length} 条待审核公开申请。` : "当前没有待审核公开申请。");
  };
  useEffect(() => { void load(); }, []);

  const review = async (decision: "APPROVED" | "NEEDS_REVISION" | "REJECTED") => {
    if (!selected) return;
    setReviewing(true); setMessage("");
    try {
      const response = await fetch("/api/admin/personal-submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, decision, comment }) });
      const body = await response.json();
      if (!response.ok) return setMessage(body.message ?? "审核未完成。");
      setMessage(decision === "APPROVED" ? "审核通过：该记录与已公开图片现已自动公开。" : "审核结论已保存，并已通知申请人。");
      await load();
    } catch { setMessage("审核请求未完成，请稍后重试。"); }
    finally { setReviewing(false); }
  };

  return <section className="personal-review-desk">
    <aside className="personal-review-list">
      <div className="personal-review-list-heading"><div><span>待审核</span><b>{items.length} 条</b></div><button type="button" onClick={() => void load()}>刷新申请</button></div>
      <p>选择一条申请，核对图片与资料后再给出结论。</p>
      <div className="personal-review-list-items">{items.map((item) => <button type="button" className={selected?.id === item.id ? "active" : ""} onClick={() => { setSelectedId(item.id); setComment(""); }} key={item.id}><span>{typeLabel(item.type)} · {item.serialNumber}</span><b>{item.title}</b><small>{item.ownerName || item.ownerEmail}</small></button>)}</div>
    </aside>
    <section className="personal-review-detail">
      {!selected ? <div className="personal-review-empty"><h2>暂无待审核公开申请</h2><p>{message}</p></div> : <>
        <header><div><span>{typeLabel(selected.type)} · {selected.serialNumber}</span><h2>{selected.title}</h2><p>申请人：{selected.ownerName || selected.ownerEmail}</p></div><small>{selected.media.length} 张核验图片</small></header>
        <div className="personal-review-content">
          <div className="personal-review-media">{selected.media.length ? selected.media.map((media) => <a href={reviewMediaUrl(selected, media)} target="_blank" rel="noreferrer" key={media.id}><img src={reviewMediaUrl(selected, media)} alt={`${selected.title} 核验图片`}/></a>) : <div>申请人尚未上传图片</div>}</div>
          <dl className="personal-review-metadata">
            <div><dt>{selected.type === "BOOK" ? "作者" : "作者／来源"}</dt><dd>{selected.type === "BOOK" ? formatAuthorWithEra(selected.creator, selected.era) : selected.creator || "未填写"}</dd></div>
            <div><dt>类别／版本</dt><dd>{selected.editionOrCategory || "未填写"}</dd></div>
            <div><dt>分类</dt><dd>{selected.categories.join("／") || "未分类"}</dd></div>
            <div><dt>册数／数量</dt><dd>{selected.volumeCount}</dd></div>
            {selected.type !== "BOOK" && <div><dt>年代</dt><dd>{selected.era || "未填写"}</dd></div>}
            <div><dt>刊刻年份</dt><dd>{selected.eraDetail || "未填写"}</dd></div>
            {selected.type === "BOOK" ? <><div><dt>刊刻时间</dt><dd>{selected.publicationDate || "未填写"}</dd></div><div><dt>刊刻主体</dt><dd>{selected.imprintPublisher || "未填写"}</dd></div><div><dt>装帧</dt><dd>{selected.binding || "未填写"}</dd></div></> : <div><dt>价格</dt><dd>{selected.price || "未填写"}</dd></div>}
          </dl>
        </div>
        <div className="personal-review-description"><b>说明／备注</b><p>{selected.description || "未填写"}</p></div>
        <label className="personal-review-comment">审核说明（会显示给申请人）<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="例如：图片清晰，可公开；或请补充版本、来源等信息。"/></label>
        <footer><button type="button" disabled={reviewing} onClick={() => void review("APPROVED")}>{reviewing ? "处理中…" : "通过公开申请"}</button><button type="button" className="secondary" disabled={reviewing} onClick={() => void review("NEEDS_REVISION")}>要求补充</button><button type="button" className="secondary" disabled={reviewing} onClick={() => void review("REJECTED")}>退回申请</button><small>{message}</small></footer>
      </>}
    </section>
  </section>;
}
