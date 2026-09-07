import { prisma } from "./prisma";
import { manuscriptCategoryTree, type ResourceCategoryNode } from "./manuscript-categories";

const scopes = ["MANUSCRIPT", "ARTIFACT", "RESEARCH"] as const;
export type CategoryScope = typeof scopes[number];

const text = (value: unknown, length: number) => typeof value === "string" ? value.trim().slice(0, length) : "";

export async function createCategoryRequest(body: Record<string, unknown>, userId: string) {
  const scope = text(body.scope, 30) as CategoryScope;
  const proposedName = text(body.proposedName, 100);
  const requestReason = text(body.requestReason, 1000);
  if (!scopes.includes(scope) || !proposedName || !requestReason) throw new Error("请完整填写分类体系、名称和申请理由。");
  const parentCategory = text(body.parentCategory, 100) || null;
  const duplicate = await prisma.categoryRequest.findFirst({ where: { scope, proposedName, parentCategory, submittedByUserId: userId, status: { in: ["DRAFT", "PENDING", "NEEDS_REVISION"] } } });
  if (duplicate) throw new Error("该分类已有一条待处理申请，请在下方查看审核状态。");
  return prisma.categoryRequest.create({ data: { scope, parentCategory, proposedName, description: text(body.description, 1000) || null, requestReason, sourceArea: text(body.sourceArea, 40) || "录入页面", sourceDraftId: text(body.sourceDraftId, 100) || null, submittedByUserId: userId } });
}

export async function listCategoryRequests(status?: string) {
  return prisma.categoryRequest.findMany({ where: status ? { status: status as never } : undefined, orderBy: { createdAt: "desc" } });
}

export async function listMyCategoryRequests(userId: string, scope?: string) {
  return prisma.categoryRequest.findMany({ where: { submittedByUserId: userId, ...(scope && scopes.includes(scope as CategoryScope) ? { scope } : {}) }, orderBy: { createdAt: "desc" } });
}

export async function listManagedCategories(scope?: string, includeInactive = false) {
  const flatten = (nodes: ResourceCategoryNode[], parentName: string | null = null): Array<{ scope: string; name: string; parentName: string | null; description?: string }> => nodes.flatMap((node) => [{ scope: "MANUSCRIPT", name: node.name, parentName, ...(node.note ? { description: node.note } : {}) }, ...flatten(node.children ?? [], node.name)]);
  await prisma.managedCategory.createMany({ data: flatten(manuscriptCategoryTree), skipDuplicates: true });
  const categories = await prisma.managedCategory.findMany({ where: { ...(scope && scopes.includes(scope as CategoryScope) ? { scope } : {}), ...(!includeInactive ? { isActive: true } : {}) }, orderBy: [{ scope: "asc" }, { parentName: "asc" }, { name: "asc" }] });
  return Promise.all(categories.map(async (category) => ({ ...category, usageCount: category.scope === "MANUSCRIPT" ? await prisma.book.count({ where: { categories: { has: category.name } } }) : category.scope === "ARTIFACT" ? await prisma.artifact.count({ where: { category: category.name } }) : await prisma.researchArticle.count({ where: { category: category.name } }) })));
}

export async function createManagedCategory(body: Record<string, unknown>) {
  const scope = text(body.scope, 30) as CategoryScope;
  const name = text(body.name, 100);
  if (!scopes.includes(scope) || !name) throw new Error("请填写分类体系和分类名称。");
  return prisma.managedCategory.create({ data: { scope, name, parentName: text(body.parentName, 100) || null, description: text(body.description, 1000) || null } });
}

export async function updateManagedCategory(id: string, body: Record<string, unknown>) {
  const data: { isActive?: boolean; mergedIntoId?: string | null; description?: string | null } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.description === "string") data.description = text(body.description, 1000) || null;
  if (typeof body.mergedIntoId === "string" || body.mergedIntoId === null) {
    data.mergedIntoId = body.mergedIntoId;
    if (typeof body.mergedIntoId === "string") {
      const [source, target] = await Promise.all([prisma.managedCategory.findUnique({ where: { id } }), prisma.managedCategory.findUnique({ where: { id: body.mergedIntoId } })]);
      if (!source || !target || source.scope !== target.scope || source.id === target.id) throw new Error("请选择同一分类体系中的有效合并目标。");
      if (source.scope === "MANUSCRIPT") { const books = await prisma.book.findMany({ where: { categories: { has: source.name } }, select: { id: true, categories: true } }); await Promise.all(books.map((book) => prisma.book.update({ where: { id: book.id }, data: { categories: [...new Set(book.categories.map((name) => name === source.name ? target.name : name))] } }))); }
      if (source.scope === "ARTIFACT") await prisma.artifact.updateMany({ where: { category: source.name }, data: { category: target.name } });
      if (source.scope === "RESEARCH") await prisma.researchArticle.updateMany({ where: { category: source.name }, data: { category: target.name } });
      data.isActive = false;
    }
  }
  if (!Object.keys(data).length) throw new Error("未提供可更新内容。");
  return prisma.managedCategory.update({ where: { id }, data });
}

export async function reviewCategoryRequest(id: string, decision: "APPROVED" | "REJECTED" | "NEEDS_REVISION", comment: string, userId: string) {
  if (!comment.trim() && decision !== "APPROVED") throw new Error("退回或驳回时必须填写审核意见。");
  const request = await prisma.categoryRequest.findUnique({ where: { id } });
  if (!request) throw new Error("未找到该分类申请。");
  if (decision === "APPROVED") await prisma.managedCategory.upsert({ where: { scope_name: { scope: request.scope, name: request.proposedName } }, create: { scope: request.scope, name: request.proposedName, parentName: request.parentCategory, description: request.description }, update: { isActive: true, parentName: request.parentCategory, description: request.description } });
  return prisma.categoryRequest.update({ where: { id }, data: { status: decision, reviewComment: comment.trim() || null, reviewedByUserId: userId, reviewedAt: new Date() } });
}
