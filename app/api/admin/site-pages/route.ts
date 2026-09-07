import { requireSystemAdmin } from "../../../../lib/admin-access";
import { getSitePagesContent, saveSitePagesContent } from "../../../../lib/site-pages";
export async function GET(request: Request) { const denied = await requireSystemAdmin(request); if (denied) return denied; return Response.json(await getSitePagesContent()); }
export async function PUT(request: Request) { const denied = await requireSystemAdmin(request); if (denied) return denied; return Response.json(await saveSitePagesContent(await request.json().catch(() => null))); }
