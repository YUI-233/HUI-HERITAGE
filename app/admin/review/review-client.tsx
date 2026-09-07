"use client";

import { useEffect, useState } from "react";

type WorkflowEvent = { action: string; comment: string | null; createdAt: string };
type Batch = {
  id: string;
  format: string;
  status: string;
  totalRows: number;
  validRows: number;
  reviewComment: string | null;
  createdAt: string;
  submittedByUser: { displayName: string | null; email: string } | null;
  events: WorkflowEvent[];
};
type Preview = {
  total: number;
  valid: number;
  errors: Array<{ row: number; message: string }>;
  headers?: string[];
  detailRows?: Array<{ index: number; sourceRow: number; values: string[]; status: string; reviewComment: string | null }>;
  duplicateCandidates: Array<{ row: number; message: string }>;
  referenceWarnings: Array<{ row: number; message: string }>;
};
type Filter = "ALL" | "PENDING" | "NEEDS_REVISION" | "APPROVED" | "REJECTED";
type Decision = "APPROVED" | "REJECTED" | "NEEDS_REVISION";
type Feedback = { tone: "success" | "error" | "working"; text: string };

const filters: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "全部" },
  { key: "PENDING", label: "待审核" },
  { key: "NEEDS_REVISION", label: "需补充" },
  { key: "APPROVED", label: "已通过" },
  { key: "REJECTED", label: "已退回" },
];

const formatLabel = (format: string) => format === "domestic"
  ? "国内馆藏"
  : format === "overseas_latest" || format === "overseas"
    ? "海外馆藏"
    : "机构馆藏";

const submitterLabel = (item: Batch) => item.submittedByUser?.displayName || item.submittedByUser?.email || "未署名账号";
const compactTime = (value: string) => new Date(value).toLocaleString("zh-CN", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).replace(/\//g, "/");
const isExternalLink = (value: string) => /^https?:\/\//i.test(value);
const fieldValue = (headers: string[], values: string[], names: string[]) => {
  const index = headers.findIndex((header) => names.includes(header));
  return index >= 0 ? values[index]?.trim() || "" : "";
};
const statusLabel = (status: string) => status === "PENDING"
  ? "待审核"
  : status === "APPROVED"
    ? "已通过"
    : status === "NEEDS_REVISION"
      ? "需补充"
      : "已退回";
const isWideField = (header: string) => ["备注", "備註", "说明", "藏品说明"].includes(header);
const isNoWrapField = (header: string) => ["检索号", "索书号", "编号"].includes(header);

async function responseJson(response: Response) {
  return response.json().catch(() => ({}));
}

function ImportPreviewBrowser({ preview, selectedIndex, comment, reviewing, feedback, onSelect, onComment, onReview }: {
  preview: Preview;
  selectedIndex?: number;
  comment: string;
  reviewing: boolean;
  feedback?: Feedback;
  onSelect: (index: number) => void;
  onComment: (comment: string) => void;
  onReview: (rowIndex: number, decision: Decision) => Promise<void>;
}) {
  const headers = preview.headers ?? [];
  const rows = preview.detailRows ?? [];
  if (!headers.length || !rows.length) return <p className="review-empty">此批次没有可供审核的资料行。</p>;

  const current = rows.find((row) => row.index === selectedIndex) ?? rows[0];
  const title = fieldValue(headers, current.values, ["书名", "资料名称", "名称"]) || "未填写书名";
  const institution = fieldValue(headers, current.values, ["图书馆", "收藏机构", "馆藏信息"]) || "未填写馆藏机构";
  const country = fieldValue(headers, current.values, ["国家", "馆藏国家", "地区"]);

  return <div className="review-record-browser">
    <aside className="review-record-list" aria-label="批次记录列表">
      <div className="review-list-heading"><b>资料清单</b><span>{rows.length} 条</span></div>
      {rows.map((row) => {
        const rowTitle = fieldValue(headers, row.values, ["书名", "资料名称", "名称"]) || "未填写书名";
        const rowInstitution = fieldValue(headers, row.values, ["图书馆", "收藏机构", "馆藏信息"]) || "未填写馆藏机构";
        const rowCountry = fieldValue(headers, row.values, ["国家", "馆藏国家", "地区"]);
        return <button type="button" key={row.index} className={row.index === current.index ? "active" : ""} onClick={() => onSelect(row.index)}>
          <small>第 {row.index} 条{rowCountry ? ` · ${rowCountry}` : ""} · {statusLabel(row.status)}</small>
          <b>{rowTitle}</b>
          <span>{rowInstitution}</span>
        </button>;
      })}
    </aside>
    <section className="review-record-detail" aria-live="polite">
      <header className="review-record-title">
        <h4 title={title}>{title}</h4>
        <p title={`${country ? `${country} · ` : ""}${institution}`}>{country ? `${country} · ` : ""}{institution}</p>
      </header>
      <dl className="review-record-fields">
        {headers.map((header, index) => {
          const value = current.values[index]?.trim() || "未填写";
          const className = [isWideField(header) ? "field-wide" : "", isNoWrapField(header) ? "field-nowrap" : ""].filter(Boolean).join(" ") || undefined;
          return <div className={className} key={`${current.index}-${header}-${index}`}>
            <dt>{header}</dt>
            <dd title={isNoWrapField(header) ? value : undefined}>{isExternalLink(value) ? <a href={value} target="_blank" rel="noreferrer">打开链接 ↗</a> : value}</dd>
          </div>;
        })}
      </dl>
      {current.status === "PENDING" ? <div className="review-decision-panel">
        <label>审核说明<span>仅在要求补充或退回时填写</span><textarea value={comment} onChange={(event) => onComment(event.target.value)} placeholder="例如：请补充馆方链接，或核对刊刻信息。"/></label>
        <div className="review-decision-actions">
          <button type="button" disabled={reviewing} onClick={() => onReview(current.index, "APPROVED")}>{reviewing ? "处理中…" : "通过并写入"}</button>
          <button type="button" className="secondary" disabled={reviewing} onClick={() => onReview(current.index, "NEEDS_REVISION")}>要求补充</button>
          <button type="button" className="secondary" disabled={reviewing} onClick={() => onReview(current.index, "REJECTED")}>退回</button>
        </div>
        {feedback && <p className={`review-inline-message ${feedback.tone}`}>{feedback.text}</p>}
      </div> : <p className="review-record-conclusion">本条已{current.status === "APPROVED" ? "通过并写入正式馆藏记录" : current.status === "NEEDS_REVISION" ? "标记为需要补充" : "退回"}{current.reviewComment ? `：${current.reviewComment}` : "。"}</p>}
    </section>
  </div>;
}

export function ImportBatchReview() {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [items, setItems] = useState<Batch[]>([]);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [selectedIndexes, setSelectedIndexes] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>({});
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [batchReviewingId, setBatchReviewingId] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [message, setMessage] = useState("正在读取待审核批次。");

  const loadPreview = async (id: string) => {
    const response = await fetch(`/api/admin/import-batches/${id}`);
    const data = await responseJson(response);
    if (!response.ok) throw new Error(data.message ?? "读取资料失败。");
    return { id, preview: { ...data.preview, duplicateCandidates: data.duplicateCandidates ?? [], referenceWarnings: data.referenceWarnings ?? [] } as Preview };
  };

  const load = async () => {
    const response = await fetch("/api/admin/import-batches");
    const data = await responseJson(response);
    if (!response.ok) return setMessage(data.message ?? "读取失败。");
    setItems(data);
    const pending = data.filter((item: Batch) => item.status === "PENDING");
    try {
      const loaded = await Promise.all(pending.map((item: Batch) => loadPreview(item.id)));
      setPreviews(Object.fromEntries(loaded.map(({ id, preview }) => [id, preview])));
      setSelectedIndexes(Object.fromEntries(loaded.flatMap(({ id, preview }) => preview.detailRows?.[0] ? [[id, preview.detailRows[0].index] as const] : [])));
      setMessage(pending.length ? `已载入 ${pending.length} 个待审核批次。` : "当前没有待审核批次。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取批次资料失败。");
    }
  };

  useEffect(() => { void load(); }, []);

  const review = async (id: string, rowIndex: number, decision: Decision) => {
    const key = `${id}:${rowIndex}`;
    setReviewingKey(key);
    setFeedbacks((current) => ({ ...current, [id]: { tone: "working", text: "正在保存审核结论…" } }));
    try {
      const response = await fetch(`/api/admin/import-batches/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex, decision, comment: comments[id] ?? "" }),
      });
      const data = await responseJson(response);
      if (!response.ok) {
        const text = data.message ?? "审核失败。";
        setFeedbacks((current) => ({ ...current, [id]: { tone: "error", text } }));
        setMessage(text);
        return;
      }
      const text = decision === "APPROVED"
        ? `第 ${rowIndex} 条已通过，已写入 ${data.applied.created} 条记录，尚有 ${data.remaining} 条待审核。`
        : `第 ${rowIndex} 条审核结论已保存，尚有 ${data.remaining} 条待审核。`;
      setFeedbacks((current) => ({ ...current, [id]: { tone: "success", text } }));
      setMessage(text);
      await load();
    } finally {
      setReviewingKey(null);
    }
  };

  const reviewBatch = async (item: Batch, decision: Decision) => {
    if (decision === "APPROVED" && !window.confirm(`确认批量通过这批 ${item.totalRows} 条资料，并写入正式馆藏记录吗？`)) return;
    const comment = decision === "APPROVED" ? "" : window.prompt(decision === "NEEDS_REVISION" ? "请填写要求补充的说明：" : "请填写退回说明：", decision === "REJECTED" ? "历史重复提交，以最新批次为准。" : "")?.trim();
    if (decision !== "APPROVED" && !comment) {
      setMessage("批量补充或退回时，请填写审核说明。");
      return;
    }
    setBatchReviewingId(item.id);
    setFeedbacks((current) => ({ ...current, [item.id]: { tone: "working", text: "正在处理整批资料…" } }));
    try {
      const response = await fetch(`/api/admin/import-batches/${item.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment ?? "" }),
      });
      const data = await responseJson(response);
      if (!response.ok) {
        const text = data.message ?? "批量审核失败。";
        setFeedbacks((current) => ({ ...current, [item.id]: { tone: "error", text } }));
        setMessage(text);
        return;
      }
      const text = decision === "APPROVED"
        ? `整批已通过：写入 ${data.applied.created} 条，跳过 ${data.applied.skipped} 条。`
        : decision === "NEEDS_REVISION"
          ? "整批已标记为需补充。"
          : "整批已退回。";
      setExpandedBatchId(null);
      setFeedbacks((current) => ({ ...current, [item.id]: { tone: "success", text } }));
      setMessage(text);
      await load();
    } finally {
      setBatchReviewingId(null);
    }
  };

  const count = (key: Filter) => key === "ALL" ? items.length : items.filter((item) => item.status === key).length;
  const visible = filter === "ALL" ? items : items.filter((item) => item.status === filter);

  return <div className="review-workspace">
    <div className="review-toolbar">
      <nav className="review-filter" aria-label="审核状态筛选">
        {filters.map((option) => <button type="button" className={filter === option.key ? "active" : "secondary"} onClick={() => setFilter(option.key)} key={option.key}>{option.label} {count(option.key)}</button>)}
      </nav>
      <button type="button" className="secondary" onClick={() => void load()}>刷新批次</button>
    </div>
    <div className="review-batch-list">
      {visible.length ? visible.map((item) => {
        const preview = previews[item.id];
        const selected = selectedIndexes[item.id];
        const isExpanded = expandedBatchId === item.id;
        const actionLabel = isExpanded ? "折叠" : item.status === "PENDING" ? "审核" : "查看";
        return <article className="review-batch-card" key={item.id}>
          <header className="review-batch-summary">
            <div>
              <h3>{submitterLabel(item)} 提交的{formatLabel(item.format)}资料</h3>
              <span>{item.totalRows} 条 · {compactTime(item.createdAt)}</span>
            </div>
            <div className="review-batch-actions">
              {item.status === "PENDING" && <>
                <button type="button" disabled={batchReviewingId === item.id} onClick={() => void reviewBatch(item, "APPROVED")}>批量通过</button>
                <button type="button" className="secondary" disabled={batchReviewingId === item.id} onClick={() => void reviewBatch(item, "NEEDS_REVISION")}>批量补充</button>
                <button type="button" className="secondary" disabled={batchReviewingId === item.id} onClick={() => void reviewBatch(item, "REJECTED")}>批量退回</button>
              </>}
              <button type="button" className={isExpanded ? "secondary" : ""} onClick={() => setExpandedBatchId(isExpanded ? null : item.id)}>{actionLabel}</button>
            </div>
          </header>
          {isExpanded && item.reviewComment && <p className="review-batch-note">上次审核说明：{item.reviewComment}</p>}
          {isExpanded && item.status === "PENDING" && (preview
            ? <>{preview.errors.length > 0 && <ul className="review-errors">{preview.errors.map((error) => <li key={error.row}>第 {error.row} 行：{error.message}</li>)}</ul>}<ImportPreviewBrowser preview={preview} selectedIndex={selected} comment={comments[item.id] ?? ""} reviewing={Boolean(selected && reviewingKey === `${item.id}:${selected}`)} feedback={feedbacks[item.id]} onSelect={(index) => setSelectedIndexes((current) => ({ ...current, [item.id]: index }))} onComment={(comment) => setComments((current) => ({ ...current, [item.id]: comment }))} onReview={(rowIndex, decision) => review(item.id, rowIndex, decision)}/></>
            : <p className="review-empty">正在载入本批次资料…</p>)}
          {isExpanded && (item.status === "NEEDS_REVISION" || item.status === "REJECTED") && <p className="review-resubmit-hint">该批次已返回原提交人处理；修订后的文件会在“馆藏信息录入”页面重新提交。</p>}
        </article>;
      }) : <p className="review-empty">当前筛选条件下没有批次。</p>}
    </div>
    <p className="catalog-editor-message">{message}</p>
  </div>;
}

type HoldingRevision = {
  id: string;
  status: string;
  action?: "CREATE" | "UPDATE" | "DELETE";
  requestReason?: string | null;
  reviewComment: string | null;
  createdAt: string;
  proposedBook: {
    title?: string | null;
    author?: string | null;
    dynasty?: string | null;
    eraDetail?: string | null;
    publicationDate?: string | null;
    imprintPublisher?: string | null;
    versionType?: string | null;
    binding?: string | null;
    volumeCount?: number | null;
    categories?: string[];
    description?: string | null;
  } | null;
  proposedHolding: {
    institution?: string | null;
    region?: string | null;
    origin?: string | null;
    callNumber?: string | null;
    catalogUrl?: string | null;
    description?: string | null;
    holdingDescription?: string | null;
  };
  submittedByUser: { displayName: string | null; email: string } | null;
  holding: {
    id: string;
    institution: string;
    region: string;
    origin: string;
    callNumber: string | null;
    catalogUrl: string | null;
    description: string | null;
    book: {
      title: string;
      author: string | null;
      dynasty: string | null;
      eraDetail: string | null;
      publicationDate: string | null;
      imprintPublisher: string | null;
      versionType: string | null;
      binding: string | null;
      volumeCount: number;
      categories: string[];
      description: string | null;
    } | null;
  };
};

const revisionFilters: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "全部" },
  { key: "PENDING", label: "待审核" },
  { key: "NEEDS_REVISION", label: "需补充" },
  { key: "APPROVED", label: "已通过" },
  { key: "REJECTED", label: "已退回" },
];

const revisionStatusLabel = (status: string) => status === "PENDING"
  ? "待审核"
  : status === "APPROVED"
    ? "已通过"
    : status === "NEEDS_REVISION"
      ? "需补充"
      : "已退回";

function safeValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "未填写";
  return String(value);
}

function collectionOriginLabel(value?: string | null) {
  if (value === "DOMESTIC") return "国内馆藏";
  if (value === "OVERSEAS") return "海外馆藏";
  return safeValue(value);
}

function holdingRemark(holding: HoldingRevision["proposedHolding"]) {
  return holding.holdingDescription ?? holding.description;
}

function revisionRows(item: HoldingRevision): Array<[string, unknown]> {
  const book = item.proposedBook ?? {};
  const holding = item.proposedHolding ?? {};
  return [
    ["书名", book.title],
    ["作者", book.author],
    ["作者年代", book.dynasty],
    ["分类", book.categories],
    ["册数", book.volumeCount],
    ["刊刻年份", book.eraDetail],
    ["刊刻时间", book.publicationDate],
    ["刊刻主体", book.imprintPublisher],
    ["版本", book.versionType],
    ["装帧", book.binding],
    ["馆藏类型", collectionOriginLabel(holding.origin)],
    ["图书馆", holding.institution],
    ["国家/地区", holding.region],
    ["检索号", holding.callNumber],
    ["馆方链接", holding.catalogUrl],
    ["备注", holdingRemark(holding)],
  ];
}

type RevisionDiffRow = {
  label: string;
  before: string;
  after: string;
};

function revisionDiffValue(value: unknown) {
  if (Array.isArray(value)) return value.length ? value.join("、") : "未填写";
  if (value === null || value === undefined || value === "") return "未填写";
  return String(value);
}

function revisionDiffRows(item: HoldingRevision): RevisionDiffRow[] {
  const beforeBook = item.holding.book;
  const afterBook = item.proposedBook;
  const beforeHolding = item.holding;
  const afterHolding = item.proposedHolding;
  const rows: Array<[string, unknown, unknown]> = [
    ["书名", beforeBook?.title, afterBook?.title],
    ["作者", beforeBook?.author, afterBook?.author],
    ["册数", beforeBook?.volumeCount, afterBook?.volumeCount],
    ["作者年代", beforeBook?.dynasty, afterBook?.dynasty],
    ["分类", beforeBook?.categories, afterBook?.categories],
    ["刊刻年份", beforeBook?.eraDetail, afterBook?.eraDetail],
    ["刊刻时间", beforeBook?.publicationDate, afterBook?.publicationDate],
    ["装帧", beforeBook?.binding, afterBook?.binding],
    ["刊刻主体", beforeBook?.imprintPublisher, afterBook?.imprintPublisher],
    ["版本", beforeBook?.versionType, afterBook?.versionType],
    ["馆藏类型", beforeHolding.origin, afterHolding.origin],
    ["图书馆", beforeHolding.institution, afterHolding.institution],
    ["国家/地区", beforeHolding.region, afterHolding.region],
    ["检索号", beforeHolding.callNumber, afterHolding.callNumber],
    ["官方链接", beforeHolding.catalogUrl, afterHolding.catalogUrl],
    ["备注", beforeHolding.description, holdingRemark(afterHolding)],
  ];

  return rows
    .map(([label, before, after]) => ({
      label,
      before: label === "馆藏类型" ? collectionOriginLabel(before as string | null | undefined) : revisionDiffValue(before),
      after: label === "馆藏类型" ? collectionOriginLabel(after as string | null | undefined) : revisionDiffValue(after),
    }))
    .filter((row) => row.before !== row.after);
}

function clippedChangeText(characters: string[], limit = 180) {
  if (!characters.length) return "（无）";
  if (characters.length <= limit) return characters.join("");
  const edge = Math.floor((limit - 1) / 2);
  return `${characters.slice(0, edge).join("")}…${characters.slice(-edge).join("")}`;
}

function textChangeExcerpt(before: string, after: string) {
  const beforeChars = Array.from(before);
  const afterChars = Array.from(after);
  let prefixLength = 0;
  while (prefixLength < beforeChars.length && prefixLength < afterChars.length && beforeChars[prefixLength] === afterChars[prefixLength]) prefixLength += 1;
  let suffixLength = 0;
  while (suffixLength < beforeChars.length - prefixLength && suffixLength < afterChars.length - prefixLength && beforeChars[beforeChars.length - 1 - suffixLength] === afterChars[afterChars.length - 1 - suffixLength]) suffixLength += 1;
  const contextLength = 36;
  const contextStart = Math.max(0, prefixLength - contextLength);
  const beforeEnd = beforeChars.length - suffixLength;
  const afterEnd = afterChars.length - suffixLength;
  const suffixEnd = Math.min(beforeChars.length, beforeEnd + contextLength);
  return {
    leadingEllipsis: contextStart > 0,
    prefix: beforeChars.slice(contextStart, prefixLength).join(""),
    beforeChanged: clippedChangeText(beforeChars.slice(prefixLength, beforeEnd)),
    afterChanged: clippedChangeText(afterChars.slice(prefixLength, afterEnd)),
    suffix: beforeChars.slice(beforeEnd, suffixEnd).join(""),
    trailingEllipsis: suffixEnd < beforeChars.length,
  };
}

function RevisionTextDiff({ change }: { change: RevisionDiffRow }) {
  const excerpt = textChangeExcerpt(change.before, change.after);
  const contextBefore = `${excerpt.leadingEllipsis ? "…" : ""}${excerpt.prefix}`;
  const contextAfter = `${excerpt.suffix}${excerpt.trailingEllipsis ? "…" : ""}`;
  return <div className="revision-text-diff">
    <div className="revision-text-diff-heading"><strong>{change.label}</strong><span>仅显示变化片段</span></div>
    <div className="revision-text-diff-line before"><b>修改前</b><p>{contextBefore}<del>{excerpt.beforeChanged}</del>{contextAfter}</p></div>
    <div className="revision-text-diff-line after"><b>修改后</b><p>{contextBefore}<ins>{excerpt.afterChanged}</ins>{contextAfter}</p></div>
    <details className="revision-text-full"><summary>查看完整修改前／修改后内容</summary><div><article><strong>修改前</strong><p>{change.before}</p></article><article><strong>修改后</strong><p>{change.after}</p></article></div></details>
  </div>;
}

export function HoldingRevisionReview() {
  const [items, setItems] = useState<HoldingRevision[]>([]);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("正在读取馆藏修订申请…");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/admin/holding-revisions");
    const data = await responseJson(response);
    if (!response.ok) {
      setMessage(data.message ?? "读取馆藏修订申请失败。");
      return;
    }
    setItems(data);
    setMessage(data.length ? `已读取 ${data.length} 条馆藏修订申请。` : "当前没有馆藏修订申请。");
  };

  useEffect(() => { void load(); }, []);

  const review = async (item: HoldingRevision, decision: Decision) => {
    const comment = comments[item.id] ?? "";
    setReviewingId(item.id);
    setMessage("正在保存修订审核结论…");
    try {
      const response = await fetch(`/api/admin/holding-revisions/${item.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      const data = await responseJson(response);
      if (!response.ok) {
        setMessage(data.message ?? "保存修订审核失败。");
        return;
      }
      setMessage(decision === "APPROVED" ? "修订已通过，正式馆藏记录已更新。" : "修订审核结论已保存。");
      await load();
    } finally {
      setReviewingId(null);
    }
  };

  const count = (key: Filter) => key === "ALL" ? items.length : items.filter((item) => item.status === key).length;
  const visible = filter === "ALL" ? items : items.filter((item) => item.status === filter);

  return <section className="revision-review-section">
    <div className="revision-review-heading">
      <div>
        <p>HOLDING REVISION</p>
        <h2>馆藏记录修订审核</h2>
      </div>
      <button type="button" onClick={() => void load()}>刷新修订</button>
    </div>
    <nav className="review-filter revision-filter" aria-label="馆藏修订状态筛选">
      {revisionFilters.map((option) => <button type="button" className={filter === option.key ? "active" : "secondary"} onClick={() => setFilter(option.key)} key={option.key}>{option.label} {count(option.key)}</button>)}
    </nav>
    <div className="revision-list">
      {visible.length ? visible.map((item) => {
        const title = item.proposedBook?.title || item.holding.book?.title || "未填写书名";
        const submitter = item.submittedByUser?.displayName || item.submittedByUser?.email || "未署名账号";
        const isExpanded = expandedId === item.id;
        const isDeletion = item.action === "DELETE";
        const isCreation = item.action === "CREATE";
        const changes = revisionDiffRows(item);
        const remarkChange = changes.find((change) => change.label === "备注");
        const shortChanges = changes.filter((change) => change.label !== "备注");
        const changeSummary = changes.length ? changes.map((change) => change.label).join("、") : "未检测到字段变化";
        const detailFields = <dl className="revision-field-grid">
          {revisionRows(item).map(([label, value]) => <div className={label === "备注" ? "revision-field-remark" : undefined} key={label}>
            <dt>{label}</dt>
            <dd>{label === "馆方链接" && typeof value === "string" && value ? <a href={value} target="_blank" rel="noreferrer">打开链接 ↗</a> : revisionDiffValue(value)}</dd>
          </div>)}
        </dl>;
        return <article className="revision-card" key={item.id}>
          <header>
            <div>
              <h3>{isDeletion ? `《${title}》馆藏删除申请` : isCreation ? `《${title}》新建馆藏信息` : `《${title}》馆藏记录修订`}</h3>
              <p className="revision-meta-line">
                <span>{revisionStatusLabel(item.status)}</span>
                <span>{submitter}</span>
                <span>{compactTime(item.createdAt)}</span>
                <span>{safeValue(item.proposedHolding.region)} · {safeValue(item.proposedHolding.institution)}</span>
                <span>检索号：{safeValue(item.proposedHolding.callNumber)}</span>
              </p>
              {!isDeletion && !isCreation ? <p className="revision-change-summary">本次修改：{changeSummary}{changes.length ? `（${changes.length} 项）` : ""}</p> : null}
            </div>
            <button type="button" className={isExpanded ? "secondary" : ""} onClick={() => setExpandedId(isExpanded ? null : item.id)}>{isExpanded ? "折叠" : "审核"}</button>
          </header>
          {isExpanded ? <div className="revision-detail">
            {isDeletion ? <section className="revision-diff-panel" aria-label="删除申请理由">
              <div className="revision-diff-heading">
                <h4>删除申请</h4>
                <span>审核通过后从公开馆藏中移除</span>
              </div>
              <p className="revision-diff-empty">删除理由：{item.requestReason || "未填写"}</p>
            </section> : null}
            <section className="revision-diff-panel" aria-label={isCreation ? "提交的馆藏信息" : "本次修改内容"}>
              <div className="revision-diff-heading">
                <h4>{isCreation ? "提交的馆藏信息" : "修改内容"}</h4>
                <span>{isCreation ? "审核通过后公开" : changes.length ? `${changes.length} 项变更` : "未检测到变更"}</span>
              </div>
              {isCreation ? detailFields : changes.length ? <>{shortChanges.length ? <div className="revision-diff-table" role="table" aria-label="修改前后对照">
                <div className="revision-diff-table-head" role="row">
                  <strong role="columnheader">字段</strong>
                  <strong role="columnheader">修改前</strong>
                  <strong role="columnheader">修改后</strong>
                </div>
                {shortChanges.map((change) => <div className="revision-diff-row" role="row" key={change.label}>
                  <strong role="rowheader">{change.label}</strong>
                  <span className="revision-diff-before" role="cell">{change.before}</span>
                  <span className="revision-diff-after" role="cell">{change.after}</span>
                </div>)}
              </div> : null}{remarkChange ? <RevisionTextDiff change={remarkChange} /> : null}</> : <p className="revision-diff-empty">本次提交未检测到字段变化，请核对是否为重复提交。</p>}
            </section>
            {!isCreation ? detailFields : null}
            {item.status === "PENDING" ? <div className="revision-decision-panel">
              <label>审核说明<span>要求补充或退回时填写</span><textarea value={comments[item.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="例如：请核对馆方链接或刊刻主体。" /></label>
              <div>
                <button type="button" disabled={reviewingId === item.id} onClick={() => void review(item, "APPROVED")}>{isDeletion ? "通过并删除" : "通过并生效"}</button>
                <button type="button" className="secondary" disabled={reviewingId === item.id} onClick={() => void review(item, "NEEDS_REVISION")}>要求补充</button>
                <button type="button" className="secondary" disabled={reviewingId === item.id} onClick={() => void review(item, "REJECTED")}>退回</button>
              </div>
            </div> : item.reviewComment ? <p className="revision-review-note">审核说明：{item.reviewComment}</p> : null}
          </div> : null}
        </article>;
      }) : <p className="review-empty">当前筛选条件下没有馆藏修订申请。</p>}
    </div>
    <p className="catalog-editor-message">{message}</p>
  </section>;
}
