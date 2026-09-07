import "../catalog/catalog-admin.css";
import { AdminHeader } from "../admin-header";
import { ResearchEditor } from "./research-editor";

export const dynamic = "force-dynamic";

export default async function ResearchAdminPage({ searchParams }: { searchParams: Promise<{ articleId?: string }> }) {
  const { articleId } = await searchParams;
  return <main className="catalog-admin-page"><AdminHeader active="/admin/research"/><section><p>RESEARCH · EDITING</p><h1>研究资料编辑</h1><p className="catalog-admin-intro">新增、修改与删除均需提交审核；正文支持从 Word 直接粘贴并保留常用结构。</p><ResearchEditor initialArticleId={articleId} /></section></main>;
}
