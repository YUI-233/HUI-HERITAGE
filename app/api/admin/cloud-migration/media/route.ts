import { requireSystemAdmin } from "../../../../../lib/admin-access";
import { cloudD1, cloudMedia, usesCloudRuntime } from "../../../../../lib/cloud-runtime";

type Manifest = { id: string; record_id: string; storage_key: string; mime_type: string; visibility: string; sort_order: number };

async function manifests() {
  const db = await cloudD1();
  const result = await db!.prepare("SELECT id, record_id, storage_key, mime_type, visibility, sort_order FROM cloud_media_assets ORDER BY sort_order, created_at").bind().all<Manifest>();
  return result.results ?? [];
}

export async function GET(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  if (!usesCloudRuntime()) return Response.json({ message: "媒体迁移状态仅在 GPT 正式站提供。" }, { status: 409 });
  const bucket = await cloudMedia();
  const rows = await manifests();
  const items = await Promise.all(rows.map(async (row) => ({ id: row.id, recordId: row.record_id, storageKey: row.storage_key, mimeType: row.mime_type, visibility: row.visibility, uploaded: Boolean(await bucket!.get(row.storage_key)) })));
  return Response.json({ total: items.length, uploaded: items.filter((item) => item.uploaded).length, items }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  if (!usesCloudRuntime()) return Response.json({ message: "媒体迁移仅在 GPT 正式站提供。" }, { status: 409 });
  const form = await request.formData();
  const mediaId = form.get("mediaId"); const file = form.get("file");
  if (typeof mediaId !== "string" || !(file instanceof File) || file.size === 0 || file.size > 85 * 1024 * 1024) return Response.json({ message: "请提供迁移清单中的媒体编号与不超过 85 MB 的文件。" }, { status: 400 });
  const row = (await manifests()).find((item) => item.id === mediaId);
  if (!row) return Response.json({ message: "该媒体不在本次正式迁移清单中。" }, { status: 404 });
  if (file.type && file.type !== row.mime_type) return Response.json({ message: "文件类型与迁移清单不一致。" }, { status: 400 });
  const bucket = await cloudMedia();
  await bucket!.put(row.storage_key, await file.arrayBuffer(), { httpMetadata: { contentType: row.mime_type } });
  return Response.json({ id: row.id, storageKey: row.storage_key, uploaded: true }, { status: 201 });
}
