import { getSignedInUser } from "../../../../../../lib/local-auth";
import { CollectionExportError, exportPublicBooks } from "../../../../../../lib/collection-book-export";

export const dynamic = "force-dynamic";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** PC-03：导出其他收藏馆的公开书单（xlsx）。登录与借阅证资格一律由后端按当前会话校验。 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const format = (new URL(request.url).searchParams.get("format") || "xlsx").toString();
    const user = await getSignedInUser(request);
    const result = await exportPublicBooks({ slug, viewerId: user?.id ?? null, format });

    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof CollectionExportError) {
      return Response.json({ code: error.code, message: error.message }, { status: error.status });
    }
    return Response.json(
      { code: "EXPORT_FAILED", message: error instanceof Error ? error.message : "书单导出失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
