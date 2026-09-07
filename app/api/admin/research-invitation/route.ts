import { requireSystemAdmin } from "../../../../lib/admin-access";
import { getResearchInvitationContent, saveResearchInvitationContent } from "../../../../lib/research-invitation";

export async function GET(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  return Response.json(await getResearchInvitationContent(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  return Response.json(await saveResearchInvitationContent(await request.json().catch(() => null)));
}
