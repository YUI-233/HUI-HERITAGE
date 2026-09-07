"use client";

import { FormEvent, useState } from "react";

export function ResendVerificationForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("请输入注册时使用的邮箱，我们将重新发送验证链接。");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const body = await response.json().catch(() => ({}));
    setMessage(body.message ?? "暂时无法发送验证邮件。");
  };
  return <form className="login-form" onSubmit={(event) => void submit(event)}><label>邮箱<input type="email" value={email} required autoComplete="email" onChange={(event) => setEmail(event.target.value)}/></label><button>重新发送验证邮件</button><p>{message}</p><a href="/login">返回登录</a></form>;
}
