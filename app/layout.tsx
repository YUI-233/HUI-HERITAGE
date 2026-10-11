import type { Metadata } from "next";
import "./globals.css";
import "./site-footer.css";
import "./footer-refinements.css";
import "./brand-mark-overrides.css";
import { getSitePagesContent } from "../lib/site-pages";
import { SiteFooter } from "./components/site-footer";
import { VisitTracker } from "./components/visit-tracker";
import { Suspense } from "react";
export const metadata: Metadata = { title: "HUI HERITAGE｜汉文回教古籍文物遗产", description: "汉文回教古籍、文物与馆藏记录的数字平台。", openGraph: { title: "HUI HERITAGE｜汉文回教古籍文物遗产", description: "以展览、检索与可靠馆藏记录，连接公共知识与私人守护。", images: ["/og.png"] }, twitter: { card: "summary_large_image", title: "HUI HERITAGE", images: ["/og.png"] } };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sitePages = await getSitePagesContent();
  return <html lang="zh-CN"><body><Suspense fallback={null}><VisitTracker /></Suspense>{children}<SiteFooter content={sitePages}/></body></html>;
}
