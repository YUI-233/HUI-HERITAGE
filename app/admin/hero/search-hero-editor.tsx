"use client";

import { useEffect, useState } from "react";

type PageKey = "catalog" | "holdings" | "research";
type Content = { images: Record<PageKey, string | null>; focus: Record<PageKey, string> };
const pages: Array<{ key: PageKey; name: string; note: string }> = [
  { key: "catalog", name: "数字化遗产", note: "数字化遗产检索区域" },
  { key: "holdings", name: "图书馆检索", note: "图书馆检索区域" },
  { key: "research", name: "学术研究", note: "学术研究检索区域" },
];
const empty: Content = { images: { catalog: null, holdings: null, research: null }, focus: { catalog: "center center", holdings: "center center", research: "center center" } };

export function SearchHeroEditor() {
  const [content, setContent] = useState<Content>(empty); const [message, setMessage] = useState("正在读取检索区背景图设置…"); const [saving, setSaving] = useState(false);
  const load = async () => { const response = await fetch("/api/admin/search-hero", { cache: "no-store" }); const data = await response.json(); if (!response.ok) return setMessage(data.message ?? "无法读取设置。"); setContent(data); setMessage("当前设置已读取。上传图片后请点击保存。"); };
  useEffect(() => { void load(); }, []);
  const upload = async (key: PageKey, file?: File) => { if (!file) return; const data = new FormData(); data.set("page", key); data.set("file", file); setMessage(`正在上传${pages.find((page) => page.key === key)?.name}背景图…`); const response = await fetch("/api/admin/search-hero-image", { method: "POST", body: data }); const result = await response.json(); if (!response.ok) return setMessage(result.message ?? "图片上传失败。"); setContent((current) => ({ ...current, images: { ...current.images, [key]: result.path } })); setMessage("图片已上传，记得点击保存。") };
  const save = async () => { setSaving(true); setMessage("正在保存检索区背景图…"); const response = await fetch("/api/admin/search-hero", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) }); const data = await response.json(); setSaving(false); if (!response.ok) return setMessage(data.message ?? "保存失败。"); setContent(data); setMessage("检索区背景图已保存，刷新对应前台页面即可查看。") };
  return <section className="search-hero-admin"><p>SEARCH AREA BACKGROUNDS</p><h2>检索区背景图</h2><span>分别为三个检索页面上传背景图。推荐横向图片，建议至少 1920 × 600 px；未上传时保留现在的纯色背景。</span><div className="search-hero-admin-grid">{pages.map((page) => <article key={page.key}><div className="search-hero-admin-preview" style={content.images[page.key] ? { backgroundImage: `url("${content.images[page.key]}")`, backgroundPosition: content.focus[page.key] } : undefined}/><div><small>{page.note}</small><h3>{page.name}</h3><label>替换背景图<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(page.key, event.target.files?.[0])}/></label><label>图片焦点<select value={content.focus[page.key]} onChange={(event) => setContent((current) => ({ ...current, focus: { ...current.focus, [page.key]: event.target.value } }))}><option value="left center">左侧居中</option><option value="center center">居中</option><option value="right center">右侧居中</option><option value="center top">上方居中</option><option value="center bottom">下方居中</option></select></label></div></article>)}</div><div className="search-hero-admin-actions"><button type="button" onClick={() => void save()} disabled={saving}>{saving ? "保存中…" : "保存检索区背景图"}</button><button type="button" className="secondary" onClick={() => void load()}>重新读取</button></div><p className="search-hero-admin-message" aria-live="polite">{message}</p></section>;
}
