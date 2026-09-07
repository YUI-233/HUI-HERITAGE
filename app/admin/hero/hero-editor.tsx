"use client";

import { useEffect, useState } from "react";

type HeroContent = { desktopImagePath: string | null; mobileImagePath: string | null; altText: string; attribution: string; desktopFocus: string; mobileFocus: string; brandName: string; brandTagline: string; eyebrow: string; headline: string; overlayTone: "none" | "light" | "dark"; overlayOpacity: number };
const empty: HeroContent = { desktopImagePath: null, mobileImagePath: null, altText: "", attribution: "", desktopFocus: "center center", mobileFocus: "center center", brandName: "HUI HERITAGE", brandTagline: "汉文回教古籍文物遗产", eyebrow: "HUI HERITAGE · 数字馆藏计划", headline: "让散落的汉文回教\n古籍与文物重新被看见", overlayTone: "none", overlayOpacity: 0 };

export function HeroEditor() {
  const [content, setContent] = useState<HeroContent>(empty);
  const [message, setMessage] = useState("正在读取当前首页设置…");
  const authHeaders: Record<string, string> = {};

  useEffect(() => {
    fetch("/api/site/hero").then((response) => response.json()).then((data) => {
      setContent(data); setMessage("当前设置已读取。已登录的系统 Admin 可直接编辑；本地口令仅用于兼容初始化。");
    }).catch(() => setMessage("无法读取当前设置。"));
  }, []);

  const update = <K extends keyof HeroContent>(key: K, value: HeroContent[K]) => setContent((current) => ({ ...current, [key]: value }));
  const upload = async (variant: "desktop" | "mobile", file: File | undefined) => {
    if (!file) return;
    const data = new FormData(); data.set("variant", variant); data.set("file", file);
    setMessage("正在上传图片…");
    const response = await fetch("/api/admin/hero-image", { method: "POST", headers: authHeaders, body: data });
    const result = await response.json();
    if (!response.ok) return setMessage(result.message ?? "图片上传失败。");
    update(variant === "desktop" ? "desktopImagePath" : "mobileImagePath", result.path);
    setMessage("图片已上传，记得点击保存首页大图设置。");
  };
  const save = async () => {
    setMessage("正在保存…");
    const response = await fetch("/api/site/hero", { method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify(content) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.message ?? "保存失败。");
    setContent(result); setMessage("首页大图设置已保存。刷新首页即可查看。");
  };

  return <div className="hero-editor">
    <div className="hero-upload-grid">
      <label>桌面端图片（推荐 3000 × 800）<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload("desktop", event.target.files?.[0])}/><span>{content.desktopImagePath ? `当前文件：${content.desktopImagePath}` : "尚未上传图片"}</span></label>
      <label>移动端图片（1440 × 1800）<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload("mobile", event.target.files?.[0])}/><span>{content.mobileImagePath ? `当前文件：${content.mobileImagePath}` : "尚未上传图片"}</span></label>
    </div>
    <div className="hero-upload-grid"><label>网站名称（LOGO 右侧）<input value={content.brandName} maxLength={60} onChange={(event) => update("brandName", event.target.value)} placeholder="HUI HERITAGE"/></label><label>网站说明（LOGO 右侧）<input value={content.brandTagline} maxLength={80} onChange={(event) => update("brandTagline", event.target.value)} placeholder="汉文回教古籍文物遗产"/></label></div>
    <label>首页引导文字<input value={content.eyebrow} maxLength={80} onChange={(event) => update("eyebrow", event.target.value)} placeholder="HUI HERITAGE · 数字馆藏计划"/></label>
    <label>首页主标题（换行请直接按 Enter）<textarea value={content.headline} maxLength={120} onChange={(event) => update("headline", event.target.value)} placeholder="让散落的汉文回教&#10;古籍与文物重新被看见"/></label>
    <label>替代文字（不在页面显示，仅供无障碍阅读）<input value={content.altText} maxLength={160} onChange={(event) => update("altText", event.target.value)} placeholder="描述图片内容，供无障碍阅读使用"/></label>
    <label>图片来源／版权说明<input value={content.attribution} maxLength={240} onChange={(event) => update("attribution", event.target.value)} placeholder="例如：HUI HERITAGE 馆藏图像"/></label>
    <div className="hero-upload-grid"><label>背景衬层<select value={content.overlayTone} onChange={(event) => update("overlayTone", event.target.value as HeroContent["overlayTone"])}><option value="none">不使用衬层（原图展示）</option><option value="light">浅色衬层</option><option value="dark">深色衬层</option></select></label><label>衬层透明度 <output>{content.overlayOpacity}%</output><input type="range" min="0" max="75" value={content.overlayOpacity} disabled={content.overlayTone === "none"} onChange={(event) => update("overlayOpacity", Number(event.target.value))}/></label></div>
    <div className="hero-upload-grid">
      <label>桌面端焦点位置<select value={content.desktopFocus} onChange={(event) => update("desktopFocus", event.target.value)}><option value="left center">左侧居中</option><option value="center center">居中</option><option value="right center">右侧居中</option><option value="center top">上方居中</option><option value="center bottom">下方居中</option></select></label>
      <label>移动端焦点位置<select value={content.mobileFocus} onChange={(event) => update("mobileFocus", event.target.value)}><option value="left center">左侧居中</option><option value="center center">居中</option><option value="right center">右侧居中</option><option value="center top">上方居中</option><option value="center bottom">下方居中</option></select></label>
    </div>
    <p className="hero-editor-message">{message}</p><button type="button" onClick={() => void save()}>保存首页大图设置</button>
  </div>;
}
