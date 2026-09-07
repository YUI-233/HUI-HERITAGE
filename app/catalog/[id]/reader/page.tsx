import "./reader.css";
import { Breadcrumbs, PublicHeader } from "../../../components/public-header";
import { getCatalogRecord } from "../../../../lib/catalog-repository";
import { PdfReader } from "./pdf-reader";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInUser } from "../../../../lib/local-auth";
import { canReadBorrowedBook } from "../../../../lib/borrowing";
import { VolumeSwitcher } from "./volume-switcher";

type ReaderPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ volume?: string }> };

export const dynamic = "force-dynamic";

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
  const { id } = await params;
  const { volume } = await searchParams;
  const record = await getCatalogRecord(id);
  if (!record) return <main className="reader-page"><PublicHeader active="catalog"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "数字化遗产", href: "/catalog" }, { label: "阅读器" }]}/><p className="reader-not-found">未找到这条资料。</p></main>;
  const document = record.memberDocuments?.find((item) => item.id === volume) ?? record.memberDocuments?.[0];
  const pdf = document?.href;
  if (pdf && record.type === "manuscript") {
    const requestHeaders = await headers();
    const user = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
    if (!user) redirect("/login");
    if (!(await canReadBorrowedBook(user.id, record.id))) redirect(`/catalog/${record.id}`);
  }
  return <main className="reader-page"><PublicHeader active="catalog"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "数字化遗产", href: "/catalog" }, { label: record.title, href: `/catalog/${record.id}` }, { label: document?.label ?? "PDF 阅读" }]}/><header className="reader-heading"><div><p>HUI HERITAGE PDF READER</p><h1>{record.title}{document && <small>{document.label}</small>}</h1></div><div className="reader-heading-actions"><VolumeSwitcher recordId={record.id} volumes={record.memberDocuments ?? []} currentVolumeId={document?.id}/><a href={`/catalog/${record.id}`}>返回资料详情</a></div></header>{pdf ? <PdfReader key={document?.id ?? pdf} documentUrl={pdf} title={`${record.title} · ${document?.label ?? "PDF"}`} /> : <p className="reader-not-found">此资料暂未提供 PDF 阅读文件。图片可在资料详情页直接查看。</p>}</main>;
}
