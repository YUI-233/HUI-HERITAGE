"use client";

import { FormEvent, useState } from "react";
import { PasswordStrength } from "@/app/components/password-strength";

export function ResetPasswordForm({ token }: { token?: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(token ? "设置至少 12 位的新密码。" : "重置链接缺失，请重新申请。 ");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || busy) return;
    if (password !== confirmation) return setMessage("两次输入的密码不一致。 ");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(body.message ?? "密码重置失败。 ");
      window.location.assign("/password-reset-complete");
    } catch {
      setMessage("网络连接失败，请稍后重试。 ");
    } finally {
      setBusy(false);
    }
  };
  const confirmationMet = confirmation.length > 0 && confirmation === password;
  return <form className="login-form" onSubmit={(event) => void submit(event)}><label>新密码<input type="password" value={password} required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy} onChange={(event) => setPassword(event.target.value)}/><small>至少 12 位；可使用空格、大小写、数字和符号。</small></label><PasswordStrength password={password}/><label>确认新密码<input type="password" value={confirmation} required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy} onChange={(event) => setConfirmation(event.target.value)}/>{confirmation.length > 0 && <small className={`password-confirmation ${confirmationMet ? "met" : ""}`}><i>{confirmationMet ? "✓" : ""}</i>{confirmationMet ? "两次密码一致" : "两次密码不一致"}</small>}</label><button disabled={!token || busy}>{busy ? "正在保存新密码…" : "保存新密码"}</button><p>{message}</p><a href="/login">前往登录</a></form>;
}
