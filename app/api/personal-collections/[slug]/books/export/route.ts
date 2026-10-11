import { getSignedInUser } from "../../../../../../lib/local-auth";
import { BookExportError, exportPublicCollectionBooks } from "../../../../../../lib/personal-collection-book-export";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSignedInUser(request);
  if (!user) {
    return Response.json({ code: "AUTH_REQUIRED", message: "请先登录后导出公开书单。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("format") !== "xlsx") {
    return Response.json({ code: "UNSUPPORTED_EXPORT_FORMAT", message: "当前仅支持 XLSX 格式。" }, { status: 400 });
  }

  try {
    const { slug } = await params;
    const result = await exportPublicCollectionBooks(user.id, slug);
    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(result.filename),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof BookExportError) {
      return Response.json({ code: error.code, message: error.message }, { status: error.status });
    }
    return Response.json(
      { code: "EXPORT_FAILED", message: error instanceof Error ? error.message : "书单生成失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
