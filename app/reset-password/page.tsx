import "../login/login.css";
import "../admin/catalog/catalog-admin.css";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="catalog-admin-page"><header><Link href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></Link><Link href="/">返回首页</Link></header><section><p>PASSWORD RECOVERY</p><h1>设置新密码</h1><p className="catalog-admin-intro">保存后，其他设备上的旧登录会话将失效。</p><ResetPasswordForm token={token}/></section></main>;
}
