import Link from "next/link";
import { headers } from "next/headers";
import { getSignedInUser } from "../../lib/local-auth";
import { NotificationBell } from "./notification-bell";

export type PublicSection = "home" | "catalog" | "holdings" | "research" | "personal";

const links: Array<{ id: PublicSection; href: string; label: string }> = [
  { id: "home", href: "/", label: "首页" }, { id: "catalog", href: "/catalog", label: "数字化遗产" },
  { id: "holdings", href: "/holdings", label: "图书馆检索" }, { id: "research", href: "/research", label: "学术研究" },
  { id: "personal", href: "/personal-collection", label: "个人收藏馆" },
];

export async function PublicHeader({ active }: { active?: PublicSection }) {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  return <header className="site-header public-site-header"><Link className="brand" href="/"><img className="official-seal" src="/brand-mark.png" alt="HUI HERITAGE 标志"/><span><strong>HUI HERITAGE</strong><small>汉文回教古籍文物遗产</small></span></Link><nav aria-label="网站主导航">{links.map((link) => <Link href={link.href} aria-current={active === link.id ? "page" : undefined} key={link.id}>{link.label}</Link>)}</nav><div className="account">{viewer ? <NotificationBell/> : null}<Link href={viewer ? "/account" : "/login"}>{viewer ? "账户中心" : "登录"}</Link></div></header>;
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return <nav className="page-breadcrumbs" aria-label="当前位置">{items.map((item, index) => <span key={`${item.label}-${index}`}>{item.href ? <Link href={item.href}>{item.label}</Link> : <b>{item.label}</b>}{index < items.length - 1 && <i aria-hidden="true">/</i>}</span>)}</nav>;
}
