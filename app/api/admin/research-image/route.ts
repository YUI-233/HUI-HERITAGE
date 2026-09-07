import { requirePermission } from "../../../../lib/admin-access";
import { researchImageExtension, researchImageMaximumSize, storeResearchImage } from "../../../../lib/research-images";

export async function POST(request: Request) {
  const denied = await requirePermission(request, "RESEARCH_WRITE");
  if (denied) return denied;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !researchImageExtension(file.type) || file.size === 0 || file.size > researchImageMaximumSize) {
    return Response.json({ message: "请选择不超过 12 MB 的 JPG、PNG、WebP 或 GIF 图片。" }, { status: 400 });
  }
  const image = await storeResearchImage(await file.arrayBuffer(), file.type);
  return Response.json(image, { status: 201 });
}
