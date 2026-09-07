import "../admin/catalog/catalog-admin.css";
import "../login/login.css";
import Link from "next/link";
import { RegisterForm } from "./register-form";
export const dynamic = "force-dynamic";
export default function RegisterPage() { return <main className="catalog-admin-page"><header><Link href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></Link><Link href="/">返回首页</Link></header><section><p>ACCOUNT REGISTRATION</p><h1>注册账号</h1><p className="catalog-admin-intro">普通读者、收藏者与志愿者均可从这里自行注册。提交后需要验证邮箱才能登录；之后由 Admin 根据实际职责分配用户组和权限。个人收藏馆为独立的个人书斋入口。</p><RegisterForm /></section></main>; }
