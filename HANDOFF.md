# HUI HERITAGE 开发交接说明

更新日期：2026-07-20  
运行范围：本地开发与验收，**尚未发布公网**。

## 1. 产品定位

HUI HERITAGE 是一个面向汉文回教古籍、文物、馆藏记录与研究资料的中文数字化平台。V1 的核心是：录入、审核、展示、检索、在线阅读，以及个人收藏与研究资料关联。

技术栈：Next.js 16 App Router、React 19、TypeScript、PostgreSQL、Prisma；本地文件存储用于图片与受限 pdf。

## 2. 页面结构（产品地图）

### A. 公开／普通用户端

| 一级页面 | 二级／三级页面 | 当前功能 |
| --- | --- | --- |
| 首页 `/` | 古籍展览区、站点导航 | 展示已审核古籍；点击书名进入详情。 |
| 数字化遗产 `/catalog` | 筛选、古籍／文物切换、`/catalog/[id]` 详情 | 可按书名、分类、语言、作者、时间、刊刻机构筛选；展示已审核资料。 |
| 古籍／文物详情 `/catalog/[id]` | 在线阅读、引用信息、关联资料、上一条／下一条 | 显示馆藏系统编号、书目信息、图片、关联资料；会员读取受限 pdf。 |
| 在线阅读 | 由详情页“在线阅读”进入 | pdf 受会员会话保护；未登录或无文件会返回提示。 |
| 图书馆检索 `/holdings` | `/holdings/[id]`、编辑、删除申请 | 国内／海外／个人公开馆藏检索，支持书名、机构及表格浏览。 |
| 研究资料 `/research` | `/research/[id]` | 公开研究文章沉浸阅读；文章可关联多条古籍／文物。 |
| 账号中心 `/account` | 管理入口、权限入口 | 根据权限显示录入、审核、研究资料管理等入口。 |
| 个人收藏 `/personal-collection` | 书架、藏品、书籍管理、藏品管理、公开详情 | 独立于公共馆藏；可维护个人藏品和申请公开审核。 |

### B. 管理后台

| 一级页面 | 二级页面 | 当前功能 |
| --- | --- | --- |
| 古籍文物录入 `/admin/catalog` | 古籍／文物标签页 | 新建或编辑已审核资料；上传图片与 pdf；提交审核；申请删除。 |
| 古籍文物审核 `/admin/catalog-review` | 资料详情、附件查看、删除申请 | 通过公开、要求补充、退回；删除申请需要审核后正式删除。 |
| 馆藏数据管理 `/admin/holdings` | 编辑、导入预览、批次管理 | 公共馆藏数据维护、CSV／Excel 导入和审核工作流。 |
| 馆藏数据审核 `/admin/review` | 批次／逐条审核 | 审核导入或修改的馆藏记录。 |
| 研究资料编辑 `/admin/research` | 新建／编辑／删除申请 | 富文本粘贴编辑、草稿、提交审核、关联馆藏编号。 |
| 研究资料审核 `/admin/research-review` | 新增、修改、删除审核 | 审核通过、要求补充、退回；通过后影响前台公开内容。 |
| 用户与权限 `/admin/users` | 用户组、权限分配 | 包括研究资料编辑／审核权限。 |
| 个人馆藏审核 `/admin/personal-review` | 公开申请审核 | 审核个人收藏公开。 |

## 3. 已完成的核心能力

### 数字化古籍／文物

- 已取消“古籍图片仅会员可见”：已审核古籍和文物图片公开展示。
- 古籍与文物均可分别上传“图片”和“pdf”；图片为公开媒体，pdf 为会员在线阅读媒体。
- 文物录入的类别改为复用“藏品管理”的类别清单，并支持“＋ 新建类别…”。
- 目录列表只显示已审核资料；筛选为紧凑单行布局。
- 详情页统一为图片、固定两列元数据、关联资料、上一条／下一条的结构。
- 系统会为每条古籍／文物自动生成唯一馆藏编号：`HH-M-XXXXXX`（古籍）、`HH-A-XXXXXX`（文物）。该编号显示在详情页与录入编辑下拉框中，并可用于研究资料关联。

### 审核、权限与通知

- 录入、修改、删除均采用审核流程；申请人不能审核自己的提交。
- 通知铃铛与管理入口包含待审核数量提醒。
- Admin 用户组已补充研究资料编辑、研究资料审核权限。

### 研究资料

- 已拆分“研究资料编辑”和“研究资料审核”。
- 编辑端使用富文本编辑器，支持从 Word 粘贴基础富文本结构（标题、段落、表格等）；文章前台采用阅读版式。
- 研究资料可以填写多个关联馆藏编号；前台会展示关联古籍／文物。

## 4. 重要实现位置

| 目的 | 文件／目录 |
| --- | --- |
| 公共目录查询与详情聚合 | `lib/catalog-repository.ts`、`lib/public-catalog.ts`、`app/catalog/` |
| 古籍／文物录入 | `app/admin/catalog/catalog-editor.tsx`、`lib/admin-catalog.ts` |
| 媒体上传与受限 pdf | `app/api/admin/catalog-image/route.ts`、`app/api/catalog/[id]/member-media/[mediaId]/route.ts` |
| 古籍／文物审核 | `app/admin/catalog-review/`、`app/api/admin/catalog-review/` |
| 研究资料 | `app/admin/research/`、`app/admin/research-review/`、`app/research/`、`lib/admin-research.ts` |
| 用户、组与权限 | `app/admin/users/`、`lib/user-admin.ts`、`lib/local-auth.ts` |
| 数据库模型／迁移 | `prisma/schema.prisma`、`prisma/migrations/` |
| 本地上传文件 | `uploads/`（受限文件）、`public/collection/`（公开图片） |

## 5. 当前数据与文件交接

交付给下一位开发者时，必须给齐以下三项：

1. **源码压缩包**：不含密码、`node_modules`、构建缓存。
2. **数据库备份**：PostgreSQL 的 `.sql` 或自定义 `.backup` 文件；这是古籍、用户、权限、审核记录、研究资料的主体数据。
3. **上传文件备份**：整个 `uploads/` 目录；其中的私有 pdf 不在源码或公开目录中。公开图片位于 `public/collection/`，已随源码包保留。

不要把 `.env` 发到公开群组、代码仓库或邮件正文。应通过单独的受控渠道把数据库连接、管理员令牌等私密配置提供给接手人。

## 6. 新开发者启动步骤

1. 安装 Node.js 22+、PostgreSQL，并解压源码。
2. 在根目录复制 `.env.example` 为 `.env`，填写本机数据库连接与管理员配置。
3. 恢复 PostgreSQL 数据库备份，并将上传文件备份恢复为项目根目录的 `uploads/`。
4. 执行：

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run db:generate
& "C:\Program Files\nodejs\npm.cmd" run dev:postgres
```

5. 浏览器访问 `http://localhost:3014`。

常用检查：

```powershell
& "C:\Program Files\nodejs\npm.cmd" run build:postgres
& "C:\Program Files\nodejs\npm.cmd" run member-media:verify
& "C:\Program Files\nodejs\npm.cmd" run catalog-review:verify
```

## 7. 数据库迁移注意事项（非常重要）

当前本地数据库已包含项目实际使用的表和近期字段，但 Prisma 的迁移历史在此环境中**并非完整连续登记**。已观察到 `prisma migrate status` 报告大量历史迁移“未应用”。

因此，接手人首次连接现有数据库时：

- **不要直接执行 `prisma migrate deploy` 或 `prisma migrate reset`。** 这可能重复执行旧迁移或清空数据。
- 先备份数据库、执行 `prisma db pull`／核对 `prisma/schema.prisma`、确认 `_prisma_migrations` 状态后，再制定迁移基线方案。
- 新增的馆藏编号迁移位于：
  - `202607200001_add_catalog_numbers`
  - `202607200002_shorten_catalog_numbers`
  现有数据库已应用其结构和数据变更；编号格式为六码。

## 8. 建议优先复核的事项

1. 用 Admin、普通会员、录入人员、审核人员分别走一遍：新建资料 → 图片／pdf → 提交审核 → 审核通过 → 前台与在线阅读。
2. 检查研究资料富文本从 Word 粘贴时的复杂表格、图片、样式清理与安全过滤；当前是轻量富文本实现，若要完善可评估 CKEditor 5 / Tiptap，但需先确认许可证、打包体积及现有数据迁移。
3. 为数据库建立可重复的“基线迁移”策略，再继续新增 Prisma migration。
4. 增加端到端测试：权限、删除审核、pdf 会员访问、研究资料关联馆藏编号。
5. 本地上传目录未来应迁移至对象存储；迁移前需保持 `MediaAsset.storageKey` 的兼容层。

## 9. 交接验收清单

- [ ] 能启动 `http://localhost:3014`。
- [ ] Admin 可以登录并打开账号中心、录入、审核、研究资料管理。
- [ ] 古籍／文物图片在前台可见；登录会员可打开 pdf。
- [ ] 新建资料能生成 `HH-M-XXXXXX` 或 `HH-A-XXXXXX`。
- [ ] 研究资料可保存草稿、提交审核并在审核后前台显示。
- [ ] 铃铛及审核入口有待审核数量提示。
- [ ] 数据库备份和 `uploads/` 备份均已恢复并可访问。
