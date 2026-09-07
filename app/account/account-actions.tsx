"use client";

import { useState } from "react";

export function AccountNameEditor({ displayName, canChange }: { displayName: string; canChange: boolean }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [message, setMessage] = useState("");
  const saveName = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name }) });
      const data = await response.json().catch(() => null) as { message?: unknown } | null;
      if (!response.ok) {
        setMessage(typeof data?.message === "string" ? data.message : "保存失败。");
        return;
      }
      window.location.assign("/account");
    } catch {
      setMessage("保存失败。");
    } finally {
      setBusy(false);
    }
  };
  return <div className={`account-name-editor ${editing ? "editing" : ""}`}>{editing ? <form onSubmit={(event) => { event.preventDefault(); void saveName(); }}><input aria-label="书斋名" value={name} maxLength={60} autoFocus onChange={(event) => setName(event.target.value)} /><span><button type="submit" disabled={busy}>保存</button><button type="button" className="secondary" onClick={() => { setName(displayName); setEditing(false); setMessage(""); }}>取消</button></span></form> : <><h2>{displayName || "HUI HERITAGE 用户"}</h2><button className="account-name-edit" type="button" aria-label="修改书斋名" title={canChange ? "修改书斋名" : "本年度已修改"} disabled={!canChange} onClick={() => setEditing(true)}>✎</button></>}{message && <small>{message}</small>}</div>;
}

export function AccountActions() {
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    const response = await fetch("/api/auth/logout", { method: "POST" });
    const data = await response.json().catch(() => null) as { redirectTo?: unknown } | null;
    const redirectTo = typeof data?.redirectTo === "string" && data.redirectTo.startsWith("/") ? data.redirectTo : "/";
    window.location.assign(redirectTo);
  };
  return <button className="account-signout" type="button" onClick={() => void signOut()} disabled={busy}>{busy ? "正在退出…" : "退出登录"}</button>;
}
