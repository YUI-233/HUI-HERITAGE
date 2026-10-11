import { getSignedInUser } from "../../../../../lib/local-auth";
import { getSignedInUser } from "../../../../../lib/local-auth";
import { listCoverOptions } from "../../../../../lib/personal-collection-profile";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "请先登录后再管理收藏馆。" }, { status: 401 });

  try {
    const items = await listCoverOptions(user.id);
    return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json(
      { code: "COVER_OPTIONS_READ_FAILED", message: error instanceof Error ? error.message : "无法读取可选封面。" },
      { status: 500 },
    );
  }
}

  }
}
