"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Cover = { mediaId: string; itemId: string; url: string };
type CollectionProfile = { slug: string; displayName: string; description: string | null; cover: Cover | null };
type CoverOption = Cover & { itemTitle: string; itemType: "BOOK" | "ARTIFACT" };
type ProfileItem = {
  id: string;
  type: "BOOK" | "ARTIFACT";
  title: string;
  status: string;
  isPublic: boolean;
  media: Array<{ id: string }>;
};

const PROFILE_STORAGE_KEY = "hui-heritage:personal-collection-profile-draft";
const ALLOW_PROFILE_MOCK = process.env.NODE_ENV === "development";

function fallbackProfile(defaultDisplayName: string): CollectionProfile {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (stored) return JSON.parse(stored) as CollectionProfile;
    } catch {
      // A blocked or malformed local draft should not prevent the settings page from opening.
    }
  }
  return { slug: "pending-backend-slug", displayName: defaultDisplayName, description: null, cover: null };
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

export function PersonalCollectionSettings({ defaultDisplayName, items }: { defaultDisplayName: string; items: ProfileItem[] }) {
  const localCoverOptions = useMemo<CoverOption[]>(() => items
    .filter((item) => item.status === "APPROVED" && item.isPublic)
    .flatMap((item) => item.media.map((media) => ({
      mediaId: media.id,
      itemId: item.id,
      itemTitle: item.title,
      itemType: item.type,
      url: `/api/personal-collection/items/${item.id}/media/${media.id}`,
    }))), [items]);
  const [saved, setSaved] = useState<CollectionProfile | null>(null);
  const [coverOptions, setCoverOptions] = useState<CoverOption[] | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [coverMediaId, setCoverMediaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authExpired, setAuthExpired] = useState(false);

  const applyProfile = (profile: CollectionProfile) => {
    setSaved(profile);
    setDisplayName(profile.displayName);
    setDescription(profile.description ?? "");
    setCoverMediaId(profile.cover?.mediaId ?? null);
  };

  const load = useCallback(async () => {
    setLoading(true); setError(""); setAuthExpired(false);
    try {
      const [profileResponse, optionsResponse] = await Promise.all([
        fetch("/api/personal-collection/profile", { cache: "no-store" }),
        fetch("/api/personal-collection/profile/cover-options", { cache: "no-store" }),
      ]);
      if (profileResponse.status === 401 || optionsResponse.status === 401) {
        setAuthExpired(true); return;
      }
      const profileBody = await readJson(profileResponse);
      const optionsBody = await readJson(optionsResponse);
      if (!profileResponse.ok && (!ALLOW_PROFILE_MOCK || profileResponse.status !== 404)) throw new Error(profileBody.message ?? "暂时无法读取收藏馆设置。");
      if (!optionsResponse.ok && (!ALLOW_PROFILE_MOCK || optionsResponse.status !== 404)) throw new Error(optionsBody.message ?? "暂时无法读取可选封面。");
      applyProfile(profileResponse.ok ? profileBody as CollectionProfile : fallbackProfile(defaultDisplayName));
      setCoverOptions(optionsResponse.ok && Array.isArray(optionsBody.items) ? optionsBody.items : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时无法读取收藏馆设置，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [defaultDisplayName]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const effectiveCoverOptions = coverOptions ?? localCoverOptions;
  const selectedOption = effectiveCoverOptions.find((option) => option.mediaId === coverMediaId);
  const previewUrl = selectedOption?.url ?? (saved?.cover?.mediaId === coverMediaId ? saved.cover.url : null);
  const trimmedName = displayName.trim();
  const nameError = trimmedName.length > 0 && (trimmedName.length < 2 || trimmedName.length > 40)
    ? "收藏馆名称应为 2–40 个字符。" : "";
  const descriptionError = description.length > 300 ? "收藏馆简介不能超过 300 个字符。" : "";
  const dirty = saved !== null && (displayName !== saved.displayName || description !== (saved.description ?? "") || coverMediaId !== (saved.cover?.mediaId ?? null));

  const cancel = () => {
    if (!saved) return;
    setDisplayName(saved.displayName); setDescription(saved.description ?? ""); setCoverMediaId(saved.cover?.mediaId ?? null);
    setMessage(""); setError("");
  };

  const save = async () => {
    setMessage(""); setError("");
    if (trimmedName.length < 2 || trimmedName.length > 40) return setError("收藏馆名称应为 2–40 个字符。");
    if (description.length > 300) return setError("收藏馆简介不能超过 300 个字符。");
    setSaving(true);
    const payload = { displayName: trimmedName, description: description.trim(), coverMediaId };
    try {
      const response = await fetch("/api/personal-collection/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (response.status === 401) { setAuthExpired(true); return; }
      const body = await readJson(response);
      if (!response.ok && (!ALLOW_PROFILE_MOCK || response.status !== 404)) throw new Error(body.message ?? "暂时无法保存收藏馆设置，请稍后重试。");
      const profile: CollectionProfile = response.ok ? body as CollectionProfile : {
        slug: saved?.slug ?? "pending-backend-slug",
        displayName: payload.displayName,
        description: payload.description || null,
        cover: coverMediaId && selectedOption ? { mediaId: selectedOption.mediaId, itemId: selectedOption.itemId, url: selectedOption.url } : null,
      };
      if (!response.ok) window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      applyProfile(profile);
      setMessage(response.ok ? "收藏馆设置已保存，公开页面将在刷新后显示最新资料。" : "前端设置已保存为本地预览；后端接口接通后将同步到公开页面。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时无法保存收藏馆设置，请稍后重试。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className="collection-panel profile-settings-panel profile-settings-state" aria-live="polite"><span className="profile-loading-mark" aria-hidden="true"/><p>正在读取收藏馆设置……</p></section>;
  if (authExpired) return <section className="collection-panel profile-settings-panel profile-settings-state"><p>登录状态已失效，请重新登录后管理收藏馆。</p><a href="/login">前往登录</a></section>;
  if (!saved) return <section className="collection-panel profile-settings-panel profile-settings-state"><p>{error || "暂时无法读取收藏馆设置。"}</p><button type="button" onClick={() => void load()}>重新加载</button></section>;

  return <section className="collection-panel profile-settings-panel">
    <header className="profile-settings-heading"><div><p>COLLECTION PROFILE</p><h2>收藏馆设置</h2><span>这里的资料会展示在公开收藏馆目录和详情页。</span></div>{saved.slug !== "pending-backend-slug" && <a href={`/personal-collections/${saved.slug}`}>查看公开页面 ↗</a>}</header>
    <div className="profile-settings-layout">
      <aside className="profile-cover-preview"><span>当前封面</span>{previewUrl ? <img src={previewUrl} alt={`${displayName || "收藏馆"}封面预览`}/> : <div className="profile-default-cover"><i>HUI HERITAGE</i><strong>{displayName.trim() || "个人收藏馆"}</strong><small>系统默认封面</small></div>}</aside>
      <div className="profile-settings-form">
        <label className="profile-field"><span>收藏馆名称 <b>必填</b></span><input value={displayName} maxLength={40} aria-invalid={Boolean(nameError)} onChange={(event) => { setDisplayName(event.target.value); setMessage(""); }}/><small className={nameError ? "field-error" : ""}>{nameError || `${displayName.length} / 40`}</small></label>
        <label className="profile-field"><span>收藏馆简介 <em>选填</em></span><textarea value={description} maxLength={320} aria-invalid={Boolean(descriptionError)} placeholder="介绍你的收藏方向、年代范围或建馆缘起。" onChange={(event) => { setDescription(event.target.value); setMessage(""); }}/><small className={descriptionError ? "field-error" : ""}>{descriptionError || `${description.length} / 300`}</small></label>
        <div className="profile-url-note"><span>公开地址</span><code>{saved.slug === "pending-backend-slug" ? "后端接通后生成" : `/personal-collections/${saved.slug}`}</code><small>公开地址保持稳定，本期不可修改。</small></div>
      </div>
    </div>
    <section className="profile-cover-options" aria-labelledby="cover-options-title"><div className="profile-cover-options-heading"><div><h3 id="cover-options-title">从公开藏品中选择封面</h3><p>只显示已审核通过且已公开的书籍或藏品图片。</p></div><button type="button" className={!coverMediaId ? "active" : ""} onClick={() => { setCoverMediaId(null); setMessage(""); }}>恢复默认封面</button></div>
      {effectiveCoverOptions.length ? <div className="profile-cover-grid">{effectiveCoverOptions.map((option) => <button type="button" aria-pressed={coverMediaId === option.mediaId} className={coverMediaId === option.mediaId ? "selected" : ""} key={option.mediaId} onClick={() => { setCoverMediaId(option.mediaId); setMessage(""); }}><img src={option.url} alt=""/><span><b>{option.itemTitle}</b><small>{option.itemType === "BOOK" ? "书籍" : "藏品"}</small></span><i aria-hidden="true">✓</i></button>)}</div> : <div className="profile-cover-empty"><b>目前没有可作为封面的图片</b><p>将带图片的书籍或藏品提交审核并设为公开后，就可以在这里选择。</p></div>}
    </section>
    {(error || message) && <p className={`profile-feedback ${error ? "error" : "success"}`} role="status">{error || message}</p>}
    <footer className="profile-settings-actions"><button type="button" className="profile-cancel-button" disabled={!dirty || saving} onClick={cancel}>取消修改</button><button type="button" className="profile-save-button" disabled={!dirty || saving || Boolean(nameError) || Boolean(descriptionError)} onClick={() => void save()}>{saving ? "正在保存……" : "保存设置"}</button></footer>
  </section>;
}
