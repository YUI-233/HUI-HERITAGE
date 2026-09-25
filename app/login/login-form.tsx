"use client";
import { FormEvent, useState } from "react";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("新账号需先完成邮箱验证；已有账号可直接登录。");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "登录失败。");
    const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/account";
    window.location.assign(safeNext);
  };
  return <form className="login-form" onSubmit={(event) => void submit(event)}><label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label><button>登录</button><p>{message}</p><a href="/resend-verification">没有收到验证邮件？</a><a href="/forgot-password">忘记密码？</a><a href="/register">还没有账号？立即注册</a></form>;
}
