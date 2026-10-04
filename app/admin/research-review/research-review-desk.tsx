"use client";

import { useEffect, useState } from "react";

type ResearchVersion = {
  title: string; author?: string | null; affiliation?: string | null; publication?: string | null;
  publishedYear?: string | null; volumeIssue?: string | null; pages?: string | null; identifier?: string | null;
  summary: string; contentHtml: string; category: string; keywords: string[]; relatedRecordIds: string[];
};
type RequestItem = ResearchVersion & {
  id: string; action: string; canReview: boolean; requestReason?: string | null; original?: ResearchVersion | null;
  submittedByUser?: { displayName?: string | null; email: string } | null;
};

const actionLabel = (action: string) => action === "CREATE" ? "新增申请" : action === "UPDATE" ? "修改申请" : "删除申请";
const comparisonFields: { label: string; key: keyof Omit<ResearchVersion, "contentHtml"> }[] = [
  { label: "标题", key: "title" }, { label: "作者", key: "author" }, { label: "单位", key: "affiliation" },
  { label: "来源", key: "publication" }, { label: "发表年份", key: "publishedYear" },
  { label: "卷期", key: "volumeIssue" }, { label: "页码", key: "pages" },
  { label: "标识符", key: "identifier" }, { label: "分类", key: "category" },
  { label: "摘要", key: "summary" }, { label: "主题词", key: "keywords" },
  { label: "关联馆藏编号", key: "relatedRecordIds" },
];
const fieldText = (value: string | string[] | null | undefined) => Array.isArray(value) ? value.join("、") : value || "未填写";

function ResearchVersionComparison({ item }: { item: RequestItem }) {
  if (!item.original) return <p className="research-comparison-unavailable">原稿已不可用，暂时无法对照；请核实后再审核。</p>;
  const changed = comparisonFields.filter(({ key }) => fieldText(item.original?.[key]) !== fieldText(item[key]));
  const bodyChanged = item.original.contentHtml !== item.contentHtml;
  return <section className="research-comparison" aria-label="修改前后对照">
    <h3>修改前后对照</h3>
    <p className="research-comparison-note">左侧为当前已公开版本，右侧为待审核版本。仅列出有变化的基本信息。</p>
    {changed.length ? <div className="research-comparison-fields">{changed.map(({ label, key }) => <div className="research-comparison-field" key={key}>
      <h4>{label}</h4><div className="research-comparison-pair"><p><small>修改前</small><span>{fieldText(item.original?.[key])}</span></p><p><small>修改后</small><span>{fieldText(item[key])}</span></p></div>
    </div>)}</div> : <p className="research-comparison-unchanged">基本信息未修改。</p>}
    <h4 className="research-comparison-body-heading">正文{bodyChanged ? " · 已修改" : " · 未修改"}</h4>
    {bodyChanged && <div className="research-comparison-pair research-comparison-articles">
      <section><h5>修改前 · 已公开</h5><div className="research-review-content" dangerouslySetInnerHTML={{ __html: item.original.contentHtml }} /></section>
      <section><h5>修改后 · 待审核</h5><div className="research-review-content" dangerouslySetInnerHTML={{ __html: item.contentHtml }} /></section>
    </div>}
  </section>;
}

export function ResearchReviewDesk() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [message, setMessage] = useState("正在读取待审核申请。");
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = async () => {
    const response = await fetch("/api/admin/research-review");
    const data = await response.json();
    if (response.ok) {
      setItems(data);
      setMessage(data.length ? `共有 ${data.length} 项研究资料待审核；本人提交的申请须由其他审核账号处理。` : "目前没有待审核的研究资料。");
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
        <small>提交人：{item.submittedByUser?.displayName || item.submittedByUser?.email || "未知"}{!item.canReview && " · 本人提交，等待其他审核人"}</small>
      </header>
      <div className="research-review-card-body">
        {item.action === "DELETE" ? <section className="research-delete-reason"><b>删除理由</b><p>{item.requestReason || "未填写"}</p></section> : <><section className="research-delete-reason"><b>{item.action === "UPDATE" ? "修改说明" : "提交说明"}</b><p>{item.requestReason || "未填写"}</p></section>
          {item.action === "UPDATE" ? <ResearchVersionComparison item={item} /> : <>
            <p className="research-review-summary">{item.summary}</p>
            <dl className="research-review-metadata"><div><dt>作者</dt><dd>{item.author || "未填写"}</dd></div><div><dt>单位</dt><dd>{item.affiliation || "未填写"}</dd></div><div><dt>来源</dt><dd>{item.publication || "未填写"}</dd></div><div className="research-review-keywords"><dt>主题词</dt><dd>{item.keywords.length ? item.keywords.join("、") : "未填写"}</dd></div></dl>
            <section className="research-review-reading"><p>正文预览</p><div className="research-review-content" dangerouslySetInnerHTML={{ __html: item.contentHtml }} /></section>
          </>}
        </>}
      </div>
      <footer className="research-review-footer">
        <label>审核意见<textarea placeholder="可填写通过说明、退回修改建议或驳回理由" value={comments[item.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
        {item.canReview ? <div className="research-review-actions"><button type="button" onClick={() => void review(item.id, "APPROVED")}>通过审核</button><button type="button" className="secondary" onClick={() => void review(item.id, "NEEDS_REVISION")}>退回补充</button><button type="button" className="catalog-delete-request" onClick={() => void review(item.id, "REJECTED")}>驳回</button></div> : <p>本人提交的申请不可自行审核，请等待其他审核人处理。</p>}
      </footer>
    </article>)}
  </div>;
}
