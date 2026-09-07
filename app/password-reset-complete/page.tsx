import Link from "next/link";
import "../admin/catalog/catalog-admin.css";
import "../login/login.css";

export default function PasswordResetCompletePage() {
  return <main className="catalog-admin-page"><header><Link href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></Link><Link href="/">返回首页</Link></header><section><p>PASSWORD RECOVERY</p><h1>密码已重置</h1><p className="catalog-admin-intro">请使用新密码登录。为保护账号安全，其他设备上的旧登录会话已失效。</p><div className="login-form"><p>密码重置已完成。</p><Link className="button-link" href="/login">前往登录</Link></div></section></main>;
}
