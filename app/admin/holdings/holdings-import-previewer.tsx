"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Result = {
  format: "holdings" | "domestic" | "overseas_latest" | "overseas" | "personal" | "unknown";
  total: number;
  valid: number;
  errors: Array<{ row: number; message: string }>;
  rows: Array<{ row: number; recordType: string; institution: string; status: string; valid: boolean }>;
};
type RevisionBatch = { id: string; format: string; status: "NEEDS_REVISION" | "REJECTED"; totalRows: number; reviewComment: string | null; createdAt: string; updatedAt: string };
type Feedback = { tone: "idle" | "success" | "error" | "working"; text: string };

const reviewableFormats = new Set<Result["format"]>(["holdings", "domestic", "overseas_latest", "overseas"]);
const formatLabel = (format: string) => format === "domestic" ? "国内馆藏" : format === "overseas_latest" || format === "overseas" ? "海外馆藏" : "机构馆藏";

async function responseBody(response: Response) {
  return response.json().catch(() => ({} as { message?: string }));
}

export function HoldingsImportPreviewer() {
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<Result>();
  const [revisions, setRevisions] = useState<RevisionBatch[]>([]);
  const [revisionFiles, setRevisionFiles] = useState<Record<string, File | undefined>>({});
  const [feedback, setFeedback] = useState<Feedback>({ tone: "idle", text: "选择文件后先校验；校验通过即可提交审核。" });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resubmittingId, setResubmittingId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [pendingTarget, setPendingTarget] = useState<HTMLElement | null>(null);

  const loadRevisions = async () => {
    const response = await fetch("/api/admin/import-batches/mine", { cache: "no-store" });
    if (response.ok) setRevisions(await response.json());
  };

  useEffect(() => {
    void loadRevisions();
    setPendingTarget(document.getElementById("holdings-pending-batch-slot"));
  }, []);

  const preview = async () => {
    if (!file) return setFeedback({ tone: "error", text: "请先选择 Excel 或 CSV 文件。" });
    setIsPreviewing(true);
    setFeedback({ tone: "working", text: "正在校验文件…" });
    try {
      const data = new FormData(); data.set("file", file);
      const response = await fetch("/api/admin/import-preview", { method: "POST", body: data });
      const value = await responseBody(response);
      if (!response.ok) return setFeedback({ tone: "error", text: value.message ?? "校验失败。" });
      setResult(value);
      setFeedback({ tone: "success", text: `文件已上传并校验完成：${value.valid}/${value.total} 条可提交。` });
    } catch {
      setFeedback({ tone: "error", text: "校验请求未完成，请重试。" });
    } finally { setIsPreviewing(false); }
  };

  const submitForReview = async () => {
    if (!file || !result || !reviewableFormats.has(result.format) || result.valid !== result.total) return setFeedback({ tone: "error", text: "请先完成无错误校验后再提交审核。" });
    setIsSubmitting(true);
    setFeedback({ tone: "working", text: "正在提交审核，请勿重复点击…" });
    try {
      const data = new FormData(); data.set("file", file);
      const response = await fetch("/api/admin/import-batches", { method: "POST", body: data });
      const value = await responseBody(response);
      if (!response.ok) return setFeedback({ tone: "error", text: value.message ?? "提交审核失败。" });
      setFeedback({ tone: "success", text: value.reused ? `相同的 ${value.totalRows} 条资料已在待审核队列中，未重复提交。` : `已提交 ${value.totalRows} 条资料，等待其他审核人员逐条处理。` });
      setResult(undefined);
      await loadRevisions();
    } catch {
      setFeedback({ tone: "error", text: "提交请求未完成，请重试。" });
    } finally { setIsSubmitting(false); }
  };

  const resubmit = async (batch: RevisionBatch) => {
    const revisionFile = revisionFiles[batch.id];
    if (!revisionFile) return setFeedback({ tone: "error", text: "请先为该批次选择修订后的 Excel 或 CSV 文件。" });
    setResubmittingId(batch.id);
    setFeedback({ tone: "working", text: "正在重新提交修订文件，请勿重复点击…" });
    try {
      const data = new FormData(); data.set("file", revisionFile);
      const response = await fetch(`/api/admin/import-batches/${batch.id}/resubmit`, { method: "POST", body: data });
      const value = await responseBody(response);
      if (!response.ok) return setFeedback({ tone: "error", text: value.message ?? "重新提交失败。" });
      setFeedback({ tone: "success", text: `修订文件已重新提交，共 ${value.totalRows} 条，已回到待审核队列。` });
      setRevisionFiles((current) => ({ ...current, [batch.id]: undefined }));
      await loadRevisions();
    } catch {
      setFeedback({ tone: "error", text: "重新提交请求未完成，请重试。" });
    } finally { setResubmittingId(undefined); }
  };

  const deleteBatch = async (batch: RevisionBatch) => {
    if (!window.confirm(`确认删除这批 ${batch.totalRows} 条馆藏资料吗？此操作不能恢复。`)) return;
    setDeletingId(batch.id);
    try {
      const response = await fetch(`/api/admin/import-batches/${batch.id}`, { method: "DELETE" });
      const value = await responseBody(response);
      if (!response.ok) return setFeedback({ tone: "error", text: value.message ?? "删除失败。" });
      setFeedback({ tone: "success", text: "待处理批量已删除。" });
      await loadRevisions();
    } catch {
      setFeedback({ tone: "error", text: "删除请求未完成，请重试。" });
    } finally { setDeletingId(undefined); }
  };

  const batchPending = revisions.length && pendingTarget ? createPortal(
    <div className="holdings-pending-batch" aria-label="待处理的批量馆藏">
      <div className="import-revision-list holdings-batch-pending-list">
        {revisions.map((batch) => <article key={batch.id}>
          <div><b>{formatLabel(batch.format)} · {batch.totalRows} 条</b><span>{batch.status === "NEEDS_REVISION" ? "需补充" : "已退回"}</span></div>
          {batch.reviewComment && <p><b>审核说明：</b>{batch.reviewComment}</p>}
          <label>修订后的文件<input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => setRevisionFiles((current) => ({ ...current, [batch.id]: event.target.files?.[0] }))}/></label>
          <div className="holdings-batch-actions"><button type="button" disabled={resubmittingId === batch.id || deletingId === batch.id} onClick={() => void resubmit(batch)}>{resubmittingId === batch.id ? "提交中…" : "重新提交"}</button><button type="button" className="holdings-batch-delete" disabled={deletingId === batch.id || resubmittingId === batch.id} onClick={() => void deleteBatch(batch)}>{deletingId === batch.id ? "删除中…" : "删除"}</button></div>
        </article>)}
      </div>
    </div>,
    pendingTarget,
  ) : null;

  return <section className="holdings-import" id="holdings-batch-submit">
    <div className="holdings-import-main">
    <div className="catalog-entry-heading"><span>02</span><div><b>批量录入新馆藏</b><small>国内与海外图书馆资料均支持 Excel 或 CSV；校验通过后提交审核。</small></div></div>
    <div className="holdings-import-template"><b>模板下载</b><span><a href="/api/import-templates/domestic">国内馆藏模板</a><a href="/api/import-templates/overseas">海外馆藏模板</a></span></div>
    <div className="holdings-import-flow">
      <section className="holdings-import-step">
        <span>01</span><div><b>选择并校验文件</b><small>支持 Excel、CSV，单个文件不超过 5 MB。</small></div>
        <label className="holdings-file-picker"><span>{file ? `已选择：${file.name}` : "选择文件"}</span><input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => { const selected = event.target.files?.[0]; setFile(selected); setResult(undefined); setFeedback(selected ? { tone: "idle", text: `已选择《${selected.name}》，点击“校验文件”后上传并校验。` } : { tone: "idle", text: "选择文件后先校验；校验通过即可提交审核。" }); }}/></label>
        <button type="button" className="secondary" disabled={isPreviewing} onClick={() => void preview()}>{isPreviewing ? "校验中…" : "校验文件"}</button>
      </section>
      {result && <section className="holdings-import-step holdings-import-result">
        <span>02</span><div><b>校验结果</b><small>{result.total} 条资料，{result.valid} 条通过，{result.errors.length} 条需处理。</small></div>
        {result.format === "personal" && result.valid === result.total && <p>个人馆藏信息不能在此提交，请前往 <a href="/personal-collection">个人收藏馆</a> 录入。</p>}
        {reviewableFormats.has(result.format) && result.valid === result.total && <button type="button" disabled={isSubmitting} onClick={() => void submitForReview()}>{isSubmitting ? "提交中…" : "提交审核"}</button>}
      </section>}
      <p className={`holdings-import-feedback ${feedback.tone}`} aria-live="polite">{feedback.text}</p>
    </div>

    {result && <details className="import-preview-details" open>
      <summary>查看校验明细（{result.total} 条）</summary>
      {result.errors.length > 0 && <ul>{result.errors.map((error) => <li key={error.row}>第 {error.row} 行：{error.message}</li>)}</ul>}
      <div className="import-table"><div><b>行号</b><b>资料类型</b><b>图书馆</b><b>状态</b><b>结果</b></div>{result.rows.map((row) => <div key={row.row}><span>{row.row}</span><span>{row.recordType}</span><span>{row.institution}</span><span>{row.status}</span><span>{row.valid ? "通过" : "需修正"}</span></div>)}</div>
    </details>}
    </div>

    {batchPending}
  </section>;
}
