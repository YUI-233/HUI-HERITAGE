"use client";

import { useEffect, useState } from "react";

type RequestItem = {
  id: string; action: string; title: string; author?: string | null; affiliation?: string | null; publication?: string | null;
  summary: string; contentHtml: string; category: string; keywords: string[]; requestReason?: string | null;
  submittedByUser?: { displayName?: string | null; email: string } | null;
};

const actionLabel = (action: string) => action === "CREATE" ? "新增申请" : action === "UPDATE" ? "修改申请" : "删除申请";

export function ResearchReviewDesk() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [message, setMessage] = useState("正在读取待审核申请。");
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = async () => {
    const response = await fetch("/api/admin/research-review");
    const data = await response.json();
    if (response.ok) {
      setItems(data);
      setMessage(data.length ? `共有 ${data.length} 项研究资料待审核。` : "目前没有待审核的研究资料。");
    } else setMessage(data.message ?? "读取失败。");
  };

  useEffect(() => { void load(); }, []);

  const review = async (id: string, decision: "APPROVED" | "REJECTED" | "NEEDS_REVISION") => {
    const response = await fetch("/api/admin/research-review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, comment: comments[id] }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "审核失败。");
    setMessage("审核结果已提交。");
    await load();
  };

  return <div className="review-desk">
    <p className="catalog-editor-message">{message}</p>
    {items.map((item) => <article className="review-card" key={item.id}>
      <header className="research-review-card-header">
        <div><p>{actionLabel(item.action)} <span>·</span> {item.category}</p><h2>{item.title}</h2></div>
        <small>提交人：{item.submittedByUser?.displayName || item.submittedByUser?.email || "未知"}</small>
      </header>
      <div className="research-review-card-body">
        {item.action === "DELETE" ? <section className="research-delete-reason"><b>删除理由</b><p>{item.requestReason || "未填写"}</p></section> : <><section className="research-delete-reason"><b>{item.action === "UPDATE" ? "修改说明" : "提交说明"}</b><p>{item.requestReason || "未填写"}</p></section>
          <p className="research-review-summary">{item.summary}</p>
          <dl className="research-review-metadata"><div><dt>作者</dt><dd>{item.author || "未填写"}</dd></div><div><dt>单位</dt><dd>{item.affiliation || "未填写"}</dd></div><div><dt>来源</dt><dd>{item.publication || "未填写"}</dd></div><div className="research-review-keywords"><dt>主题词</dt><dd>{item.keywords.length ? item.keywords.join("、") : "未填写"}</dd></div></dl>
          <section className="research-review-reading"><p>正文预览</p><div className="research-review-content" dangerouslySetInnerHTML={{ __html: item.contentHtml }} /></section>
        </>}
      </div>
      <footer className="research-review-footer">
        <label>审核意见<textarea placeholder="可填写通过说明、退回修改建议或驳回理由" value={comments[item.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
        <div className="research-review-actions"><button type="button" onClick={() => void review(item.id, "APPROVED")}>通过审核</button><button type="button" className="secondary" onClick={() => void review(item.id, "NEEDS_REVISION")}>退回补充</button><button type="button" className="catalog-delete-request" onClick={() => void review(item.id, "REJECTED")}>驳回</button></div>
      </footer>
    </article>)}
  </div>;
}
