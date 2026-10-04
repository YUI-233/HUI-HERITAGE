"use client";

import "./editor-sticky.css";
import { useEffect, useRef, useState } from "react";
import { RichTextEditor } from "../../components/rich-text-editor";
import { ManuscriptCategorySelect } from "../../components/manuscript-metadata-fields";
import { CategoryRequestButton } from "../../components/category-request-button";
import { manuscriptCategoryGroups } from "../../../lib/manuscript-categories";

type EntryMode = "create" | "edit";
type Article = { id: string; title: string; author?: string | null; affiliation?: string | null; publication?: string | null; summary: string; contentHtml: string; category: string; keywords: string[]; relatedRecordIds: string[] };
type Form = { requestId?: string; articleId?: string; title: string; author: string; affiliation: string; publication: string; summary: string; contentHtml: string; category: string; keywords: string; relatedRecordIds: string };

const blank = (): Form => ({ title: "", author: "", affiliation: "", publication: "", summary: "", contentHtml: "", category: "", keywords: "", relatedRecordIds: "" });
const split = (value: string) => value.split(/[；;，,\n]/).map((item) => item.trim()).filter(Boolean);

export function ResearchEditor({ initialArticleId }: { initialArticleId?: string }) {
  const [mode, setMode] = useState<EntryMode>("create");
  const [articles, setArticles] = useState<Article[]>([]);
  const [artifactCategories, setArtifactCategories] = useState<string[]>([]);
  const [form, setForm] = useState<Form>(blank());
  const [message, setMessage] = useState("新建资料：从 Word 粘贴正文，保存草稿后提交审核。");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => { setSubmitted(false); setForm((current) => ({ ...current, [key]: value })); };
  const load = async () => { const response = await fetch("/api/admin/research"); const data = await response.json(); if (response.ok) { setArticles(data); const article = initialArticleId ? data.find((item: Article) => item.id === initialArticleId) : null; if (article) { setMode("edit"); setForm({ articleId: article.id, title: article.title, author: article.author ?? "", affiliation: article.affiliation ?? "", publication: article.publication ?? "", summary: article.summary, contentHtml: article.contentHtml, category: article.category, keywords: article.keywords.join("；"), relatedRecordIds: article.relatedRecordIds.join("；") }); setMessage(`正在编辑《${article.title}》；修改保存后须重新提交审核。`); } } else setMessage(data.message ?? "无法读取可编辑资料。"); };
  useEffect(() => { void load(); }, [initialArticleId]);
  useEffect(() => {
    void fetch("/api/personal-collection/artifact-categories", { cache: "no-store" }).then(async (response) => {
      const categories = await response.json().catch(() => []);
      if (response.ok && Array.isArray(categories)) setArtifactCategories(categories);
    });
  }, []);
  const chooseMode = (next: EntryMode) => { setMode(next); setForm(blank()); setSubmitted(false); setMessage(next === "create" ? "新建资料：从 Word 粘贴正文，保存草稿后提交审核。" : "请选择一篇已审核研究资料，提交修改或删除申请。 "); };
  const chooseArticle = (id: string) => { const article = articles.find((item) => item.id === id); if (!article) return; setForm({ articleId: article.id, title: article.title, author: article.author ?? "", affiliation: article.affiliation ?? "", publication: article.publication ?? "", summary: article.summary, contentHtml: article.contentHtml, category: article.category, keywords: article.keywords.join("；"), relatedRecordIds: article.relatedRecordIds.join("；") }); setSubmitted(false); setMessage(`正在编辑《${article.title}》；修改保存后须重新提交审核。`); };
  const saveDraft = async () => {
    const response = await fetch("/api/admin/research-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, keywords: split(form.keywords), relatedRecordIds: split(form.relatedRecordIds) }) });
    const data = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !data.id) throw new Error(data.message ?? "保存草稿失败。");
    setForm((current) => ({ ...current, requestId: data.id }));
    return data.id;
  };
  const save = async () => {
    if (busy || !formRef.current?.reportValidity()) return;
    setBusy(true);
    try { await saveDraft(); setMessage("草稿已保存，可继续编辑或提交审核。"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "保存草稿失败。"); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (busy || submitted || !formRef.current?.reportValidity()) return;
    const requestReason = window.prompt(mode === "edit" ? "请填写修改说明：" : "请填写提交说明：");
    if (!requestReason?.trim()) { if (requestReason !== null) setMessage("提交审核前必须填写说明。"); return; }
    setBusy(true);
    setMessage("正在保存修改并提交审核…");
    try {
      const requestId = await saveDraft();
      const response = await fetch("/api/admin/research-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SUBMIT", requestId, requestReason: requestReason.trim() }) });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "提交审核失败，草稿已保存，可重试。");
      setForm((current) => ({ ...current, requestId: undefined }));
      setSubmitted(true);
      setMessage("已提交审核。请由其他拥有研究审核权限的账号在“研究资料审核”查看；本人提交的申请不会出现在自己的审核列表。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试。"); }
    finally { setBusy(false); }
  };
  const requestDelete = async () => { if (!form.articleId) return; const reason = window.prompt(`请填写删除《${form.title}》的理由：`); if (!reason?.trim()) return setMessage("删除申请需要填写理由。 "); const response = await fetch("/api/admin/research-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "DELETE", articleId: form.articleId, reason }) }); const data = await response.json(); setMessage(response.ok ? "删除申请已提交，审核通过后才会正式下架。" : data.message ?? "删除申请提交失败。"); };
  const researchCategoryGroups = [
    ...manuscriptCategoryGroups,
    ...(artifactCategories.length ? [{ label: "文物类别", options: artifactCategories }] : []),
  ];
  const knownCategories = researchCategoryGroups.flatMap((group) => group.options);
  if (form.category && !knownCategories.includes(form.category)) researchCategoryGroups.push({ label: "原有自定义分类", options: [form.category] });

  return <div className="catalog-editor">
    <div className="catalog-entry-mode"><label>选择类型<select value={mode} onChange={(event) => chooseMode(event.target.value as EntryMode)}><option value="create">新建资料</option><option value="edit">编辑已有资料</option></select></label><label>选择需要编辑的资料<select value={mode === "edit" ? form.articleId ?? "" : ""} disabled={mode !== "edit"} onChange={(event) => chooseArticle(event.target.value)}><option value="">{mode === "edit" ? "请选择资料" : "请先选择“编辑已有资料”"}</option>{articles.map((article) => <option value={article.id} key={article.id}>{article.category} · {article.title}</option>)}</select><small>仅显示已审核公开的研究资料。</small></label></div>
    <form ref={formRef} className="catalog-entry-form research-entry-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="catalog-entry-heading"><span>01</span><div><b>研究资料信息</b><small>新增、修改与删除均需审核，不会直接改变公开资料。</small></div></div>
      <label>题名 *<input required value={form.title} onChange={(event) => set("title", event.target.value)} /></label>
      <div className="two-fields"><label>作者<input value={form.author} onChange={(event) => set("author", event.target.value)} /></label><label>单位<input value={form.affiliation} onChange={(event) => set("affiliation", event.target.value)} /></label></div>
      <label>来源<input value={form.publication} onChange={(event) => set("publication", event.target.value)} /></label>
      <ManuscriptCategorySelect scope="RESEARCH" label="研究分类 *" compact required groups={researchCategoryGroups} categories={form.category ? [form.category] : []} onChange={(categories) => set("category", categories.at(-1) ?? "")} /><CategoryRequestButton scope="RESEARCH" sourceArea="研究资料编辑" parentCategory={form.category || undefined} /><label>摘要 *<textarea required value={form.summary} onChange={(event) => set("summary", event.target.value)} /></label><label>正文 *<RichTextEditor value={form.contentHtml} onChange={(html) => set("contentHtml", html)} /></label><label>主题词（以顿号、逗号或换行分隔）<input value={form.keywords} onChange={(event) => set("keywords", event.target.value)} /></label><label>关联馆藏编号（以顿号、逗号或换行分隔）<input value={form.relatedRecordIds} onChange={(event) => set("relatedRecordIds", event.target.value)} /></label>
      <div className="catalog-form-actions"><button disabled={busy || submitted}>保存草稿</button><button type="button" className="catalog-submit-action" disabled={busy || submitted} onClick={() => void submit()}>{busy ? "处理中…" : "提交审核"}</button>{mode === "edit" && form.articleId && <button type="button" className="catalog-delete-request" disabled={busy} onClick={() => void requestDelete()}>申请删除本研究资料</button>}</div>
    </form><p className="catalog-editor-message" role="status" aria-live="polite">{message}</p>
  </div>;
}
