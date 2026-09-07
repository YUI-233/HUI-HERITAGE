import { findCatalogRecords, isCatalogType } from "../../../lib/catalog-repository";
import { toPublicCatalogRecord } from "../../../lib/public-catalog";

function positiveInteger(value: string | null) {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const typeValue = url.searchParams.get("type") ?? undefined;
  const type = isCatalogType(typeValue) ? typeValue : undefined;
  const result = await findCatalogRecords({
    query: url.searchParams.get("q") ?? "",
    type,
    title: url.searchParams.get("title") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    language: url.searchParams.get("language") ?? undefined,
    author: url.searchParams.get("author") ?? undefined,
    time: url.searchParams.get("time") ?? undefined,
    imprint: url.searchParams.get("imprint") ?? undefined,
    page: positiveInteger(url.searchParams.get("page")),
    pageSize: positiveInteger(url.searchParams.get("pageSize")),
  });

  return Response.json({
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    records: result.records.map(toPublicCatalogRecord),
  }, { headers: { "Cache-Control": "no-store" } });
}
