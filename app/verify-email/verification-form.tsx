"use client";

import { useEffect, useState } from "react";

export function VerificationForm({ token }: { token?: string }) {
  const [message, setMessage] = useState(token ? "正在验证邮箱…" : "验证链接缺失，请重新发送验证邮件。");
  useEffect(() => {
    if (!token) return;
    void fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      setMessage(body.message ?? (response.ok ? "邮箱验证成功。" : "邮箱验证失败。"));
    }).catch(() => setMessage("网络连接失败，请稍后重试。"));
  }, [token]);
  return <div className="login-form"><p>{message}</p><a href="/login">前往登录</a><a href="/resend-verification">重新发送验证邮件</a></div>;
}
