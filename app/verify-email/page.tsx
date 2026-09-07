import "../login/login.css";
import "../admin/catalog/catalog-admin.css";
import Link from "next/link";
import { VerificationForm } from "./verification-form";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="catalog-admin-page"><header><Link href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></Link><Link href="/">返回首页</Link></header><section><p>EMAIL VERIFICATION</p><h1>验证邮箱</h1><p className="catalog-admin-intro">验证完成后，你即可使用新账号登录。</p><VerificationForm token={token}/></section></main>;
}
