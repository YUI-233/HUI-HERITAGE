"use client";
import { FormEvent, useState } from "react";
import { PasswordStrength } from "@/app/components/password-strength";

export function RegisterForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("注册后请前往邮箱完成验证；管理权限仍须由 Admin 审核分配。");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, email, password }) });
      const body = await response.json();
      if (!response.ok) return setMessage(body.message ?? "注册失败。");
      window.location.assign("/verify-email-sent");
    } catch {
      setMessage("网络连接失败，请稍后重试。 ");
    } finally {
      setBusy(false);
    }
  };
  return <form className="login-form" onSubmit={(event) => void submit(event)}><label>显示名称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" disabled={busy}/></label><label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" disabled={busy}/></label><label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy}/><small>至少 12 位；可使用空格、大小写、数字和符号。</small></label><PasswordStrength password={password}/><button disabled={busy}>{busy ? "正在发送验证邮件…" : "注册并发送验证邮件"}</button><p>{message}</p><a href="/login">已有账号？前往登录</a></form>;
}
