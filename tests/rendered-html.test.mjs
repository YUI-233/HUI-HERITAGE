import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("homepage contains the real catalogue entry points", async () => {
  const page = await readFile(new URL("app/page.tsx", projectRoot), "utf8");
  assert.match(page, /HUI HERITAGE/);
  assert.match(page, /action="\/catalog"/);
  assert.match(page, /name="q"/);
  assert.match(page, /getCatalogOverview/);
  assert.match(page, /listCatalogRecords/);
  assert.match(page, /href="\/about"/);
  assert.match(page, /className="account">\{viewer && <NotificationBell\/>\}<a href=\{viewer \? "\/account" : "\/login"\}/);
  assert.match(page, /href="\/personal-collection"/);
  assert.match(page, /href="\/holdings"/);
  assert.match(page, /href=\{`\/catalog\/\$\{record\.id\}`\}/);
  assert.match(page, /古籍图片仅会员可见/);
  assert.match(page, /getHeroContent/);
  assert.match(page, /--hero-desktop-image/);
});

test("hero content management validates local uploads and does not expose the admin token", async () => {
  const [hero, contentApi, uploadApi, editor, adminPage, migration] = await Promise.all([
    readFile(new URL("lib/hero-content.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/site/hero/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/hero-image/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/admin/hero/hero-editor.tsx", projectRoot), "utf8"),
    readFile(new URL("app/admin/hero/page.tsx", projectRoot), "utf8"),
    readFile(new URL("prisma/migrations/202607120005_add_site_settings/migration.sql", projectRoot), "utf8"),
  ]);
  assert.match(hero, /siteSetting\.upsert/);
  assert.match(hero, /validateHeroContent/);
  assert.match(contentApi, /requireSystemAdmin/);
  assert.match(uploadApi, /maxUploadBytes/);
  assert.match(uploadApi, /image\/webp/);
  assert.match(adminPage, /2400 × 1200/);
  assert.doesNotMatch(editor, /ADMIN_LOCAL_TOKEN=/);
  assert.match(migration, /CREATE TABLE "site_settings"/);
});

test("local super admin can create and edit catalogue metadata while keeping manuscript images restricted", async () => {
  const [adminRepo, catalogApi, imageApi, editor] = await Promise.all([
    readFile(new URL("lib/admin-catalog.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/catalog/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/catalog-image/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/admin/catalog/catalog-editor.tsx", projectRoot), "utf8"),
  ]);
  assert.match(adminRepo, /prisma\.book\.create/);
  assert.match(adminRepo, /prisma\.artifact\.create/);
  assert.match(adminRepo, /ADMIN_UPDATED/);
  assert.match(catalogApi, /requirePermission/);
  assert.match(imageApi, /MEMBER_ONLY/);
  assert.match(imageApi, /private\/manuscripts/);
  assert.match(imageApi, /visibility: isBook \? "MEMBER_ONLY" : "PUBLIC"/);
  assert.match(editor, /发布状态/);
  assert.match(editor, /主题词/);
  const mediaApi = await readFile(new URL("app/api/admin/catalog-media/route.ts", projectRoot), "utf8");
  assert.match(mediaApi, /mediaAsset\.findMany/);
  assert.match(mediaApi, /mediaAsset\.delete/);
  assert.match(editor, /api\/admin\/catalog-media/);
  assert.match(editor, /multiple/);
  assert.match(editor, /图片管理/);
});

test("local accounts support signed-in login, groups, permissions, and peer review", async () => {
  const [schema, login, register, usersApi, manager, auth, loginPage, loginCss, userAdmin] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", projectRoot), "utf8"),
    readFile(new URL("app/api/auth/login/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/auth/register/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/users/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/admin/users/user-manager.tsx", projectRoot), "utf8"),
    readFile(new URL("lib/local-auth.ts", projectRoot), "utf8"),
    readFile(new URL("app/login/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/login/login.css", projectRoot), "utf8"),
    readFile(new URL("lib/user-admin.ts", projectRoot), "utf8"),
  ]);
  assert.match(schema, /model UserGroup/);
  assert.match(schema, /passwordHash/);
  assert.match(login, /verifyPassword/);
  assert.match(login, /ensureSystemAdmin/);
  assert.match(register, /registerPublicUser/);
  assert.match(login, /createSessionCookie/);
  assert.match(usersApi, /createUserGroup/);
  assert.match(usersApi, /saveUser/);
  assert.match(usersApi, /assignGroupByEmail/);
  assert.match(manager, /按注册邮箱授权/);
  assert.doesNotMatch(manager, /本地管理员口令/);
  assert.match(manager, /审核其他用户提交的资料/);
  assert.doesNotMatch(manager, /固定 A/);
  assert.match(auth, /HttpOnly/);
  assert.match(loginPage, /login\.css/);
  assert.match(loginCss, /\.login-form input/);
  assert.match(loginCss, /min-height:46px/);
  assert.match(userAdmin, /ACCOUNT_AUTHORIZATION/);
  assert.match(userAdmin, /账号授权已生效/);
  assert.match(userAdmin, /notifyUsers/);
});

test("account access is separated from the personal collection entrance", async () => {
  const [loginForm, accountPage, accountActions, homepage, personalCollection, collectionWorkspace] = await Promise.all([
    readFile(new URL("app/login/login-form.tsx", projectRoot), "utf8"),
    readFile(new URL("app/account/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/account/account-actions.tsx", projectRoot), "utf8"),
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/personal-collection/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/personal-collection/personal-collection-workspace.tsx", projectRoot), "utf8"),
  ]);
  assert.match(loginForm, /window\.location\.assign\("\/account"\)/);
  assert.doesNotMatch(loginForm, /body\.user\?\.role/);
  assert.match(accountPage, /getSignedInUser/);
  assert.match(accountPage, /redirect\("\/login"\)/);
  assert.match(accountPage, /会员图片访问/);
  assert.match(accountPage, /审核资格/);
  assert.match(accountPage, /admin\/catalog-review/);
  assert.match(accountPage, /admin\/review/);
  assert.match(accountPage, /系统 Admin/);
  assert.match(accountActions, /api\/auth\/logout/);
  assert.match(homepage, /viewer \? "\/account" : "\/login"/);
  assert.match(homepage, /href="\/personal-collection"/);
  assert.match(personalCollection, /studyName/);
  assert.doesNotMatch(personalCollection, /studyName\}的个人书斋/);
  assert.match(collectionWorkspace, /我的书架/);
  assert.match(collectionWorkspace, /我的藏品/);
  assert.match(collectionWorkspace, /书籍管理/);
  assert.match(collectionWorkspace, /藏品管理/);
  assert.match(collectionWorkspace, /useState<Section>\("shelf"\)/);
  assert.match(personalCollection, /redirect\("\/login"\)/);
});

test("personal collection keeps user-owned books and artifacts separate from public holdings", async () => {
  const [schema, repository, itemsRoute, importRoute, templateRoute, workspace, collectionCss] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", projectRoot), "utf8"),
    readFile(new URL("lib/personal-collection.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/personal-collection/items/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/personal-collection/items/import/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/personal-collection/template/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/personal-collection/personal-collection-workspace.tsx", projectRoot), "utf8"),
    readFile(new URL("app/personal-collection/personal-collection.css", projectRoot), "utf8"),
  ]);
  assert.match(schema, /model PersonalCollectionItem/);
  assert.match(schema, /ownerId/);
  assert.match(repository, /createPersonalItem/);
  assert.match(repository, /updatePersonalItem/);
  assert.match(repository, /deletePersonalItem/);
  assert.match(repository, /parsePersonalCollectionCsv/);
  assert.match(itemsRoute, /getSignedInUser/);
  assert.match(itemsRoute, /export async function PATCH/);
  assert.match(itemsRoute, /export async function DELETE/);
  assert.match(importRoute, /getSignedInUser/);
  assert.match(templateRoute, /csvDocument/);
  assert.match(templateRoute, /personal-collection-template/);
  assert.match(workspace, /新增\{label\}/);
  assert.match(workspace, /type="BOOK"/);
  assert.match(workspace, /type="ARTIFACT"/);
  assert.match(workspace, /批量导入/);
  assert.match(workspace, /book-spine/);
  assert.match(workspace, /shelfGroups/);
  assert.match(workspace, /shelfGroupId/);
  assert.match(workspace, /shelf-row-books/);
  assert.match(workspace, /book-spine-label/);
  assert.match(workspace, /book-case-volumes/);
  assert.match(workspace, /BookManagementTable/);
  assert.match(workspace, /book-management-table/);
  assert.match(workspace, /compact-book-table/);
  assert.match(workspace, /queueSave/);
  assert.match(workspace, /management-back-button/);
  assert.match(workspace, /manuscriptCategoryGroups/);
  assert.match(workspace, /book-delete-button/);
  assert.match(workspace, /book-row-images/);
  assert.match(workspace, /PersonalBookDetail/);
  assert.match(workspace, /个人收藏 · 书籍详情/);
  assert.match(workspace, /可先选择，保存时自动上传/);
  assert.match(workspace, /personal-entry-heading/);
  assert.match(workspace, /book-entry-panel/);
  assert.match(workspace, /type !== "BOOK"/);
  assert.match(workspace, /book-title-category-row/);
  assert.match(workspace, /showCategories=\{false\}/);
  assert.match(collectionCss, /book-title-category-row\{display:grid!important/);
  assert.match(collectionCss, /grid-template-columns:1fr 1fr!important/);
  assert.match(collectionCss, /book-spine-title,.personal-collection-page \.book-spine-author\{white-space:nowrap/);
  assert.match(workspace, /book-spine-title-long/);
  assert.match(collectionCss, /book-spine-title-long\{max-height:124px;font-size:13px/);
  assert.match(collectionCss, /book-case-title small\{top:55%/);
  assert.match(workspace, /下载 Excel 模板/);
  assert.match(workspace, /下载 CSV 模板/);
  assert.match(workspace, /可直接上传 Excel/);
  assert.match(workspace, /artifact-examples/);
  assert.match(workspace, /最多 3 张/);
  assert.match(importRoute, /parseXlsxDocument/);
  await access(new URL("public/templates/个人书籍导入模板（分类下拉）.xlsx", projectRoot));
  assert.match(workspace, /deleteRow/);
  assert.match(workspace, /book\.volumeCount >= 3/);
  assert.match(workspace, /book\.binding\?\.includes\("线装"\)/);
  assert.match(workspace, /~\$\{serialFor/);
  assert.match(workspace, /categoryAliases/);
  assert.match(workspace, /shelf-category-sign/);
  assert.match(workspace, /\{group\.books\.length\} 种<br\/>\{group\.volumes\} 册/);
  assert.match(workspace, /共 \{books\.length\} 种／\{totalVolumes\} 册/);
});

test("public catalogue books and personal books share the compact manuscript metadata form", async () => {
  const [sharedFields, catalogEditor, personalWorkspace, publicPersonalDetail, personalTemplate, catalogTemplate, schema, migration] = await Promise.all([
    readFile(new URL("app/components/manuscript-metadata-fields.tsx", projectRoot), "utf8"),
    readFile(new URL("app/admin/catalog/catalog-editor.tsx", projectRoot), "utf8"),
    readFile(new URL("app/personal-collection/personal-collection-workspace.tsx", projectRoot), "utf8"),
    readFile(new URL("app/personal-collection/public/[id]/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/personal-collection/template/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/catalog/template/route.ts", projectRoot), "utf8"),
    readFile(new URL("prisma/schema.prisma", projectRoot), "utf8"),
    readFile(new URL("prisma/migrations/202607140003_add_personal_book_bibliographic_metadata/migration.sql", projectRoot), "utf8"),
  ]);
  assert.match(sharedFields, /ManuscriptMetadataFields/);
  assert.match(sharedFields, /<select/);
  assert.match(sharedFields, /刊刻年份/);
  assert.match(sharedFields, /刊刻主体/);
  assert.match(sharedFields, /添加分类/);
  assert.match(sharedFields, /value\.categories/);
  assert.match(catalogEditor, /ManuscriptMetadataFields/);
  assert.match(personalWorkspace, /ManuscriptMetadataFields/);
  assert.match(personalWorkspace, /<th>刊刻年份<\/th>/);
  assert.match(personalWorkspace, /<th>刊刻主体<\/th>/);
  assert.match(publicPersonalDetail, /\["刊刻年份", item\.eraDetail \|\| "未填写"\]/);
  assert.match(publicPersonalDetail, /\["刊刻主体", item\.imprintPublisher \|\| "未填写"\]/);
  assert.match(personalTemplate, /刊刻年份/);
  assert.match(catalogTemplate, /刊刻主体/);
  assert.match(schema, /model PersonalCollectionItem/);
  assert.match(schema, /categories\s+String\[\]/);
  assert.match(migration, /ADD COLUMN "categories" TEXT\[\]/);
});

test("admin APIs enforce server-side user-group permissions with a local bootstrap fallback", async () => {
  const [access, auth, catalog, holdings, research, hero, personalImport, media] = await Promise.all([
    readFile(new URL("lib/admin-access.ts", projectRoot), "utf8"),
    readFile(new URL("lib/local-auth.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/catalog/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/holdings/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/research/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/site/hero/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/personal-holdings-import/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/catalog-media/route.ts", projectRoot), "utf8"),
  ]);
  assert.match(auth, /hasUserPermission/);
  assert.match(access, /hasLocalAdminAccess/);
  assert.match(access, /当前账号没有执行此操作的权限/);
  assert.match(catalog, /requirePermission\(request, "CATALOG_WRITE"\)/);
  assert.match(holdings, /requirePermission\(request, "HOLDING_WRITE"\)/);
  assert.match(personalImport, /requirePermission\(request, "PERSONAL_COLLECTION"\)/);
  assert.match(media, /requirePermission\(request, "CATALOG_WRITE"\)/);
  assert.match(research, /requireSystemAdmin/);
  assert.match(hero, /requireSystemAdmin/);
});

test("local super admin can maintain holdings and research records", async () => {
  const [holdingsApi, researchApi, holdingsEditor, researchEditor] = await Promise.all([
    readFile(new URL("app/api/admin/holdings/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/research/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/admin/holdings/holdings-editor.tsx", projectRoot), "utf8"),
    readFile(new URL("app/admin/research/research-editor.tsx", projectRoot), "utf8"),
  ]);
  assert.match(holdingsApi, /requirePermission/);
  assert.match(holdingsApi, /saveAdminHolding/);
  assert.match(researchApi, /saveAdminResearch/);
  assert.match(holdingsEditor, /收藏机构/);
  assert.match(holdingsEditor, /来源类型/);
  assert.match(holdingsEditor, /编辑已有馆藏/);
  assert.match(holdingsEditor, /新建馆藏记录/);
  assert.match(holdingsEditor, /选择需要编辑的馆藏/);
  assert.doesNotMatch(holdingsEditor, /关联资料类型/);
  assert.doesNotMatch(holdingsEditor, /关联资料编号/);
  assert.doesNotMatch(holdingsEditor, /馆藏维护说明/);
  assert.match(holdingsEditor, /申请删除这条馆藏/);
  assert.match(researchEditor, /研究分类/);
  assert.match(researchEditor, /关联馆藏编号/);
});

test("CSV import distinguishes staged institutional data from directly submitted personal collections", async () => {
  const [parser, preview, apiRoute, importRoute, importer, templateRoute, editor, page] = await Promise.all([
    readFile(new URL("lib/csv.ts", projectRoot), "utf8"),
    readFile(new URL("lib/catalog-import-preview.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/import-preview/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/personal-holdings-import/route.ts", projectRoot), "utf8"),
    readFile(new URL("lib/personal-holdings-import.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/import-templates/[kind]/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/admin/holdings/holdings-import-previewer.tsx", projectRoot), "utf8"),
    readFile(new URL("app/admin/holdings/page.tsx", projectRoot), "utf8"),
  ]);
  assert.match(parser, /parseCsvDocument/);
  assert.match(preview, /未识别 CSV 模板/);
  assert.match(preview, /收藏机构不能为空/);
  assert.match(preview, /personalHoldingHeaders/);
  assert.match(preview, /parsePersonalHoldingImport/);
  assert.match(apiRoute, /hasLocalAdminAccess/);
  assert.doesNotMatch(apiRoute, /prisma\./);
  assert.match(importRoute, /requirePermission/);
  assert.match(importer, /origin: "PERSONAL"/);
  assert.match(importer, /status: row\.status/);
  assert.match(templateRoute, /个人馆藏导入模板/);
  assert.match(templateRoute, /csvDocument/);
  assert.match(editor, /国内馆藏/);
  assert.match(editor, /海外馆藏/);
  assert.match(editor, /图片1、图片2可填写公开可访问的图片网址/);
  assert.match(editor, /确认导入个人馆藏/);
  assert.match(editor, /下载校验问题/);
  assert.match(editor, /馆藏导入校验问题\.csv/);
  assert.match(page, /HoldingsImportPreviewer/);
  assert.match(page, /import-templates\/personal/);
  assert.match(page, /admin\/review/);
});

test("institutional CSV batches use peer review before approved records are written", async () => {
  const [schema, workflow, batchesApi, detailApi, exportApi, reviewApi, page, client] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", projectRoot), "utf8"),
    readFile(new URL("lib/import-review-workflow.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/import-batches/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/import-batches/[id]/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/import-batches/[id]/export/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/import-batches/[id]/review/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/admin/review/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/admin/review/review-client.tsx", projectRoot), "utf8"),
  ]);
  assert.match(schema, /model ImportBatch/);
  assert.match(schema, /model ImportBatchRecord/);
  assert.match(workflow, /submittedByUserId === reviewedByUserId/);
  assert.match(workflow, /legacyWorkflowLane/);
  assert.match(workflow, /applyHoldingRows/);
  assert.match(workflow, /applyOverseasRows/);
  assert.match(workflow, /resubmitImportBatch/);
  assert.match(workflow, /getImportBatchPreview/);
  assert.match(workflow, /reviewImportBatchRecord/);
  assert.match(workflow, /batchId_rowIndex/);
  assert.match(workflow, /detailRows/);
  assert.match(workflow, /HOLDING_IMPORT_REVIEW/);
  assert.match(workflow, /countPendingImportBatchesForReviewer/);
  assert.match(workflow, /findDuplicateCandidates/);
  assert.match(workflow, /findMissingReferenceCandidates/);
  assert.match(workflow, /importBatchEvent\.create/);
  assert.match(batchesApi, /createImportBatch/);
  assert.match(detailApi, /getImportBatchPreview/);
  assert.match(exportApi, /getImportBatchAuditReport/);
  assert.match(reviewApi, /reviewImportBatch/);
  assert.match(reviewApi, /rowIndex/);
  assert.match(reviewApi, /signedInWorkflowActor/);
  assert.match(page, /拥有馆藏审核权限的用户可审核其他账号提交的批量资料/);
  assert.match(client, /通过并写入/);
  assert.match(client, /重新提交/);
  assert.match(client, /资料清单/);
  assert.match(client, /review-record-browser/);
  assert.match(client, /打开链接/);
  const [notifications, adminHeader, account] = await Promise.all([
    readFile(new URL("lib/notifications.ts", projectRoot), "utf8"),
    readFile(new URL("app/admin/admin-header.tsx", projectRoot), "utf8"),
    readFile(new URL("app/account/page.tsx", projectRoot), "utf8"),
  ]);
  assert.match(notifications, /holdingReviewers/);
  assert.match(adminHeader, /nav-notification-count/);
  assert.match(account, /pendingHoldingReviews/);
  const auditButton = await readFile(new URL("app/admin/review/audit-export-button.tsx", projectRoot), "utf8");
  assert.match(auditButton, /import-batches\/\$\{id\}\/export/);
  assert.match(auditButton, /下载审核记录/);
});

test("catalogue records use an identity-based peer review workflow", async () => {
  const [schema, workflow, catalogRoute, reviewRoute, migration] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", projectRoot), "utf8"),
    readFile(new URL("lib/admin-catalog.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/catalog/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/catalog-review/route.ts", projectRoot), "utf8"),
    readFile(new URL("prisma/migrations/202607130010_add_catalog_review_workflow/migration.sql", projectRoot), "utf8"),
  ]);
  assert.match(schema, /submittedBooks/);
  assert.match(workflow, /reviewAdminCatalog/);
  assert.match(workflow, /submittedByUserId === reviewer\.userId/);
  assert.doesNotMatch(workflow, /reviewer\.lane/);
  assert.match(catalogRoute, /signedInCatalogWorkflowActor/);
  assert.match(reviewRoute, /CATALOG_REVIEW/);
  assert.match(migration, /books_status_submitted_by_lane_idx/);
});

test("catalogue peer review has a usable administrator review desk", async () => {
  const [page, desk] = await Promise.all([
    readFile(new URL("app/admin/catalog-review/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/admin/catalog-review/review-desk.tsx", projectRoot), "utf8"),
  ]);
  assert.match(page, /拥有审核权限的用户可审核其他用户提交的资料/);
  assert.match(desk, /api\/admin\/catalog-review/);
  assert.match(desk, /通过并公开/);
  assert.match(desk, /无需手动选择岗位/);
});

test("about page explains collection access and research use", async () => {
  const about = await readFile(new URL("app/about/page.tsx", projectRoot), "utf8");
  assert.match(about, /收录原则/);
  assert.match(about, /公开与受限并存/);
  assert.match(about, /进入馆藏检索/);
});

test("research pages read approved research paths and lead back to linked catalogue records", async () => {
  const [research, detail, repository, apiRoute, migration] = await Promise.all([
    readFile(new URL("app/research/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/research/[id]/page.tsx", projectRoot), "utf8"),
    readFile(new URL("lib/research-repository.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/research/route.ts", projectRoot), "utf8"),
    readFile(new URL("prisma/migrations/202607120004_add_research_articles/migration.sql", projectRoot), "utf8"),
  ]);
  assert.match(research, /从馆藏线索进入研究/);
  assert.match(research, /listResearchArticles/);
  assert.match(research, /研究分类筛选/);
  assert.match(detail, /getResearchArticle/);
  assert.match(detail, /getCatalogRecord/);
  assert.match(repository, /prisma\.researchArticle\.findMany/);
  assert.match(repository, /status: "APPROVED"/);
  assert.match(apiRoute, /Cache-Control/);
  assert.match(migration, /CREATE TABLE "research_articles"/);
});

test("catalogue supports search, detail pages, and access labels", async () => {
  const [catalogue, detail, records, repository] = await Promise.all([
    readFile(new URL("app/catalog/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/catalog/[id]/page.tsx", projectRoot), "utf8"),
    readFile(new URL("lib/catalog.ts", projectRoot), "utf8"),
    readFile(new URL("lib/catalog-repository.ts", projectRoot), "utf8"),
  ]);
  assert.match(catalogue, /资料类型筛选/);
  assert.match(catalogue, /收藏来源筛选/);
  assert.match(catalogue, /清除筛选/);
  assert.match(catalogue, /馆藏分页/);
  assert.match(catalogue, /\/catalog\/\$\{record\.id\}/);
  assert.match(detail, /图片访问受限/);
  assert.match(detail, /ImageGallery/);
  assert.match(detail, /record\.metadata/);
  assert.match(detail, /const isMemberImage = record\.imageAccess === "member"/);
  assert.match(detail, /关联资料/);
  assert.match(detail, /同类资料导航/);
  assert.match(detail, /previousRecord/);
  assert.match(detail, /encodeURIComponent\(keyword\)/);
  assert.match(detail, /下载引用信息/);
  assert.match(records, /searchCatalog/);
  assert.match(records, /terms\.every/);
  assert.match(records, /qingzhen-shiyi/);
  assert.match(repository, /listCatalogRecords/);
  assert.match(repository, /source\?: string/);
  assert.match(repository, /findCatalogRecords/);
  assert.match(repository, /版本类型/);
  assert.match(repository, /材质/);
});

test("catalogue pages read through the future database boundary", async () => {
  const repository = await readFile(new URL("lib/catalog-repository.ts", projectRoot), "utf8");
  assert.match(repository, /getCatalogRecord/);
  assert.match(repository, /getCatalogOverview/);
  assert.match(repository, /prisma\.book\.findMany/);
  assert.match(repository, /prisma\.artifact\.findMany/);
  assert.match(repository, /metadata:/);
});

test("public catalogue API removes member-only original image paths", async () => {
  const [apiRoute, memberMedia] = await Promise.all([readFile(new URL("app/api/catalog/route.ts", projectRoot), "utf8"), readFile(new URL("app/api/catalog/[id]/member-media/[mediaId]/route.ts", projectRoot), "utf8")]);
  const publicMapper = await readFile(new URL("lib/public-catalog.ts", projectRoot), "utf8");
  assert.match(apiRoute, /findCatalogRecords/);
  assert.match(apiRoute, /toPublicCatalogRecord/);
  assert.match(apiRoute, /Cache-Control/);
  assert.match(publicMapper, /record\.imageAccess === "public" \? record\.image : null/);
  assert.match(publicMapper, /record\.imageAccess === "public" \? record\.images/);
  assert.doesNotMatch(publicMapper, /memberImages/);
  assert.match(memberMedia, /getSignedInUser/);
  assert.match(memberMedia, /MEMBER_ONLY/);
  assert.match(memberMedia, /private, no-store/);
});

test("single-record catalogue API handles existing and missing records", async () => {
  const detailApiRoute = await readFile(new URL("app/api/catalog/[id]/route.ts", projectRoot), "utf8");
  assert.match(detailApiRoute, /getCatalogRecord/);
  assert.match(detailApiRoute, /NOT_FOUND/);
  assert.match(detailApiRoute, /toPublicCatalogRecord/);
});

test("citation API exports only catalogue metadata", async () => {
  const citationApiRoute = await readFile(new URL("app/api/catalog/[id]/citation/route.ts", projectRoot), "utf8");
  assert.match(citationApiRoute, /Content-Disposition/);
  assert.match(citationApiRoute, /收藏来源/);
  assert.doesNotMatch(citationApiRoute, /storage_key/);
});

test("public data exports use CSV and exclude private manuscript paths", async () => {
  const [route, csv, page] = await Promise.all([
    readFile(new URL("app/api/export/[dataset]/route.ts", projectRoot), "utf8"),
    readFile(new URL("lib/csv.ts", projectRoot), "utf8"),
    readFile(new URL("app/data/page.tsx", projectRoot), "utf8"),
  ]);
  assert.match(route, /listCatalogRecords/);
  assert.match(route, /listHoldings/);
  assert.match(route, /listResearchArticles/);
  assert.match(route, /Content-Disposition/);
  assert.doesNotMatch(route, /storageKey|storage_key|private\/manuscripts/);
  assert.match(csv, /replaceAll/);
  assert.match(page, /古籍受限图片/);
});

test("Prisma migration preserves the catalogue and review data model", async () => {
  const migration = await readFile(new URL("prisma/migrations/202607120001_initial_catalogue/migration.sql", projectRoot), "utf8");
  assert.match(migration, /CREATE TABLE "books"/);
  assert.match(migration, /CREATE TABLE "artifacts"/);
  assert.match(migration, /CREATE TABLE "media_assets"/);
  assert.match(migration, /CREATE TABLE "audit_events"/);
  assert.match(migration, /CREATE VIEW "review_queue"/);
  assert.match(migration, /CREATE FUNCTION "search_catalog"/);
  assert.match(migration, /CREATE FUNCTION "audit_review_status_change"/);
});

test("public holdings can be filtered without exposing private collection data", async () => {
  const [repository, apiRoute, page, migration] = await Promise.all([
    readFile(new URL("lib/holdings-repository.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/holdings/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/holdings/page.tsx", projectRoot), "utf8"),
    readFile(new URL("prisma/migrations/202607120003_add_holdings/migration.sql", projectRoot), "utf8"),
  ]);
  assert.match(repository, /prisma\.holding\.findMany/);
  assert.match(repository, /normalizePersonalHolding/);
  assert.match(repository, /isPublic: true/);
  assert.match(repository, /status: "APPROVED"/);
  assert.match(repository, /isHoldingOrigin/);
  assert.match(repository, /listHoldingsForCatalogRecord/);
  assert.match(apiRoute, /listHoldings/);
  assert.match(apiRoute, /Cache-Control/);
  assert.match(page, /国内馆藏/);
  assert.match(page, /海外馆藏/);
  assert.match(page, /个人公开收藏/);
  assert.match(migration, /CREATE TABLE "holdings"/);
  assert.match(migration, /holding_owner_check/);
});

test("catalogue detail pages show approved holding provenance for the current record", async () => {
  const [detail, holdings] = await Promise.all([
    readFile(new URL("app/catalog/[id]/page.tsx", projectRoot), "utf8"),
    readFile(new URL("lib/holdings-repository.ts", projectRoot), "utf8"),
  ]);
  assert.match(detail, /listHoldingsForCatalogRecord/);
  assert.match(detail, /相关馆藏记录/);
  assert.match(detail, /馆方目录/);
  assert.match(holdings, /status: "APPROVED"/);
  assert.match(holdings, /bookId: recordId/);
});

test("official holdings accept the latest overseas Excel header and offer book and library browse views", async () => {
  const [preview, importApi, holdingsPage, holdingsDetail, importUi, migration] = await Promise.all([
    readFile(new URL("lib/catalog-import-preview.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/import-preview/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/holdings/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/holdings/[id]/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/admin/holdings/holdings-import-previewer.tsx", projectRoot), "utf8"),
    readFile(new URL("prisma/migrations/202607160001_allow_latest_holding_import_batches/migration.sql", projectRoot), "utf8"),
  ]);
  assert.match(preview, /"国家"/);
  assert.match(preview, /"備註"/);
  assert.match(importApi, /readOfficialImportFile/);
  assert.match(importUi, /Excel 与 CSV/);
  assert.match(importUi, /国家／馆藏国家/);
  assert.match(holdingsPage, /按书名浏览/);
  assert.match(holdingsPage, /按图书馆浏览/);
  assert.match(holdingsPage, /\/holdings\/\$\{holding\.record\.id\}/);
  assert.match(holdingsDetail, /书目信息/);
  assert.match(holdingsDetail, /馆藏分布/);
  assert.match(holdingsDetail, /打开馆方目录/);
  assert.match(migration, /overseas_latest/);
});

test("member-only manuscript originals are kept outside the public image directory", async () => {
  const privateOriginal = new URL("uploads/private/manuscripts/qingzhen-shiyi-1836.jpg", projectRoot);
  const publicOriginal = new URL("public/collection/qingzhen-shiyi-1836.jpg", projectRoot);
  await access(privateOriginal);
  await assert.rejects(access(publicOriginal));
});

test("personal collection publication uses peer review, notifications, and automatic publication after approval", async () => {
  const [schema, repository, publicationRoute, batchPublicationRoute, queueRoute, reviewMediaRoute, publicRoute, publicMediaRoute, workspace, reviewDesk, migration, notificationMigration, notificationRoute, notificationBell] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", projectRoot), "utf8"),
    readFile(new URL("lib/personal-collection.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/personal-collection/items/[id]/publication/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/personal-collection/items/publication/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/personal-submissions/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/admin/personal-submissions/[id]/media/[mediaId]/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/personal-collection/public/[id]/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/api/personal-collection/public/[id]/media/[mediaId]/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/personal-collection/personal-collection-workspace.tsx", projectRoot), "utf8"),
    readFile(new URL("app/admin/personal-review/personal-review-desk.tsx", projectRoot), "utf8"),
    readFile(new URL("prisma/migrations/202607150003_add_personal_collection_publication_workflow/migration.sql", projectRoot), "utf8"),
    readFile(new URL("prisma/migrations/202607150004_add_user_notifications/migration.sql", projectRoot), "utf8"),
    readFile(new URL("app/api/notifications/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/notification-bell.tsx", projectRoot), "utf8"),
  ]);
  assert.match(schema, /isPublic\s+Boolean/);
  assert.match(schema, /reviewedByUserId/);
  assert.match(repository, /submitPersonalItem/);
  assert.match(repository, /submitPersonalBooks/);
  assert.match(repository, /请最少上传一张图片/);
  assert.match(repository, /skippedWithoutImage/);
  assert.match(repository, /withdrawPersonalItem/);
  assert.match(repository, /setPersonalItemPublic/);
  assert.match(repository, /p\.owner_id <> \$\{reviewerId\}/);
  assert.match(publicationRoute, /SET_PRIVATE/);
  assert.match(publicationRoute, /WITHDRAW/);
  assert.match(batchPublicationRoute, /APPLY_BOOKS/);
  assert.match(queueRoute, /CATALOG_REVIEW/);
  assert.match(reviewMediaRoute, /CATALOG_REVIEW/);
  assert.match(reviewMediaRoute, /status: "PENDING"/);
  assert.match(publicRoute, /status: "APPROVED"/);
  assert.match(publicRoute, /isPublic: true/);
  assert.match(publicMediaRoute, /visibility: "PUBLIC"/);
  assert.match(workspace, /PublicationControls/);
  assert.match(workspace, /applyAllBooks/);
  assert.match(workspace, /book-apply-feedback/);
  assert.match(workspace, /void applyAllBooks\(\)/);
  assert.doesNotMatch(workspace, /已申请公开/);
  assert.match(workspace, /一键公开藏书/);
  assert.match(workspace, /APPLY_PUBLIC/);
  assert.match(workspace, /WITHDRAW/);
  assert.match(reviewDesk, /personal-review-content/);
  assert.match(migration, /is_public/);
  assert.match(migration, /reviewed_by_user_id/);
  assert.match(schema, /model Notification/);
  assert.match(repository, /notifyUsers/);
  assert.match(repository, /publicationReviewers/);
  assert.match(repository, /decision === "APPROVED"/);
  assert.match(notificationMigration, /notifications/);
  assert.match(notificationRoute, /READ_ALL/);
  assert.match(notificationBell, /系统通知/);
  assert.match(notificationBell, /pointerdown/);
  assert.match(notificationBell, /全部已读/);
});
