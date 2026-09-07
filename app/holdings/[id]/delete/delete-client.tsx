"use client";

import { useState } from "react";

export function HoldingDeletionForm({ holdingId }: { holdingId: string }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setMessage("正在提交删除申请…");
    try {
      const response = await fetch("/api/holding-deletions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdingId, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "提交删除申请失败。");
      setMessage("删除申请已提交。审核通过后，这条馆藏记录会从公开检索与详情页中移除。");
      setReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交删除申请失败。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="holding-deletion-form">
      <p>删除申请需由另一位具备馆藏审核权限的用户审核；审核通过后才会从公开馆藏中移除。</p>
      <label>
        申请删除理由
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="请说明删除原因，例如：重复记录、误录或资料失效。" />
      </label>
      <div className="holding-revision-actions">
        <a href={`/holdings/${holdingId}`}>返回书目详情</a>
        <button type="button" onClick={() => void submit()} disabled={submitting}>{submitting ? "提交中…" : "提交删除审核"}</button>
      </div>
      {message ? <p className="holding-revision-message">{message}</p> : null}
    </div>
  );
}
