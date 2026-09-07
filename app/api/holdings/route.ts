import { isHoldingOrigin, listHoldings } from "../../../lib/holdings-repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const originValue = url.searchParams.get("origin") ?? undefined;
  const holdings = await listHoldings({
    query: url.searchParams.get("q") ?? "",
    origin: isHoldingOrigin(originValue) ? originValue : undefined,
    region: url.searchParams.get("region") ?? undefined,
  });
  return Response.json({ total: holdings.length, records: holdings }, { headers: { "Cache-Control": "no-store" } });
}
