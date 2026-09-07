import "../hero-admin.css";
import "../featured-exhibition-editor.css";
import "../featured-research-editor.css";
import "../recommended-books-editor.css";
import "../research-invitation-editor.css";
import "../home-browse-editor.css";
import "../admin-layout-refinement.css";
import "../../site-pages/site-pages-admin.css";
import "../site-pages-integration.css";
import { notFound } from "next/navigation";
import { AdminHeader } from "../../admin-header";
import { HeroEditor } from "../hero-editor";
import { FeaturedExhibitionEditor } from "../featured-exhibition-editor";
import { FeaturedResearchEditor } from "../featured-research-editor";
import { RecommendedBooksEditor } from "../recommended-books-editor";
import { ResearchInvitationEditor } from "../research-invitation-editor";
import { HomeBrowseEditor } from "../home-browse-editor";
import { SitePagesEditor } from "../../site-pages/site-pages-editor";
import { SearchHeroEditor } from "../search-hero-editor";
import { requireSystemAdminPage } from "../../require-system-admin-page";

export const dynamic = "force-dynamic";

const sections = {
  hero: { title: "首页大图设置", content: <HeroEditor /> },
  "search-hero": { title: "检索区背景图", content: <SearchHeroEditor /> },
  "home-browse": { title: "首页浏览入口", content: <HomeBrowseEditor /> },
  "featured-exhibition": { title: "精选展览", content: <FeaturedExhibitionEditor /> },
  "featured-research": { title: "推荐学术研究", content: <FeaturedResearchEditor /> },
  "recommended-books": { title: "古籍阅读推荐", content: <RecommendedBooksEditor /> },
  "research-invitation": { title: "学术研究邀请", content: <ResearchInvitationEditor /> },
  footer: { title: "页脚图文设置", content: <SitePagesEditor mode="footer" /> },
  "site-pages": { title: "页脚功能页管理", content: <SitePagesEditor mode="pages" /> },
} as const;

export default async function HomeDisplaySectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireSystemAdminPage();
  const { section } = await params;
  const item = sections[section as keyof typeof sections];
  if (!item) notFound();
  return <main className="hero-admin-page"><AdminHeader active={`/admin/hero/${section}`}/><section><a className="hero-admin-back" href="/admin/hero">← 返回首页展示管理</a><p>LOCAL SUPER ADMIN · HOME PAGE</p><h1>{item.title}</h1>{section === "hero" && <div className="hero-guidelines"><h2>图片规格</h2><ul><li>桌面端推荐 3000 × 800 px（约 3.75:1），最低 1920 × 520 px。</li><li>移动端推荐 1440 × 1800 px，可单独上传。</li><li>支持 JPG、PNG、WebP；单张不超过 8 MB，展示版建议控制在 2 MB 内。</li><li>首页标题位于左侧，请在画面左侧约 50% 保留干净留白。</li></ul></div>}{item.content}</section></main>;
}
