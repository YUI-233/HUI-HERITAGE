"use client";

import { useState } from "react";
import type { HoldingRecord } from "../../../../lib/holdings-repository";
import { HoldingBibliographyFields, type HoldingBibliographyValues } from "../../../components/holding-bibliography-fields";

function initialValues(holding: HoldingRecord): HoldingBibliographyValues {
  return {
    title: holding.record.title ?? "",
    author: holding.record.author ?? "",
    dynasty: holding.record.era ?? "",
    eraDetail: holding.record.eraDetail ?? "",
    publicationDate: holding.record.publicationDate ?? "",
    imprintPublisher: holding.record.imprintPublisher ?? "",
    versionType: holding.record.versionType ?? "",
    binding: holding.record.binding ?? "",
    volumeCount: String(holding.record.volumeCount ?? 1),
    categories: holding.record.category ?? "",
    institution: holding.institution,
    region: holding.region,
    origin: holding.origin === "DOMESTIC" || holding.origin === "OVERSEAS" ? holding.origin : "OVERSEAS",
    callNumber: holding.callNumber ?? "",
    catalogUrl: holding.catalogUrl ?? "",
    holdingDescription: holding.description ?? "",
  };
}

export function HoldingRevisionForm({ holding }: { holding: HoldingRecord }) {
  const [values, setValues] = useState<HoldingBibliographyValues>(() => initialValues(holding));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof HoldingBibliographyValues>(key: K, value: HoldingBibliographyValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    setSubmitting(true);
    setMessage("正在提交修订申请…");
    try {
      const response = await fetch("/api/holding-revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingId: holding.id,
          values: {
            ...values,
            volumeCount: Number(values.volumeCount) || 1,
            categories: values.categories.split(/[、，]/).map((item) => item.trim()).filter(Boolean),
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "提交失败。");
      setMessage("已提交修订申请。审核入口：后台「馆藏数据审核」→「馆藏记录修订审核」；审核通过后生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="holding-revision-form">
      <HoldingBibliographyFields values={values} onChange={update} />
      <div className="holding-revision-actions">
        <a href={`/holdings/${holding.id}`}>返回书目信息</a>
        <button type="button" onClick={() => void submit()} disabled={submitting}>{submitting ? "提交中…" : "提交审核"}</button>
      </div>
      {message ? <p className="holding-revision-message">{message}</p> : null}
    </div>
  );
}
