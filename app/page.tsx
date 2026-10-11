import "./restore.css";
import "./access.css";
import "./home-featured-exhibition.css";
import "./home-featured-research.css";
import "./home-research-invitation.css";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { getHomepageCollectionStats } from "../lib/catalog-repository";
import { defaultHeroContent, getHeroContent } from "../lib/hero-content";
import { getFeaturedExhibition } from "../lib/featured-exhibition";
import { getHomeFeaturedResearch } from "../lib/home-featured-research";
import { getHomeRecommendedBooks } from "../lib/home-recommended-books";
import { defaultHomeBrowseContent, getHomeBrowseContent } from "../lib/home-browse";
import { defaultResearchInvitationContent, getResearchInvitationContent } from "../lib/research-invitation";
import { getSignedInUser } from "../lib/local-auth";
import { NotificationBell } from "./components/notification-bell";
import { ArchiveIndexIcon, CollectorIcon, LibraryIcon, OpenBookIcon } from "./components/heritage-stat-icons";
import { HomeFeaturedExhibition } from "./components/home-featured-exhibition";
import { HomeFeaturedResearchSection } from "./components/home-featured-research";
import { HomeResearchInvitation } from "./components/home-research-invitation";

export const dynamic = "force-dynamic";

async function safeHomeValue<T>(label: string, value: Promise<T>, fallback: T): Promise<T> {
  try { return await value; }
  catch (error) { console.error(`[hui-home:${label}]`, error); return fallback; }
}

export default async function Home() {
  const requestHeaders = await headers();
  const [collectionStats, recommendedBooks, hero, viewer, featuredExhibition, featuredResearch, researchInvitation, browseContent] = await Promise.all([
    safeHomeValue("collection-stats", getHomepageCollectionStats(), { digitalManuscripts: 0, holdingRecords: 0, personalCollections: 0 }),
    safeHomeValue("recommended-books", getHomeRecommendedBooks(), Array.from({ length: 5 }, () => null)),
    safeHomeValue("hero", getHeroContent(), defaultHeroContent),
    safeHomeValue("viewer", getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "", "oai-authenticated-user-id": requestHeaders.get("oai-authenticated-user-id") ?? "", "oai-authenticated-user-email": requestHeaders.get("oai-authenticated-user-email") ?? "", "oai-authenticated-user-full-name": requestHeaders.get("oai-authenticated-user-full-name") ?? "", "oai-authenticated-user-full-name-encoding": requestHeaders.get("oai-authenticated-user-full-name-encoding") ?? "" } })), null),
    safeHomeValue("featured-exhibition", getFeaturedExhibition(), null),
    safeHomeValue("featured-research", getHomeFeaturedResearch(), null),
    safeHomeValue("research-invitation", getResearchInvitationContent(), defaultResearchInvitationContent),
    safeHomeValue("browse-content", getHomeBrowseContent(), defaultHomeBrowseContent),
  ]);
  const browseItems = [
    { title: "数字化古籍", copy: "浏览平台已数字化的古籍、版本、作者与刊刻信息。", href: "/catalog?type=manuscript", action: "进入浏览", image: browseContent.images.manuscript },
    { title: "数字化文物", copy: "浏览碑刻、器物、书画与民间文献等数字化文物资料。", href: "/catalog?type=artifact", action: "进入浏览", image: browseContent.images.artifact },
    { title: "图书馆检索", copy: "检索国内、海外与个人公开收藏的书目及馆藏分布。", href: "/holdings", action: "开始检索", image: browseContent.images.holdings },
    { title: "学术研究", copy: "阅读专题研究、文献阐释与馆藏资料之间的学术关联。", href: "/research", action: "探索研究", image: browseContent.images.research },
  ];
  const heroOverlay = hero.overlayTone === "light" ? `rgba(248,244,236,${hero.overlayOpacity / 100})` : hero.overlayTone === "dark" ? `rgba(22,29,28,${hero.overlayOpacity / 100})` : "rgba(0,0,0,0)";
  return <main>
    <header className="site-header"><a className="brand" href="#top"><img className="official-seal home-brand-mark" src="/brand-mark.png" alt={`${hero.brandName} 标志`}/><span><strong>{hero.brandName}</strong><small>{hero.brandTagline}</small></span></a><nav><Link href="/" aria-current="page">首页</Link><Link href="/catalog?type=manuscript">数字化遗产</Link><Link href="/holdings">图书馆检索</Link><Link href="/research">学术研究</Link><Link href="/personal-collections">个人收藏馆</Link></nav><div className="account">{viewer && <NotificationBell/>}<a href={viewer ? "/account" : "/login"}>{viewer ? "账户中心" : "登录"}</a></div></header>
    <section className={`hero ${hero.desktopImagePath ? "hero-with-image" : ""}`} id="top" style={hero.desktopImagePath ? { "--hero-desktop-image": `url("${hero.desktopImagePath}")`, "--hero-mobile-image": `url("${hero.mobileImagePath ?? hero.desktopImagePath}")`, "--hero-desktop-focus": hero.desktopFocus, "--hero-mobile-focus": hero.mobileFocus, "--hero-overlay-color": heroOverlay } as CSSProperties : undefined}><div className="hero-copy"><p className="eyebrow">{hero.eyebrow}</p><h1>{hero.headline.split("\n").map((line, index) => <span key={index}>{line}{index < hero.headline.split("\n").length - 1 && <br/>}</span>)}</h1><form className="search" action="/holdings" method="get"><input type="search" name="q" aria-label="检索馆藏" placeholder="检索书名、作者、刊刻主体、收藏机构…"/><button type="submit">检索</button></form><div className="hero-meta hero-live-stats" aria-label="实时收录数据"><span className="live-stats-label"><ArchiveIndexIcon className="live-index-icon"/>已收录</span><span className="live-stat"><OpenBookIcon className="approved-stat-icon approved-stat-book"/><b>{collectionStats.digitalManuscripts}</b><small>本数字化古籍</small></span><span className="live-stat"><LibraryIcon className="approved-stat-icon approved-stat-library"/><b>{collectionStats.holdingRecords}</b><small>条图书馆检索记录</small></span><span className="live-stat"><CollectorIcon className="approved-stat-icon approved-stat-collector"/><b>{collectionStats.personalCollections}</b><small>座个人收藏馆</small></span></div></div>{hero.attribution && <small className="hero-attribution">图像来源：{hero.attribution}</small>}</section>
    <HomeFeaturedExhibition exhibition={featuredExhibition}/>
    <HomeFeaturedResearchSection research={featuredResearch}/>
    <section className="section" id="manuscripts"><div className="section-heading"><div><p className="eyebrow">RECOMMENDED READING</p><h2>古籍阅读推荐</h2></div></div><div className="record-grid manuscript-home-grid">{recommendedBooks.map((record, index) => record ? <article className="record" key={record.id}><a className="record-link" href={record.href}><div className="real-image manuscript-home-cover">{record.imageAccess === "public" ? <img src={record.image} alt={record.title}/> : <span>暂未上传公开封面</span>}</div><p className="type">阅读推荐 · {String(index + 1).padStart(2, "0")}</p><h3>{record.title}</h3><p className="manuscript-home-meta">{record.meta}</p></a></article> : <article className="record manuscript-recommendation-empty" key={`empty-${index}`}><div className="manuscript-home-cover"><span><b>{String(index + 1).padStart(2, "0")}</b>推荐位待设置</span></div><p className="type">阅读推荐</p><h3>敬请期待</h3></article>)}</div></section>
    <section className="browse section" id="browse"><div className="section-heading"><div><p className="eyebrow">BROWSE</p><h2>从一项线索开始浏览</h2></div></div><div className="browse-grid">{browseItems.map((item, index) => <a className="browse-card" href={item.href} key={item.title}><div className="browse-card-image"><img src={item.image} alt="" /></div><div className="browse-card-body"><span>0{index + 1}</span><h3>{item.title}</h3><i aria-hidden="true"/><p>{item.copy}</p><b>{item.action}<em aria-hidden="true">→</em></b></div></a>)}</div></section>
    <HomeResearchInvitation content={researchInvitation}/>
  </main>;
}
