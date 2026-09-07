import "./hero-admin.css";
import { AdminHeader } from "../admin-header";
import { requireSystemAdminPage } from "../require-system-admin-page";

export const dynamic = "force-dynamic";

export default async function HeroAdminPage() {
  await requireSystemAdminPage();
  const entries = [["hero", "首页大图设置", "调整首页首屏标题、说明和桌面／移动端背景图。"], ["search-hero", "检索区背景图", "分别设置数字化遗产、图书馆检索与学术研究的检索区背景图。"], ["home-browse", "首页浏览入口", "分别上传和替换四个浏览入口图片。"], ["featured-exhibition", "精选展览", "选择首页展示的馆藏或个人收藏资料。"], ["featured-research", "推荐学术研究", "选择推荐文章并设置该区域背景。"], ["recommended-books", "古籍阅读推荐", "配置首页的五个古籍推荐位。"], ["research-invitation", "学术研究邀请", "管理学者与志愿者参与邀请区域的背景图。"], ["footer", "页脚图文设置", "编辑全站页脚文案、背景图及构图位置。"], ["site-pages", "页脚功能页管理", "分别编辑关于我们等六个功能页的文字、背景和可读性。"]] as const;
  return <main className="hero-admin-page"><AdminHeader active="/admin/hero"/><section><p>LOCAL SUPER ADMIN · HOME PAGE</p><h1>首页展示管理</h1><p className="hero-admin-intro">请选择一个功能进入编辑。每次只处理一个区域，保存与预览会更清楚。</p><div className="hero-admin-entry-grid">{entries.map(([slug, title, description], index) => <a href={`/admin/hero/${slug}`} className="hero-admin-entry" key={slug}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{description}</p><b>进入管理 <i aria-hidden="true">→</i></b></a>)}</div></section></main>;
}
