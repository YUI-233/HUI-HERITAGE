"use client";

import { useEffect, useState } from "react";

type Content = { slots: Array<string | null> };
type Candidate = { id: string; title: string; summary: string; meta: string; image: string; imageAccess: "member" | "public" | "none"; href: string };
const empty: Content = { slots: [null, null, null, null, null] };

export function RecommendedBooksEditor() {
  const [content, setContent] = useState<Content>(empty);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState("正在读取数字化古籍…");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch("/api/admin/recommended-books", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "无法读取古籍阅读推荐设置。");
    setContent(data.content); setCandidates(data.candidates);
    setMessage(data.candidates.length ? "请为五个推荐位选择数字化古籍，空位可以暂不设置。" : "暂无已审核通过的数字化古籍。");
  };

  useEffect(() => { void load(); }, []);

  const updateSlot = (index: number, id: string | null) => setContent((current) => ({
    slots: current.slots.map((value, slotIndex) => slotIndex === index ? id : value),
  }));

  const save = async () => {
    setSaving(true); setMessage("正在保存古籍阅读推荐…");
    const response = await fetch("/api/admin/recommended-books", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.message ?? "保存失败。");
    setContent(data); setMessage("古籍阅读推荐已保存，刷新首页即可查看。");
  };

  return <section className="recommended-books-admin" aria-labelledby="recommended-books-admin-title">
    <div className="recommended-books-admin-heading"><div><p>READING RECOMMENDATIONS</p><h2 id="recommended-books-admin-title">古籍阅读推荐</h2><span>五个推荐位对应首页从左到右的展示顺序，仅可选择已审核通过的数字化古籍。</span></div><button type="button" className="secondary" onClick={() => void load()}>刷新古籍列表</button></div>
    <div className="recommended-books-slots">
      {content.slots.map((id, index) => {
        const selected = candidates.find((candidate) => candidate.id === id) ?? null;
        const usedByOtherSlot = new Set(content.slots.filter((value, slotIndex) => slotIndex !== index && value));
        return <article key={index}>
          <header><span>{String(index + 1).padStart(2, "0")}</span><b>推荐位 {index + 1}</b></header>
          <label>选择数字化古籍<select value={id ?? ""} onChange={(event) => updateSlot(index, event.target.value || null)}><option value="">暂不设置</option>{candidates.map((candidate) => <option value={candidate.id} disabled={usedByOtherSlot.has(candidate.id)} key={candidate.id}>{candidate.title}</option>)}</select></label>
          {selected ? <div className="recommended-books-slot-preview">{selected.imageAccess === "public" ? <img src={selected.image} alt=""/> : <span>暂无公开封面</span>}<div><b>{selected.title}</b><small>{selected.meta}</small></div></div> : <div className="recommended-books-slot-empty">此推荐位暂为空</div>}
          {selected && <button type="button" className="secondary" onClick={() => updateSlot(index, null)}>清空此位</button>}
        </article>;
      })}
    </div>
    <div className="recommended-books-admin-actions"><button type="button" onClick={() => void save()} disabled={saving}>{saving ? "保存中…" : "保存五个推荐位"}</button><button type="button" className="secondary" onClick={() => setContent(empty)}>全部清空</button></div>
    <p className="recommended-books-admin-message" aria-live="polite">{message}</p>
  </section>;
}
