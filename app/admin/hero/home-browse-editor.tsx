"use client";

import { useEffect, useState } from "react";

type Slot = "manuscript" | "artifact" | "holdings" | "research";
type Content = { images: Record<Slot, string> };
const slots: Array<{ key: Slot; label: string; note: string }> = [
  { key: "manuscript", label: "数字化古籍", note: "古籍扫描" }, { key: "artifact", label: "数字化文物", note: "文物扫描" },
  { key: "holdings", label: "图书馆检索", note: "图书馆检索" }, { key: "research", label: "学术研究", note: "学术研究" },
];
const empty: Content = { images: { manuscript: "", artifact: "", holdings: "", research: "" } };

export function HomeBrowseEditor() {
  const [content, setContent] = useState<Content>(empty); const [message, setMessage] = useState("正在读取首页浏览图片…"); const [saving, setSaving] = useState(false);
  const load = async () => { const response = await fetch("/api/admin/home-browse", { cache: "no-store" }); const data = await response.json(); if (!response.ok) return setMessage(data.message ?? "无法读取首页浏览图片。"); setContent(data); setMessage("当前图片已读取。上传后请点击保存。"); };
  useEffect(() => { void load(); }, []);
  const upload = async (slot: Slot, file: File | undefined) => { if (!file) return; const data = new FormData(); data.set("slot", slot); data.set("file", file); setMessage(`正在上传${slots.find((item) => item.key === slot)?.label}图片…`); const response = await fetch("/api/admin/home-browse-image", { method: "POST", body: data }); const result = await response.json(); if (!response.ok) return setMessage(result.message ?? "图片上传失败。"); setContent((current) => ({ images: { ...current.images, [slot]: result.path } })); setMessage("图片已上传，记得点击保存。"); };
  const save = async () => { setSaving(true); setMessage("正在保存首页浏览图片…"); const response = await fetch("/api/admin/home-browse", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) }); const data = await response.json(); setSaving(false); if (!response.ok) return setMessage(data.message ?? "保存失败。"); setContent(data); setMessage("首页四个浏览入口图片已保存，刷新首页即可查看。"); };
  return <section className="home-browse-admin" aria-labelledby="home-browse-admin-title"><div><p>HOME BROWSE</p><h2 id="home-browse-admin-title">首页浏览入口</h2><span>分别管理“从一项线索开始浏览”的四张图片。推荐横向图片，比例约 1.9 : 1。</span></div><div className="home-browse-admin-grid">{slots.map((slot) => <article key={slot.key}><div className="home-browse-admin-preview" style={content.images[slot.key] ? { backgroundImage: `url("${content.images[slot.key]}")` } : undefined}/><div><small>{slot.note}</small><h3>{slot.label}</h3><label>替换图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(slot.key, event.target.files?.[0])}/></label><span>{content.images[slot.key] || "尚未上传"}</span></div></article>)}</div><div className="home-browse-admin-actions"><button type="button" onClick={() => void save()} disabled={saving}>{saving ? "保存中…" : "保存四张浏览图片"}</button><button type="button" className="secondary" onClick={() => void load()}>重新读取</button></div><p className="home-browse-admin-message" aria-live="polite">{message}</p></section>;
}
