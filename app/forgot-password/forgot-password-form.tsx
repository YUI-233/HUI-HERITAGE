"use client";

import { FormEvent, useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("请输入已验证账号的邮箱，我们会发送重置链接。");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(body.message ?? "暂时无法处理此请求。");
      window.location.assign("/password-reset-sent");
    } catch {
      setMessage("网络连接失败，请稍后重试。 ");
    } finally {
      setBusy(false);
    }
  };
  return <form className="login-form" onSubmit={(event) => void submit(event)}><label>邮箱<input type="email" value={email} required autoComplete="email" disabled={busy} onChange={(event) => setEmail(event.target.value)}/></label><button disabled={busy}>{busy ? "正在发送重置邮件…" : "发送重置链接"}</button><p>{message}</p><a href="/login">返回登录</a></form>;
}
