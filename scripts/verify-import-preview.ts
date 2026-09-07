import { POST } from "../app/api/admin/import-preview/route";
import { previewCatalogImport } from "../lib/catalog-import-preview";

process.env.ADMIN_LOCAL_TOKEN = "verification-only-token";

async function main() {
  const csv = "关联资料类型,关联资料编号,收藏机构,地区,来源类型,索书号／版本,馆方目录链接,馆藏说明,发布状态\n古籍,qingzhen-shiyi,导入验收机构,验收地区,国内馆藏,,,,草稿\n文物,astronomy,导入验收机构,验收地区,无效来源,,,,公开";
  const form = new FormData();
  form.set("file", new File([csv], "catalogue-preview.csv", { type: "text/csv" }));
  const response = await POST(new Request("http://localhost/api/admin/import-preview", { method: "POST", headers: { "x-admin-local-token": "verification-only-token" }, body: form }));
  const result = await response.json() as { total?: number; valid?: number; errors?: Array<{ row: number }> };
  if (response.status !== 200 || result.total !== 2 || result.valid !== 1 || result.errors?.[0]?.row !== 3) throw new Error("CSV preview did not return the expected validation result.");

  const domestic = previewCatalogImport("书名,作者,册数,年代,刊刻年份,刊刻时间,版本,版本信息,图书馆,检索号,备注,链接,图片1,图片2\n测试国内馆藏,马注,1,清,光绪八年,1882,木刻本,初刻本,测试图书馆,ABC-1,备注可独立保存,https://library.example/item/1,https://images.example/book-1.jpg,");
  if (domestic.format !== "domestic" || domestic.valid !== 1) throw new Error("Domestic holding headers were not recognized.");
  const overseas = previewCatalogImport("书名,作者,册数,年代,刊刻年份,刊刻时间,版本,刊刻主体,国家,图书馆,检索号,链接,備註\n测试海外馆藏,马注,2,清,同治元年,1862,木刻本,京都清真寺,日本,测试图书馆,XYZ-2,https://library.example/item/2,备注可独立保存");
  if (overseas.format !== "overseas_latest" || overseas.valid !== 1) throw new Error("Overseas holding headers were not recognized.");
  const invalidImage = previewCatalogImport("书名,作者,册数,年代,刊刻年份,刊刻时间,版本,版本信息,图书馆,检索号,备注,链接,图片1,图片2\n图片校验,马注,1,清,,,木刻本,,测试图书馆,IMG-1,,,local-cover.jpg,");
  if (invalidImage.valid !== 0 || !invalidImage.errors[0]?.message.includes("图片1")) throw new Error("Image URL validation did not return the expected message.");
  console.log("csv_import_preview_ok=legacy:valid1_invalid1,latest:domestic_overseas,image_url_validated,no_database_write");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
