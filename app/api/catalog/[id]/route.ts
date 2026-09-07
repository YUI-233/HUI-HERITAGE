import { getCatalogRecord } from "../../../../lib/catalog-repository";
import { toPublicCatalogRecord } from "../../../../lib/public-catalog";

type CatalogDetailRouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: CatalogDetailRouteProps) {
  const { id } = await params;
  const record = await getCatalogRecord(id);
  if (!record) return Response.json({ error: "NOT_FOUND", message: "未找到这条馆藏资料" }, { status: 404 });
  return Response.json({ record: toPublicCatalogRecord(record) }, { headers: { "Cache-Control": "no-store" } });
}
