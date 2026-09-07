"use client";

import { useEffect, useMemo, useState } from "react";

type Content = { articleId: string | null; buttonLabel: string; backgroundImagePath: string | null };
type Candidate = { id: string; title: string; author: string | null; affiliation: string | null; publication: string | null; publishedYear: string | null; category: string; summary: string; keywords: string[]; meta: string; href: string };

const empty: Content = { articleId: null, buttonLabel: "继续阅读", backgroundImagePath: null };

export function FeaturedResearchEditor() {
  const [content, setContent] = useState<Content>(empty);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("正在读取学术研究候选文章…");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch("/api/admin/featured-research", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "无法读取推荐学术研究设置。");
    setContent(data.content); setCandidates(data.candidates);
    setMessage(data.candidates.length ? "请选择一篇已审核通过的文章。" : "暂无已审核通过的学术研究文章。");
  };

  useEffect(() => { void load(); }, []);

  const selected = candidates.find((candidate) => candidate.id === content.articleId) ?? null;
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? candidates.filter((candidate) => [candidate.title, candidate.author, candidate.affiliation, candidate.category, candidate.summary, ...candidate.keywords].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)) : candidates;
  }, [candidates, query]);
  const update = <K extends keyof Content>(key: K, value: Content[K]) => setContent((current) => ({ ...current, [key]: value }));
  const select = (candidate: Candidate) => setContent((current) => ({
    ...current,
    articleId: candidate.id,
  }));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const data = new FormData(); data.set("file", file);
    setMessage("正在上传学术研究区域背景图…");
    const response = await fetch("/api/admin/featured-research-background", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) return setMessage(result.message ?? "背景图上传失败。");
    update("backgroundImagePath", result.path);
    setMessage("背景图已上传，记得保存推荐学术研究设置。");
  };

  const save = async () => {
    setSaving(true); setMessage("正在保存推荐学术研究…");
    const response = await fetch("/api/admin/featured-research", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.message ?? "保存失败。");
    setContent(data); setMessage(data.articleId ? "推荐学术研究已保存，刷新首页即可查看。" : "首页学术研究推荐已清除。");
  };

  return <section className="featured-research-admin" aria-labelledby="featured-research-admin-title">
    <div className="featured-research-admin-heading"><div><p>FEATURED RESEARCH</p><h2 id="featured-research-admin-title">推荐学术研究</h2><span>选择已审核通过的文章，并可上传该区域的独立背景图。</span></div><button type="button" className="secondary" onClick={() => void load()}>刷新候选文章</button></div>
    <label className="featured-research-admin-search">搜索文章<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题名、作者、分类或关键词" /></label>
    <div className="featured-research-admin-candidates" aria-label="可推荐学术研究文章">
      {filtered.map((candidate) => <button type="button" className={candidate.id === content.articleId ? "selected" : ""} key={candidate.id} onClick={() => select(candidate)}><small>{candidate.category}</small><b>{candidate.title}</b><span>{candidate.meta}</span></button>)}
      {!filtered.length && <p>没有匹配文章。</p>}
    </div>
    {selected && <div className="featured-research-admin-form">
      <div className="featured-research-admin-preview" style={content.backgroundImagePath ? { backgroundImage: `linear-gradient(90deg, rgba(247,241,231,.96), rgba(247,241,231,.72)), url(${content.backgroundImagePath})` } : undefined}>
        <div className="featured-research-admin-preview-copy"><small>{selected.category}</small><h3>{selected.title}</h3><p>{selected.meta}</p><span>{selected.summary}</span></div>
      </div>
      <div className="featured-research-admin-fields">
        <p className="featured-research-admin-selected">已选择首页推荐文章</p>
        <label>按钮文字<input value={content.buttonLabel} maxLength={24} onChange={(event) => update("buttonLabel", event.target.value)} /></label>
        <label>区域背景图（可选，推荐 2400 × 900）<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0])}/>{content.backgroundImagePath && <span>当前文件：{content.backgroundImagePath}</span>}</label>
        {content.backgroundImagePath && <button type="button" className="secondary featured-research-remove-background" onClick={() => update("backgroundImagePath", null)}>移除背景图</button>}
        <div className="featured-research-admin-actions"><button type="button" onClick={() => void save()} disabled={saving}>{saving ? "保存中…" : "保存推荐学术研究"}</button><button type="button" className="secondary" onClick={() => { setContent(empty); setMessage("已清除当前选择，点击保存后首页将不显示此区域。"); }}>清除推荐</button></div>
      </div>
    </div>}
    <p className="featured-research-admin-message" aria-live="polite">{message}</p>
  </section>;
}
