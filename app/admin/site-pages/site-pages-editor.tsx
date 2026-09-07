"use client";

import { useEffect, useState } from "react";

const slugs = ["about", "support", "terms", "privacy", "site-notice", "contact"] as const;
type Slug = typeof slugs[number];
type Page = { title: string; intro: string; body: string; backgroundImagePath: string; backgroundPositionX: number; backgroundPositionY: number; textTone: "dark" | "light"; overlayTone: "none" | "light" | "dark"; overlayOpacity: number };
type Content = { footerTitle: string; footerDescription: string; footerBackgroundImagePath: string; footerBackgroundPositionX: number; footerBackgroundPositionY: number; pages: Record<Slug, Page> };
const labels: Record<Slug, string> = { about: "关于我们", support: "合作和支持", terms: "使用条款", privacy: "隐私政策", "site-notice": "网站说明", contact: "联系我们" };
const defaultFooterBackground = "/site/footer-mountains.png";
const defaultPageBackground = "/site/page-header-building.png";

export function SitePagesEditor({ mode = "all" }: { mode?: "all" | "footer" | "pages" }) {
  const [content, setContent] = useState<Content | null>(null);
  const [active, setActive] = useState<Slug>("about");
  const [message, setMessage] = useState("正在读取网站内容…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-pages").then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => response.ok ? (setContent(data), setMessage("当前内容已读取。")) : setMessage(data.message ?? "无法读取网站内容。")).catch(() => setMessage("无法读取网站内容。"));
  }, []);

  if (!content) return <p className="site-pages-message">{message}</p>;
  const page = content.pages[active];
  const setPage = (key: keyof Page, value: string) => setContent({ ...content, pages: { ...content.pages, [active]: { ...page, [key]: value } } });
  const setPagePosition = (key: "backgroundPositionX" | "backgroundPositionY", value: number) => setContent({ ...content, pages: { ...content.pages, [active]: { ...page, [key]: value } } });
  const setPageDisplay = (key: "textTone" | "overlayTone" | "overlayOpacity", value: Page["textTone"] | Page["overlayTone"] | number) => setContent({ ...content, pages: { ...content.pages, [active]: { ...page, [key]: value } } });

  const persist = async (nextContent: Content, successMessage: string) => {
    setSaving(true);
    setMessage("正在保存…");
    const response = await fetch("/api/admin/site-pages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextContent) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.message ?? "保存失败。");
      return false;
    }
    setContent(data);
    setMessage(successMessage);
    return true;
  };

  const uploadFooterBackground = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    setMessage("正在上传页脚背景图…");
    const response = await fetch("/api/admin/site-footer-background", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "页脚背景图上传失败。");
    const nextContent = { ...content, footerBackgroundImagePath: data.path };
    await persist(nextContent, "页脚背景图已上传并保存，刷新网站即可查看。");
  };

  const uploadPageBackground = async (file: File | undefined) => {
    if (!file) return;
    const targetSlug = active;
    const form = new FormData();
    form.set("file", file);
    form.set("slug", targetSlug);
    setMessage(`正在上传“${labels[targetSlug]}”背景图…`);
    const response = await fetch("/api/admin/site-page-background", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "分页背景图上传失败。");
    const nextContent = { ...content, pages: { ...content.pages, [targetSlug]: { ...content.pages[targetSlug], backgroundImagePath: data.path } } };
    await persist(nextContent, `“${labels[targetSlug]}”背景图已上传并保存。`);
  };

  const save = async () => {
    await persist(content, "页脚与功能页内容已保存。");
  };

  return <div className="site-pages-editor">
    {mode !== "pages" && <section>
      <h2>页脚图文设置</h2>
      <p className="site-pages-section-note">这里可修改全站页脚左侧的主标题、说明文字和整幅背景图。</p>
      <label>主标题<input value={content.footerTitle} maxLength={120} onChange={(event) => setContent({ ...content, footerTitle: event.target.value })}/></label>
      <label>说明文字<textarea value={content.footerDescription} maxLength={500} onChange={(event) => setContent({ ...content, footerDescription: event.target.value })}/></label>
      <label className="site-pages-background-upload">页脚背景图（推荐 3000 × 600 px，横向完整构图）<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadFooterBackground(event.target.files?.[0])}/><small>支持 JPG、PNG、WebP，最大 8 MB。当前文件：{content.footerBackgroundImagePath}</small></label>
      <div className="site-pages-background-preview site-pages-footer-background-preview" role="img" aria-label="当前页脚背景图预览" style={{ backgroundImage: `url("${content.footerBackgroundImagePath}")`, backgroundPosition: `${content.footerBackgroundPositionX}% ${content.footerBackgroundPositionY}%` }}/>
      <div className="site-pages-background-position">
        <label>横向构图位置 <output>{content.footerBackgroundPositionX}%</output><input type="range" min="0" max="100" value={content.footerBackgroundPositionX} onChange={(event) => setContent({ ...content, footerBackgroundPositionX: Number(event.target.value) })}/><small>0% 显示左侧，50% 居中，100% 显示右侧。</small></label>
        <label>纵向构图位置 <output>{content.footerBackgroundPositionY}%</output><input type="range" min="0" max="100" value={content.footerBackgroundPositionY} onChange={(event) => setContent({ ...content, footerBackgroundPositionY: Number(event.target.value) })}/><small>0% 显示图片上方；建议这张松树图先保持在 0%，树冠会完整露出。</small></label>
      </div>
      <div className="site-pages-secondary-actions"><button type="button" className="site-pages-secondary" onClick={() => void persist(content, "页脚图文设置已保存。")}>保存</button>{content.footerBackgroundImagePath !== defaultFooterBackground && <button type="button" className="site-pages-secondary" onClick={() => void persist({ ...content, footerBackgroundImagePath: defaultFooterBackground }, "已恢复并保存默认山水背景。")}>恢复默认山水背景</button>}</div>
    </section>}
    {mode !== "footer" && <section>
      <h2>页脚功能页</h2>
      <label className="site-pages-select">选择需要编辑的页面<select value={active} onChange={(event) => setActive(event.target.value as Slug)}>{slugs.map((slug) => <option value={slug} key={slug}>{labels[slug]}</option>)}</select></label>
      <label className="site-pages-background-upload">当前分页背景图（推荐 3000 × 650 px）<input key={active} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadPageBackground(event.target.files?.[0])}/><small>正在编辑：{labels[active]}。支持 JPG、PNG、WebP，最大 8 MB。当前文件：{page.backgroundImagePath}</small></label>
      <div className="site-pages-background-preview site-pages-page-background-preview" role="img" aria-label={`${labels[active]}背景图预览`} style={{ backgroundImage: `url("${page.backgroundImagePath}")`, backgroundPosition: `${page.backgroundPositionX}% ${page.backgroundPositionY}%` }}>
        <div className={`site-page-preview-overlay ${page.overlayTone}`} style={{ opacity: page.overlayOpacity / 100 }}/>
        <div className={`site-page-preview-copy ${page.textTone}`}><p>HUI HERITAGE</p><h3>{page.title}</h3><span>{page.intro}</span></div>
      </div>
      <div className="site-pages-background-position">
        <label>横向构图位置 <output>{page.backgroundPositionX}%</output><input type="range" min="0" max="100" value={page.backgroundPositionX} onChange={(event) => setPagePosition("backgroundPositionX", Number(event.target.value))}/><small>0% 显示图片左侧，50% 居中，100% 显示右侧。</small></label>
        <label>纵向构图位置 <output>{page.backgroundPositionY}%</output><input type="range" min="0" max="100" value={page.backgroundPositionY} onChange={(event) => setPagePosition("backgroundPositionY", Number(event.target.value))}/><small>拖动后可在上方预览实时查看网站横幅的实际裁切。</small></label>
      </div>
      <div className="site-pages-display-settings">
        <label>标题文字颜色<select value={page.textTone} onChange={(event) => setPageDisplay("textTone", event.target.value as Page["textTone"])}><option value="dark">深色文字</option><option value="light">浅色文字</option></select></label>
        <label>背景衬层<select value={page.overlayTone} onChange={(event) => setPageDisplay("overlayTone", event.target.value as Page["overlayTone"])}><option value="none">不使用衬层</option><option value="light">浅色柔光</option><option value="dark">深色柔光</option></select></label>
        <label>衬层透明度 <output>{page.overlayOpacity}%</output><input type="range" min="0" max="75" value={page.overlayOpacity} disabled={page.overlayTone === "none"} onChange={(event) => setPageDisplay("overlayOpacity", Number(event.target.value))}/><small>深色建筑图建议选择“浅色文字”，必要时添加 15%–35% 的深色柔光。</small></label>
      </div>
      <button type="button" className="site-pages-secondary" onClick={() => void persist(content, `“${labels[active]}”背景构图与可读性设置已保存。`)}>保存当前分页显示设置</button>
      {page.backgroundImagePath !== defaultPageBackground && <button type="button" className="site-pages-secondary" onClick={() => void persist({ ...content, pages: { ...content.pages, [active]: { ...page, backgroundImagePath: defaultPageBackground, backgroundPositionX: 50, backgroundPositionY: 50, textTone: "dark", overlayTone: "none", overlayOpacity: 0 } } }, `已恢复并保存“${labels[active]}”默认背景。`)}>恢复该分页默认背景</button>}
      <label>页面标题<input value={page.title} maxLength={80} onChange={(event) => setPage("title", event.target.value)}/></label>
      <label>导语<textarea value={page.intro} maxLength={300} onChange={(event) => setPage("intro", event.target.value)}/></label>
      <label>正文（段落之间请空一行）<textarea value={page.body} onChange={(event) => setPage("body", event.target.value)}/></label>
    </section>}
    <div className="site-pages-actions"><button type="button" onClick={() => void save()} disabled={saving}>{saving ? "保存中…" : mode === "footer" ? "保存页脚图文设置" : mode === "pages" ? "保存功能页内容" : "保存页脚与页面内容"}</button><span>{message}</span></div>
  </div>;
}
