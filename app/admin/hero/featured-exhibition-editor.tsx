"use client";

import { useEffect, useMemo, useState } from "react";

type SourceType = "HOLDING" | "CATALOG" | "PERSONAL";
type Content = { sourceType: SourceType | null; sourceId: string | null; title: string; meta: string; description: string; buttonLabel: string };
type Candidate = { id: string; sourceType: SourceType; sourceLabel: string; title: string; meta: string; description: string; image: string; href: string };

const empty: Content = { sourceType: null, sourceId: null, title: "", meta: "", description: "", buttonLabel: "查看详情" };

export function FeaturedExhibitionEditor() {
  const [content, setContent] = useState<Content>(empty);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("正在读取可展示资料…");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch("/api/admin/featured-exhibition", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "无法读取精选展览设置。");
    setContent(data.content); setCandidates(data.candidates); setMessage(data.candidates.length ? "请选择一项资料作为首页精选展览。" : "暂无符合条件的资料。候选资料须公开且至少有一张图片。");
  };

  useEffect(() => { void load(); }, []);

  const selected = candidates.find((candidate) => candidate.id === content.sourceId && candidate.sourceType === content.sourceType) ?? null;
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? candidates.filter((candidate) => [candidate.title, candidate.meta, candidate.sourceLabel].join(" ").toLocaleLowerCase().includes(term)) : candidates;
  }, [candidates, query]);
  const update = <K extends keyof Content>(key: K, value: Content[K]) => setContent((current) => ({ ...current, [key]: value }));
  const select = (candidate: Candidate) => {
    setContent((current) => ({
      ...current,
      sourceType: candidate.sourceType,
      sourceId: candidate.id,
      title: current.sourceId === candidate.id && current.sourceType === candidate.sourceType ? current.title : "",
      meta: current.sourceId === candidate.id && current.sourceType === candidate.sourceType ? current.meta : "",
      description: current.sourceId === candidate.id && current.sourceType === candidate.sourceType ? current.description : "",
    }));
  };
  const save = async () => {
    setSaving(true); setMessage("正在保存首页精选展览…");
    const response = await fetch("/api/admin/featured-exhibition", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.message ?? "保存失败。");
    setContent(data); setMessage(data.sourceId ? "精选展览已保存，刷新首页即可查看。" : "首页精选展览已清除。");
  };

  return <div className="featured-admin">
    <div className="featured-admin-heading"><div><p>ELIGIBLE COLLECTIONS</p><span>候选范围包括公开带图的图书馆馆藏、数字化古籍／文物，以及所有用户的公开个人收藏。</span></div><button type="button" className="featured-admin-refresh" onClick={() => void load()}>刷新候选资料</button></div>
    <label className="featured-admin-search">搜索候选资料<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题名、机构、年代或收藏类型" /></label>
    <div className="featured-admin-candidates" aria-label="可选精选展览资料">
      {filtered.map((candidate) => <button type="button" className={`featured-admin-candidate ${selected?.id === candidate.id && selected.sourceType === candidate.sourceType ? "selected" : ""}`} key={`${candidate.sourceType}-${candidate.id}`} onClick={() => select(candidate)}>
        <img src={candidate.image} alt="" />
        <span><small>{candidate.sourceLabel}</small><b>{candidate.title}</b><em>{candidate.meta}</em></span>
      </button>)}
      {!filtered.length && <p>没有匹配资料。</p>}
    </div>
    {selected && <div className="featured-admin-form">
      <div className="featured-admin-preview"><img src={selected.image} alt={selected.title}/><p>{selected.sourceLabel}</p><b>{content.title || selected.title}</b></div>
      <div className="featured-admin-fields">
        <p>已选资料：{selected.title}。以下文字留空时，将自动使用原始资料信息。</p>
        <label>首页标题<input value={content.title} maxLength={120} onChange={(event) => update("title", event.target.value)} placeholder={selected.title}/></label>
        <label>年代／来源说明<input value={content.meta} maxLength={160} onChange={(event) => update("meta", event.target.value)} placeholder={selected.meta}/></label>
        <label>首页简介<textarea value={content.description} maxLength={420} onChange={(event) => update("description", event.target.value)} placeholder={selected.description}/></label>
        <label>按钮文字<input value={content.buttonLabel} maxLength={24} onChange={(event) => update("buttonLabel", event.target.value)} /></label>
        <div className="featured-admin-actions"><button type="button" onClick={() => void save()} disabled={saving}>{saving ? "保存中…" : "保存精选展览"}</button><button type="button" className="secondary" onClick={() => { setContent(empty); setMessage("已清除当前选择，点击保存后首页将不显示精选展览。"); }}>清除选择</button></div>
      </div>
    </div>}
    <p className="featured-admin-message" aria-live="polite">{message}</p>
  </div>;
}
