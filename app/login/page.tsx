import "../admin/catalog/catalog-admin.css";
import "./login.css";
import { LoginForm } from "./login-form";
import Link from "next/link";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const { next } = await searchParams; return <main className="catalog-admin-page"><header><Link href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></Link><Link href="/">返回首页</Link></header><section><p>ACCOUNT ACCESS</p><h1>账号登录</h1><p className="catalog-admin-intro">登录后进入账号中心，查看账户信息与已开通的工作权限。个人收藏馆与后台工作台均从账号中心分别进入。</p><LoginForm nextPath={next} /></section></main>; }
