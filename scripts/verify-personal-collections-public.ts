import { prisma } from "../lib/prisma";

const baseUrl = process.env.PERSONAL_COLLECTIONS_VERIFY_URL ?? "http://localhost:3014";
const suffix = Date.now();

async function request(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, init);
}

async function registerAndLogin(email: string, displayName: string): Promise<string> {
  const password = "PersonalCollections!2026";
  const registration = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  if (!registration.ok) throw new Error(`Registration failed: ${registration.status}`);
  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!login.ok || !cookie) throw new Error("Login failed.");
  return cookie;
}

async function createItem(cookie: string, type: "BOOK" | "ARTIFACT", title: string): Promise<{ id: string }> {
  const created = await request("/api/personal-collection/items", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ type, title, creator: "验收作者", categories: ["1.1.1 古兰经翻译、注释"], description: "公开收藏馆验收数据。" }),
  });
  const item = (await created.json()) as { id?: string; message?: string };
  if (!created.ok || !item.id) throw new Error(`Item creation failed: ${JSON.stringify(item)}`);
  return { id: item.id };
}

async function uploadImage(cookie: string, itemId: string): Promise<string> {
  const imageForm = new FormData();
  imageForm.set("file", new File([new Uint8Array([137, 80, 78, 71])], "proof.png", { type: "image/png" }));
  const upload = await request(`/api/personal-collection/items/${itemId}/media`, {
    method: "POST",
    headers: { cookie },
    body: imageForm,
  });
  const media = (await upload.json()) as { id?: string };
  if (!upload.ok || !media.id) throw new Error(`Image upload failed: ${JSON.stringify(media)}`);
  return media.id;
}

async function applyPublic(cookie: string, itemId: string): Promise<void> {
  const res = await request(`/api/personal-collection/items/${itemId}/publication`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ action: "APPLY_PUBLIC" }),
  });
  if (!res.ok) throw new Error(`Apply public failed: ${await res.text()}`);
}

async function approve(reviewerCookie: string, itemId: string): Promise<void> {
  const res = await request("/api/admin/personal-submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: reviewerCookie },
    body: JSON.stringify({ id: itemId, decision: "APPROVED", comment: "验收通过" }),
  });
  if (!res.ok) throw new Error(`Approval failed: ${await res.text()}`);
}

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
  const authorEmail = `pc-author-${suffix}@example.local`;
  const reviewerEmail = `pc-reviewer-${suffix}@example.local`;
  const privateEmail = `pc-private-${suffix}@example.local`;
  let groupId = "";

  try {
    const authorCookie = await registerAndLogin(authorEmail, "公开馆藏验收作者");
    const reviewerCookie = await registerAndLogin(reviewerEmail, "公开馆藏验收审核员");
    const privateCookie = await registerAndLogin(privateEmail, "仅草稿用户");

    const group = await prisma.userGroup.create({ data: { name: `公开馆藏审核组 ${suffix}`, permissions: ["CATALOG_REVIEW"] } });
    groupId = group.id;
    await prisma.user.update({ where: { email: reviewerEmail }, data: { groupId } });

    // 作者发布一本书与一件藏品
    const book = await createItem(authorCookie, "BOOK", `公开验收藏书 ${suffix}`);
    await uploadImage(authorCookie, book.id);
    const artifact = await createItem(authorCookie, "ARTIFACT", `公开验收藏品 ${suffix}`);
    await uploadImage(authorCookie, artifact.id);
    await applyPublic(authorCookie, book.id);
    await applyPublic(authorCookie, artifact.id);
    await approve(reviewerCookie, book.id);
    await approve(reviewerCookie, artifact.id);

    // 仅草稿用户创建一条未公开记录（不应出现在公开目录）
    await createItem(privateCookie, "BOOK", `仅草稿 ${suffix}`);

    // 读取作者 slug
    const profile = (await (await request("/api/personal-collection/profile", { headers: { cookie: authorCookie } })).json()) as {
      slug: string;
    };
    assert(profile.slug, "profile slug 缺失");

    // 目录：应包含作者馆，不应包含仅草稿用户
    const dir = (await (await request("/api/personal-collections")).json()) as {
      items: Array<{ slug: string; bookCount: number; artifactCount: number; cover: unknown }>;
      pagination: { total: number };
    };
    const authorEntry = dir.items.find((e) => e.slug === profile.slug);
    assert(authorEntry, "目录未包含已公开作者收藏馆");
    assert(authorEntry!.bookCount >= 1 && authorEntry!.artifactCount >= 1, "目录统计数量不正确");
    assert(authorEntry!.cover, "目录封面为空");
    assert(!dir.items.some((e) => e.slug.includes(`pc-private-${suffix}`)), "仅草稿用户不应出现在目录");
    assert(dir.pagination.total >= 1, "目录总数不正确");

    // 单馆：按类型筛选
    const booksOnly = (await (await request(`/api/personal-collections/${profile.slug}?type=BOOK`)).json()) as {
      items: Array<{ type: string }>;
      collection: { name: string };
    };
    assert(booksOnly.items.every((i) => i.type === "BOOK"), "类型筛选未生效");
    assert(booksOnly.collection.name, "单馆名称缺失");

    const allItems = (await (await request(`/api/personal-collections/${profile.slug}`)).json()) as { items: Array<{ id: string }> };
    assert(allItems.items.length >= 2, "单馆全部内容数量不正确");

    // 不存在的 slug 返回 404
    const notFound = await request(`/api/personal-collections/non-existent-${suffix}`);
    assert(notFound.status === 404, `不存在的收藏馆应返回 404，实际 ${notFound.status}`);

    // 资料编辑：PATCH 名称
    const patched = (await (
      await request("/api/personal-collection/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: authorCookie },
        body: JSON.stringify({ displayName: "我的新收藏馆", description: "验收简介" }),
      })
    ).json()) as { displayName: string; description: string };
    assert(patched.displayName === "我的新收藏馆", "名称保存未生效");
    assert(patched.description === "验收简介", "简介保存未生效");

    // 名称长度校验：过短应 400
    const tooShort = await request("/api/personal-collection/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: authorCookie },
      body: JSON.stringify({ displayName: "x" }),
    });
    assert(tooShort.status === 400, `名称过短应 400，实际 ${tooShort.status}`);

    // 封面选项：仅返回本人公开图片
    const options = (await (await request("/api/personal-collection/profile/cover-options", { headers: { cookie: authorCookie } })).json()) as {
      items: Array<{ mediaId: string; itemId: string }>;
    };
    assert(options.items.length >= 1, "可选封面为空");

    // 设置封面
    const setCover = (await (
      await request("/api/personal-collection/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: authorCookie },
        body: JSON.stringify({ displayName: "我的新收藏馆", description: "验收简介", coverMediaId: options.items[0].mediaId }),
      })
    ).json()) as { cover: { mediaId: string } | null };
    assert(setCover.cover?.mediaId === options.items[0].mediaId, "封面设置未生效");

    // 目录应使用刚设置的封面
    const dirAfter = (await (await request("/api/personal-collections")).json()) as {
      items: Array<{ slug: string; cover: { mediaId: string } | null }>;
    };
    const entryAfter = dirAfter.items.find((e) => e.slug === profile.slug);
    assert(entryAfter?.cover?.mediaId === options.items[0].mediaId, "目录未使用已设置的封面");

    console.log("personal_collections_public_ok=directory-counts,cover,privacy-filter,type-filter,single-404,profile-patch,length-validation,cover-options,set-cover");
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [authorEmail, reviewerEmail, privateEmail] } } });
    if (groupId) await prisma.userGroup.delete({ where: { id: groupId } }).catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
