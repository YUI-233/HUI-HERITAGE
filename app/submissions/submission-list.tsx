"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; type: "BOOK" | "ARTIFACT"; title: string; serialNumber: string; status: string; isPublic: boolean; reviewComment: string | null; reviewedAt: string | null };
const labels: Record<string, string> = { DRAFT: "待申请", PENDING: "审核中", APPROVED: "已公开", REJECTED: "已退回", NEEDS_REVISION: "待补充", ARCHIVED: "已归档" };

export function PersonalSubmissionList() {
  const [items, setItems] = useState<Entry[]>([]); const [message, setMessage] = useState("正在读取公开申请记录…");
  useEffect(() => { void (async () => { const response = await fetch("/api/personal-collection/submissions", { cache: "no-store" }); const body = await response.json(); if (!response.ok) return setMessage(body.message ?? "无法读取公开申请记录。"); setItems(body); setMessage(body.length ? "" : "还没有个人书籍或藏品记录。"); })(); }, []);
  return <div className="admin-record-list personal-submission-list">{items.map((item) => <article key={item.id}><span>{item.type === "BOOK" ? "书籍" : "藏品"} · {labels[item.status] ?? item.status}</span><b>{item.title}</b><small>{item.serialNumber} · {item.status === "APPROVED" ? item.isPublic ? "当前公开" : "当前隐藏" : "尚未公开"}</small>{item.reviewComment && <p>审核意见：{item.reviewComment}</p>}<a className="button-link" href="/personal-collection">前往个人收藏馆处理</a></article>)}{message && <p>{message}</p>}</div>;
}
