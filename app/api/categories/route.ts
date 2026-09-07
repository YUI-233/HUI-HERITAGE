import { listManagedCategories } from "../../../lib/category-requests";

export async function GET(request: Request) {
  return Response.json(await listManagedCategories(new URL(request.url).searchParams.get("scope") ?? undefined));
}
