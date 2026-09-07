import "../catalog/catalog.css";
import "../access.css";
import { PublicHeader } from "../components/public-header";

const datasets = [
  { id: "catalog", title: "数字化遗产", copy: "已公开的数字化古籍与文物元数据，包括题名、年代、数字化来源、主题词与图像访问说明。" },
  { id: "holdings", title: "图书馆检索", copy: "国内、海外及个人公开收藏的图书馆、地区、索书号与关联书目记录。" },
  { id: "research", title: "研究资料", copy: "公开研究路径的题名、分类、主题词、摘要与关联馆藏编号。" },
];

export default function DataPage() {
  return <main className="catalog-page"><PublicHeader/><section className="catalog-hero"><p>HUI HERITAGE · DATA SERVICES</p><h1>公开数据下载</h1><p>下载仅包含已公开、已审核的元数据；古籍受限图片与任何私人信息均不会导出。</p></section><section className="catalog-content"><div className="catalog-grid">{datasets.map((dataset) => <article className="catalog-card" key={dataset.id}><p>CSV · UTF-8</p><h2>{dataset.title}</h2><div>{dataset.copy}</div><p><a href={`/api/export/${dataset.id}`}>下载 CSV 文件 →</a></p></article>)}</div><div className="catalog-empty"><h2>关于数据补充</h2><p>数据导入、编辑与审核将仅在管理后台开放；该功能将在账号与权限模块完成后接入。</p></div></section></main>;
}
