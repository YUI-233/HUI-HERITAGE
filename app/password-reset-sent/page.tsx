import Link from "next/link";
import "../admin/catalog/catalog-admin.css";
import "../login/login.css";

export default function PasswordResetSentPage() {
  return <main className="catalog-admin-page"><header><Link href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></Link><Link href="/">返回首页</Link></header><section><p>PASSWORD RECOVERY</p><h1>重置邮件已发送</h1><p className="catalog-admin-intro">如该邮箱已验证，我们已发送密码重置链接。请检查收件箱，以及“垃圾邮件”或“推广”文件夹；链接将在 30 分钟后失效。</p><div className="login-form"><p>请点击邮件中的链接设置新密码。出于账号安全考虑，我们不会在此页面显示邮箱是否已注册。</p><Link className="button-link" href="/login">返回登录</Link><Link href="/forgot-password">重新申请重置链接</Link></div></section></main>;
}
