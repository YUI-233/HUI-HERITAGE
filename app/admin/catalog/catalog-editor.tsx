"use client";

import { useEffect, useRef, useState } from "react";
import { blankManuscriptMetadata, ManuscriptCategoryPicker, ManuscriptCategorySelect, ManuscriptMetadataFields } from "../../components/manuscript-metadata-fields";
import { CategoryRequestButton } from "../../components/category-request-button";

type Type = "manuscript" | "artifact";
type EntryMode = "create" | "edit";
type Media = { id: string; storageKey: string; mimeType: string; visibility: "PUBLIC" | "MEMBER_ONLY" | "PRIVATE" };
type Form = { id?: string; catalogNumber?: string; type: Type; title: string; language: string; author: string; dynasty: string; eraDetail: string; publicationDate: string; imprintPublisher: string; versionType: string; binding: string; volumeCount: number; categories: string[]; category: string; era: string; material: string; description: string; source: string; keywords: string; status: string };
type AdminRecord = Partial<Form> & { id: string; type: Type; title: string; reviewComment?: string | null; updatedAt?: string; mediaCount?: number };

const maximumImageSize = 12 * 1024 * 1024;
const maximumPdfSize = 80 * 1024 * 1024;
const handlingStatus = { DRAFT: "草稿", NEEDS_REVISION: "待修改", REJECTED: "待修改", PENDING: "审核中" } as const;
const handlingPriority = { NEEDS_REVISION: 0, REJECTED: 0, DRAFT: 1, PENDING: 2 } as const;
const displayUpdatedAt = (value?: string) => value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "刚刚更新";
const documentVolume = (storageKey: string, fallback: number) => Number(storageKey.match(/-v(\d+)-/i)?.[1] ?? fallback);

const blank = (type: Type = "manuscript"): Form => ({ type, title: "", ...blankManuscriptMetadata(), category: "", era: "", material: "", source: "", keywords: "", status: "DRAFT" });

export function CatalogEditor({ initialRecordId }: { initialRecordId?: string } = {}) {
  const [mode, setMode] = useState<EntryMode>("create");
  const [form, setForm] = useState<Form>(blank());
  const [media, setMedia] = useState<Media[]>([]);
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [drafts, setDrafts] = useState<AdminRecord[]>([]);
  const [artifactCategories, setArtifactCategories] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [pdfVolume, setPdfVolume] = useState(1);
  const [message, setMessage] = useState("新建资料：填写基本信息并保存草稿后，再上传图片或 pdf。");
  const [importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  const loadMedia = async (id: string) => {
    const response = await fetch(`/api/admin/catalog-media?recordId=${id}`);
    if (response.ok) setMedia(await response.json());
  };
  useEffect(() => { if (form.id) void loadMedia(form.id); else setMedia([]); }, [form.id]);
  useEffect(() => { void fetch("/api/admin/catalog?withMedia=1").then(async (response) => {
    if (response.ok) {
      const loaded: AdminRecord[] = await response.json();
      setRecords(loaded);
      const record = loaded.find(item => item.id === initialRecordId);
      if (record) {
    setForm({ ...blank(record.type), ...record, id: record.id, catalogNumber: record.catalogNumber, title: record.title, type: record.type, language: record.language || "汉文", author: record.author || "", dynasty: record.dynasty || "", eraDetail: record.eraDetail || "", publicationDate: record.publicationDate || "", imprintPublisher: record.imprintPublisher || "", versionType: record.versionType || "", binding: record.binding || "", volumeCount: record.volumeCount || 1, categories: record.categories || [], category: record.category || "", era: record.era || "", material: record.material || "", description: record.description || "", source: record.source || "", keywords: Array.isArray(record.keywords) ? record.keywords.join("；") : "", status: record.status || "DRAFT" });
        setMode("edit");
        setMessage("已打开所选古籍，可查看资料并编辑。");
      }
    }
    else setMessage("无法读取可编辑资料，请确认当前账号拥有“录入古籍／文物”权限。");
  }); }, [initialRecordId]);
  const loadDrafts = async () => {
    const response = await fetch("/api/admin/catalog?drafts=1", { cache: "no-store" });
    const data = await response.json().catch(() => []);
    if (response.ok && Array.isArray(data)) setDrafts(data.sort((left, right) => (handlingPriority[left.status as keyof typeof handlingPriority] ?? 3) - (handlingPriority[right.status as keyof typeof handlingPriority] ?? 3) || new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime()));
  };
  useEffect(() => { void loadDrafts(); }, []);
  const loadArtifactCategories = async () => {
    const response = await fetch("/api/categories?scope=ARTIFACT", { cache: "no-store" });
    const body = await response.json().catch(() => []);
    if (response.ok && Array.isArray(body)) setArtifactCategories(body.map((item: { name: string }) => item.name));
  };
  useEffect(() => { void loadArtifactCategories(); }, []);


  const save = async (status: "DRAFT" | "PENDING" = "DRAFT") => {
    if (!form.title.trim()) return setMessage("请填写题名。");
    const response = await fetch("/api/admin/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, status, keywords: form.keywords.split(/[、，\n]/).map((item) => item.trim()).filter(Boolean) }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "保存失败。");
    if (status === "PENDING") { setForm(blank()); setMode("create"); }
    else setForm((current) => ({ ...current, id: data.id, catalogNumber: data.catalogNumber, status }));
    await loadDrafts();
    setMessage(status === "PENDING" ? "资料已提交审核。" : "草稿已保存。现在可分别上传图片和 pdf。");
  };

  const chooseRecord = (id: string) => {
    if (!id) return setForm(blank());
    const record = [...records, ...drafts].find((item) => item.id === id);
    if (!record) return;
    setForm({ ...blank(record.type), ...record, id: record.id, catalogNumber: record.catalogNumber, title: record.title, type: record.type, language: record.language || "汉文", author: record.author || "", dynasty: record.dynasty || "", eraDetail: record.eraDetail || "", publicationDate: record.publicationDate || "", imprintPublisher: record.imprintPublisher || "", versionType: record.versionType || "", binding: record.binding || "", volumeCount: record.volumeCount || 1, categories: record.categories || [], category: record.category || "", era: record.era || "", material: record.material || "", description: record.description || "", source: record.source || "", keywords: Array.isArray(record.keywords) ? record.keywords.join("；") : "", status: record.status || "DRAFT" });
    setPdfVolume(1);
    setMessage(`正在编辑《${record.title}》。可在右侧补充图片或 pdf。`);
  };

  const changeMode = (nextMode: EntryMode) => {
    setMode(nextMode);
    if (nextMode === "create") { setForm(blank()); setMessage("新建资料：填写基本信息并保存草稿后，再上传图片或 pdf。"); }
    else setMessage(records.length ? "请选择需要编辑的资料。列表仅显示已上传过附件的资料。" : "暂时没有已上传附件的资料可编辑。");
  };

  const upload = async (files: FileList | null, input: HTMLInputElement) => {
    if (!files?.length || !form.id) return setMessage("请先保存资料，或选择一条已有资料。");
    const selectedFiles = Array.from(files);
    input.value = "";
    for (const file of selectedFiles) {
      const maximumSize = file.type === "application/pdf" ? maximumPdfSize : maximumImageSize;
      const kind = file.type === "application/pdf" ? "PDF" : "图片";
      if (file.size > maximumSize) {
        const error = `所选${kind}“${file.name}”大小为 ${Math.ceil(file.size / 1024 / 1024)} MB，${kind}不超过 ${maximumSize / 1024 / 1024} MB。`;
        setUploadError(error);
        return setMessage(error);
      }
    }
    setUploadError("");
    for (const file of selectedFiles) {
      const data = new FormData(); data.set("recordId", form.id); data.set("type", form.type); data.set("file", file);
      if (file.type === "application/pdf" && form.type === "manuscript") data.set("volumeNumber", String(selectedPdfVolume));
      const response = await fetch("/api/admin/catalog-image", { method: "POST", body: data });
      if (!response.ok) { const result = await response.json(); return setMessage(result.message ?? "文件上传失败。"); }
    }
    await loadMedia(form.id);
    if (selectedFiles.some((file) => file.type === "application/pdf") && form.type === "manuscript") setPdfVolume((current) => Math.min(form.volumeCount, current + 1));
    setMessage(`已上传 ${selectedFiles.length} 个文件。`);
  };

  const remove = async (id: string) => {
    if (!form.id || !confirm("确定删除这个文件吗？")) return;
    const response = await fetch("/api/admin/catalog-media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, recordId: form.id }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "删除失败。");
    await loadMedia(form.id); setMessage("文件已删除。");
  };

  const requestDeletion = async () => {
    if (!form.id || mode !== "edit") return;
    const reason = window.prompt(`请填写删除《${form.title}》的理由：`);
    if (reason === null) return;
    if (!reason.trim()) return setMessage("删除申请需要填写理由，供审核人员核对。");
    if (!window.confirm(`确认提交《${form.title}》的删除申请吗？审核通过后才会从数字化遗产中移除。`)) return;
    const response = await fetch("/api/admin/catalog-deletions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: form.id, type: form.type, reason }) });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "删除申请已提交，审核通过后才会正式从数字化遗产中移除。" : result.message ?? "提交删除申请失败。");
  };

  const withdraw = async (record: AdminRecord) => {
    if (!window.confirm(`确认撤回《${record.title}》的审核申请，并放回草稿吗？`)) return;
    const response = await fetch("/api/admin/catalog/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: record.id, type: record.type }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.message ?? "撤回审核失败。");
    await loadDrafts();
    setMessage(`《${record.title}》已撤回至草稿，可继续编辑。`);
  };

  const deleteDraft = async (record: AdminRecord) => {
    if (!window.confirm(`确定删除《${record.title}》吗？相关附件也会一并删除，且无法恢复。`)) return;
    const response = await fetch("/api/admin/catalog/delete-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: record.id, type: record.type }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.message ?? "删除草稿失败。");
    if (form.id === record.id) { setForm(blank()); setMode("create"); }
    await loadDrafts();
    setMessage(`《${record.title}》已删除。`);
  };

  const importCsv = async (files: FileList | null) => {
    const file = files?.[0]; if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setMessage("请选择 CSV 文件。");
    setImporting(true);
    try { const data = new FormData(); data.set("file", file); const response = await fetch("/api/admin/catalog/import", { method: "POST", body: data }); const body = await response.json().catch(() => ({})); if (!response.ok) return setMessage(body.message ?? "古籍 CSV 导入失败。"); if (importInput.current) importInput.current.value = ""; setMessage(`已导入 ${body.created} 条古籍草稿。`); }
    catch { setMessage("导入请求未完成，请确认本地服务仍在运行后重试。"); }
    finally { setImporting(false); }
  };

  const manuscriptFields = { language: form.language, author: form.author, volumeCount: form.volumeCount, dynasty: form.dynasty, eraDetail: form.eraDetail, publicationDate: form.publicationDate, imprintPublisher: form.imprintPublisher, versionType: form.versionType, binding: form.binding, categories: form.categories, description: form.description };
  const coverImages = media.filter((item) => item.mimeType.startsWith("image/"));
  const documents = media.filter((item) => item.mimeType === "application/pdf");
  const selectedPdfVolume = Math.min(Math.max(1, pdfVolume), Math.max(1, form.volumeCount));

  return <div className="catalog-editor">
    <div className="catalog-entry-mode">
      <label>选择类型<select value={mode} onChange={(event) => changeMode(event.target.value as EntryMode)}><option value="create">新建资料</option><option value="edit">编辑已有资料</option></select></label>
      <label>选择需要编辑的资料<select value={mode === "edit" ? form.id ?? "" : ""} disabled={mode !== "edit"} onChange={(event) => chooseRecord(event.target.value)}><option value="">{mode === "edit" ? "请选择资料" : "请先选择“编辑已有资料”"}</option>{records.map((record) => <option value={record.id} key={record.id}>{record.catalogNumber ?? "编号生成中"} · {record.type === "manuscript" ? "古籍" : "文物"} · {record.title}</option>)}</select><small>仅显示已审核并上传过附件的资料。</small></label>
    </div>
    <div className="catalog-admin-layout">
      <form className="catalog-entry-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="catalog-entry-heading"><span>01</span><div><b>基本信息</b><small>{mode === "create" ? "保存草稿后将自动生成馆藏系统编号，并可在右侧分别上传图片和 pdf。" : "修改资料后请保存草稿；右侧可补充或管理附件。"}</small>{form.catalogNumber && <em className="catalog-system-number">馆藏系统编号：{form.catalogNumber}</em>}</div></div>
        <div className="type-tabs"><button type="button" className={form.type === "manuscript" ? "active" : ""} onClick={() => setForm(blank("manuscript"))}>古籍</button><button type="button" className={form.type === "artifact" ? "active" : ""} onClick={() => setForm(blank("artifact"))}>文物</button></div>
        <div className="catalog-title-row"><label>题名 *<input value={form.title} onChange={(event) => set("title", event.target.value)} required /></label>{form.type === "manuscript" ? <ManuscriptCategoryPicker value={manuscriptFields} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} compact /> : <ManuscriptCategorySelect scope="ARTIFACT" label="类别" compact groups={artifactCategories.length ? [{ label: "文物类别", options: artifactCategories }] : []} categories={form.category ? [form.category] : []} onChange={(categories) => set("category", categories.at(-1) ?? "")} />}</div>
        <CategoryRequestButton scope={form.type === "manuscript" ? "MANUSCRIPT" : "ARTIFACT"} sourceArea={form.type === "manuscript" ? "古籍文物录入 · 古籍" : "古籍文物录入 · 文物"} />
        {form.type === "manuscript" ? <ManuscriptMetadataFields value={manuscriptFields} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} showCategories={false} showDescription={false} showBinding={false} /> : <div className="two-fields"><label>年代<input value={form.era} onChange={(event) => set("era", event.target.value)} /></label><label>材质<input value={form.material} onChange={(event) => set("material", event.target.value)} /></label></div>}
        {form.type === "manuscript" && <div className="two-fields"><label>装帧<input value={form.binding} onChange={(event) => set("binding", event.target.value)} placeholder="如：线装／平装／精装" /></label><label>资料来源<input value={form.source} onChange={(event) => set("source", event.target.value)} /></label></div>}
        {form.type === "manuscript" ? <label>主题词<input value={form.keywords} onChange={(event) => set("keywords", event.target.value)} placeholder="用顿号、逗号或换行分隔" /></label> : <div className="two-fields"><label>资料来源<input value={form.source} onChange={(event) => set("source", event.target.value)} /></label><label>主题词<input value={form.keywords} onChange={(event) => set("keywords", event.target.value)} placeholder="用顿号、逗号或换行分隔" /></label></div>}
        <label className="catalog-notes-field">详情介绍<textarea value={form.description} onChange={(event) => set("description", event.target.value)} /></label><div className="catalog-form-actions"><button>保存草稿</button></div>
      </form>
      <aside className="catalog-upload-panel">
        <div className="catalog-entry-heading"><span>02</span><div><b>附件上传</b><small>图片和 pdf 分开上传、分别管理。</small></div></div>
        {form.id ? <><div className="media-upload-stack"><label className="media-upload">{form.type === "manuscript" ? "上传封面图" : "上传图片"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files, event.currentTarget)} /></label>{form.type === "manuscript" ? <label className="media-upload">上传分册 PDF<span className="media-volume-field">册次<select value={pdfVolume} onChange={(event) => setPdfVolume(Number(event.target.value))}>{Array.from({ length: form.volumeCount }, (_, index) => index + 1).map((volume) => <option value={volume} key={volume}>第 {volume} 册</option>)}</select></span><input type="file" accept="application/pdf" onChange={(event) => void upload(event.target.files, event.currentTarget)} /></label> : <label className="media-upload">上传 pdf<input type="file" accept="application/pdf" onChange={(event) => void upload(event.target.files, event.currentTarget)} /></label>}</div>{uploadError && <p className="media-upload-error" role="alert">{uploadError}</p>}<small>{form.type === "manuscript" ? `封面和页面图片公开展示；请逐册上传 PDF，并选择对应册次。共 ${form.volumeCount} 册；每份 PDF 不超过 80 MB。` : "文物图片公开展示；pdf 供会员在线阅读。图片单个不超过 12 MB，PDF 不超过 80 MB。"}</small>
          <div className="media-list">{coverImages.map((item) => <article key={item.id}><img src={item.storageKey.startsWith("private/") ? `/api/catalog/${form.id}/media/${item.id}` : `/${item.storageKey}`} alt={`${form.title}图片`} /><span>图片 · 公开</span><button type="button" className="secondary" onClick={() => void remove(item.id)}>删除</button></article>)}{documents.map((item, index) => <article key={item.id}><div>{form.title || "未命名资料"} · 第 {documentVolume(item.storageKey, index + 1)} 册 PDF</div><span>PDF · 会员在线阅读</span><button type="button" className="secondary" onClick={() => void remove(item.id)}>删除</button></article>)}{!media.length && <p>尚未上传附件。</p>}</div>
          {form.status !== "PENDING" && <button type="button" className="catalog-submit-action" disabled={!media.length} onClick={() => void save("PENDING")}>提交审核</button>}{mode === "edit" && <button type="button" className="catalog-delete-request" onClick={() => void requestDeletion()}>申请删除{form.type === "manuscript" ? "本书" : "本件文物"}</button>}</> : <div className="media-upload-stack media-upload-stack-disabled"><label className="media-upload media-upload-disabled">{form.type === "manuscript" ? "上传封面图" : "上传图片"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled /><small>请先保存资料后上传</small></label><label className="media-upload media-upload-disabled">上传 pdf<input type="file" accept="application/pdf" disabled /><small>请先保存资料后上传</small></label></div>}
        {mode === "create" && form.type === "manuscript" && <div className="catalog-csv-panel"><h3>批量导入古籍</h3><p>适用于一次导入多条古籍的基础书目信息。</p><a href="/api/admin/catalog/template">下载古籍 CSV 模板</a><label>选择 CSV 文件<input ref={importInput} type="file" accept=".csv,text/csv" onChange={(event) => void importCsv(event.target.files)} /></label>{importing && <small>导入中…</small>}</div>}
      </aside>
    </div>
    <div className="catalog-draft-box" role="region" aria-labelledby="catalog-draft-title"><div className="catalog-draft-heading"><h2 id="catalog-draft-title">待处理</h2></div><p className="catalog-draft-note">新建资料保存草稿后可在此继续编辑或提交审核；草稿、待修改和审核中资料均在此显示，已通过资料不显示。</p>{drafts.length ? <div className="catalog-draft-list">{drafts.map((draft) => { const status = draft.status as keyof typeof handlingStatus; const isPending = status === "PENDING"; return <article key={draft.id}><div><span className={`catalog-draft-status ${status?.toLowerCase() ?? "draft"}`}>{handlingStatus[status] ?? "草稿"}</span><b>{draft.type === "manuscript" ? "古籍" : "文物"} · {draft.title}</b><small>{draft.catalogNumber ?? "编号生成中"} · 附件 {draft.mediaCount ?? 0} 个 · 更新于 {displayUpdatedAt(draft.updatedAt)}</small>{draft.reviewComment && <small className="catalog-draft-comment">审核说明：{draft.reviewComment}</small>}</div><div className="catalog-draft-actions"><button type="button" className="secondary" onClick={() => isPending ? void withdraw(draft) : chooseRecord(draft.id)}>{isPending ? "撤回为草稿" : "继续编辑"}</button>{!isPending && <button type="button" className="catalog-draft-delete" onClick={() => void deleteDraft(draft)}>删除</button>}</div></article>; })}</div> : <div className="catalog-draft-empty"><svg className="catalog-draft-empty-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h16v11H4z" /><path d="M4 11.5h4l1.4 2h5.2l1.4-2h4" /><path d="M8 4.5h8" /></svg><b>当前没有待处理资料</b></div>}</div>
    <p className="catalog-editor-message">{message}</p>
  </div>;
}
