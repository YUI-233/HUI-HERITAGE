import "../login/login.css";
import "../admin/catalog/catalog-admin.css";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() { return <main className="catalog-admin-page"><header><Link href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></Link><Link href="/">返回首页</Link></header><section><p>PASSWORD RECOVERY</p><h1>忘记密码</h1><p className="catalog-admin-intro">为保护账号安全，链接只会发送给已验证的邮箱，并在 30 分钟后失效。</p><ForgotPasswordForm/></section></main>; }
