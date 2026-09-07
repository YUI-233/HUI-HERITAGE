import "../login/login.css";
import "../admin/catalog/catalog-admin.css";
import Link from "next/link";
import { ResendVerificationForm } from "./resend-verification-form";

export default function ResendVerificationPage() { return <main className="catalog-admin-page"><header><Link href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></Link><Link href="/">返回首页</Link></header><section><p>EMAIL VERIFICATION</p><h1>重新发送验证邮件</h1><p className="catalog-admin-intro">为避免滥用，同一邮箱在短时间内的发送次数会受到限制。</p><ResendVerificationForm/></section></main>; }
