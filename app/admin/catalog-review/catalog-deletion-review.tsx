"use client";

import { useEffect, useState } from "react";

type DeletionRequest = {
  id: string;
  recordType: "manuscript" | "artifact";
  recordTitle: string;
  requestReason: string;
  createdAt: string;
  submittedByUser: { displayName: string | null; email: string } | null;
};

export function CatalogDeletionReview() {
  const [items, setItems] = useState<DeletionRequest[]>([]);
  const [message, setMessage] = useState("正在读取待审核删除申请…");

  const load = async () => {
    const response = await fetch("/api/admin/catalog-deletions");
    const data = await response.json().catch(() => []);
    if (!response.ok) return setMessage(data.message ?? "读取删除申请失败。");
    setItems(data); setMessage(data.length ? `当前有 ${data.length} 条待审核删除申请。` : "");
  };
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  const review = async (item: DeletionRequest, decision: "APPROVED" | "NEEDS_REVISION" | "REJECTED") => {
    if (decision === "APPROVED" && !window.confirm(`确认通过并正式删除《${item.recordTitle}》吗？该资料将从数字化遗产中移除。`)) return;
    const comment = window.prompt(decision === "APPROVED" ? "审核说明（可留空）：" : "请填写审核说明：") ?? "";
    if (decision !== "APPROVED" && !comment.trim()) return setMessage("要求补充或退回时，请填写审核说明。");
    const response = await fetch(`/api/admin/catalog-deletions/${item.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, comment }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.message ?? "审核删除申请失败。");
    setMessage(decision === "APPROVED" ? "删除申请已通过，资料已从数字化遗产中移除。" : "删除申请审核结论已保存。");
    await load();
  };

  return <div className="catalog-editor catalog-deletion-review">
    <div className="catalog-review-toolbar"><div><b>待审核删除申请</b><small>审核通过后，资料会从数字化遗产中移除；关联的图书馆馆藏记录不会被删除。</small></div><button type="button" className="secondary" onClick={() => void load()}>刷新删除申请</button></div>
    <div className="catalog-review-list">{items.length ? items.map((item, index) => <article className="catalog-review-card catalog-deletion-card" key={item.id}>
      <header><span>{String(index + 1).padStart(2, "0")}</span><div><p>{item.recordType === "manuscript" ? "古籍 · 删除申请" : "文物 · 删除申请"}</p><h2>{item.recordTitle}</h2><small>申请人：{item.submittedByUser?.displayName || item.submittedByUser?.email || "未署名账号"}</small></div></header>
      <div className="catalog-deletion-reason"><b>删除理由</b><p>{item.requestReason}</p></div>
      <footer><span>审核通过后将正式从数字化遗产中移除。</span><div className="catalog-review-actions"><button type="button" onClick={() => void review(item, "APPROVED")}>通过并删除</button><button type="button" className="secondary" onClick={() => void review(item, "NEEDS_REVISION")}>要求补充</button><button type="button" className="secondary" onClick={() => void review(item, "REJECTED")}>退回</button></div></footer>
    </article>) : <p className="review-empty">暂无待审核删除申请。</p>}</div>
    {message && <p className="catalog-editor-message">{message}</p>}
  </div>;
}
