import Link from "next/link";
import "../admin/catalog/catalog-admin.css";
import "../login/login.css";

export default function VerifyEmailSentPage() {
  return <main className="catalog-admin-page"><header><Link href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></Link><Link href="/">返回首页</Link></header><section><p>ACCOUNT REGISTRATION</p><h1>验证邮件已发送</h1><p className="catalog-admin-intro">请前往注册邮箱查收来自 HUI HERITAGE 的验证邮件，并点击其中的链接完成验证。邮件有时会出现在“垃圾邮件”或“推广”文件夹中。</p><div className="login-form"><p>验证成功后，你即可使用邮箱和密码登录。</p><Link className="button-link" href="/login">前往登录</Link><Link href="/resend-verification">没有收到验证邮件？</Link></div></section></main>;
}
