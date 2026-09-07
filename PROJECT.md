# HUI HERITAGE 项目说明

> 面向后续 Codex 对话的长期项目基线。本文只记录已在现有代码、配置或已确认业务规则中出现的信息；不能确认的内容标为“待确认”。

## 1. 项目定位与目标

- HUI HERITAGE 是面向汉文回教古籍、文物及相关图像资料的中文数字整理与检索项目。
- V1 的核心目标是：录入、管理、审核、检索并展示数字化遗产与图书馆馆藏信息，同时支持个人收藏馆。
- 当前开发、验收范围为本地运行；未获得明确授权时不得发布到公网。
- 数字化遗产与图书馆检索是两套不同功能：
  - **数字化遗产**：展示已入库的古籍/文物及其媒体资料。
  - **图书馆检索**：检索国内、海外和个人公开收藏的馆藏记录。

## 2. 当前真实技术栈

- 前端与服务端：Next.js `16.2.6` App Router、React `19.2.6`、TypeScript `5.9.3`。
- 数据库：PostgreSQL；主要 ORM 为 Prisma `6.19.3`。
- 兼容层：仓库仍保留 Drizzle ORM、`db/` 中的旧结构和辅助代码；新增业务优先使用 Prisma。
- 样式：项目页面主要使用 CSS 文件；配置中同时存在 Tailwind CSS 依赖。
- 文件存储：V1 使用本地 `uploads/` 目录，上传目录由 `UPLOAD_DIR` 配置。
- 认证：本地账号认证；使用带 HMAC 签名的 `huiheritage_session` Cookie，当前会话有效期为 12 小时。
- 表格导入：CSV 与 Excel（`xlsx`）解析。
- 托管：存在 `.openai/hosting.json`，但当前仅作为 Sites 元数据保留，未纳入日常发布流程。

## 3. 本地配置与常用命令

- 必需环境变量位于本地 `.env`（不要提交密码或令牌）：
  - `DATABASE_URL`
  - `UPLOAD_DIR`
  - `SUPER_ADMIN_EMAIL`
  - `ADMIN_LOCAL_TOKEN`
- PowerShell 可能阻止 `npm.ps1`，应使用 `npm.cmd`：

```powershell
cd "C:\Users\minqi\Documents\Codex\2026-07-10\sites-plugin-sites-openai-bundled-3"
& "C:\Program Files\nodejs\npm.cmd" run dev:postgres
```

- PostgreSQL/Next 常用命令：

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:generate
& "C:\Program Files\nodejs\npm.cmd" run db:verify
& "C:\Program Files\nodejs\npm.cmd" run lint
& "C:\Program Files\nodejs\npm.cmd" run build:postgres
& "C:\Program Files\nodejs\npm.cmd" run start:postgres
```

- `dev:postgres` 使用 Next.js 并默认监听 `3014`；不带 `:postgres` 的 `dev/build/start` 属于 Vinext/Wrangler 流程。
- 专项验证脚本包括：`admin:verify`、`import:verify`、`personal-import:verify`、`review-workflow:verify`、`catalog-review:verify`、`catalog-metadata:verify`、`media:verify`、`auth:verify`、`member-media:verify`。

## 4. 主要目录及用途

| 目录 | 用途 |
| --- | --- |
| `app/` | Next.js 页面、布局、样式与 API Route Handlers。 |
| `app/admin/` | 后台：首页大图、目录管理、导入/审核、个人馆藏审核、用户与权限等。 |
| `app/api/` | 认证、馆藏、目录、导入、媒体、通知、审核、个人收藏馆等服务端接口。 |
| `app/catalog/` | 数字化遗产：古籍/文物检索、列表、详情与图像展示。 |
| `app/holdings/` | 图书馆检索：国内、海外、个人公开馆藏，分组/表格浏览与详情。 |
| `app/personal-collection/` | 个人收藏馆、书架、藏品、书籍/藏品管理和公开详情。 |
| `app/components/` | 共享组件，例如通知铃铛、元数据字段组件。 |
| `app/account/`、`login/`、`register/` | 账号中心、登录和注册。 |
| `app/research/`、`app/about/`、`app/data/`、`app/submissions/` | 研究、关于、数据与提交相关页面。 |
| `lib/` | 领域逻辑、认证、权限、仓储、导入、审核、媒体、通知等。 |
| `prisma/` | Prisma Schema 与数据库迁移；数据库提供者为 PostgreSQL。 |
| `db/` | Drizzle/SQL 旧结构、种子和辅助代码；修改前需确认是否为兼容层。 |
| `public/` | 静态资源：品牌 Logo、首页背景、示例素材、Excel/CSV 模板等。 |
| `uploads/` | 本地上传文件运行目录。 |
| `scripts/` | 数据库、导入、审核、媒体、权限和个人收藏的专项验证/维护脚本。 |
| `tests/` | 自动化测试。 |
| `docs/` | 项目文档；`outputs/`、`work/`、`examples/` 不是生产代码入口。 |

## 5. 核心业务模块

1. **数字化遗产**：古籍与文物目录、搜索、详情、图像权限展示。
2. **图书馆检索**：国内馆藏、海外馆藏、个人公开收藏的检索、分组浏览、机构浏览、表格浏览、详情和外部目录链接。
3. **馆藏数据提交与审核**：CSV/Excel 导入、字段校验、批次与逐条审核、需补充/退回/通过流程。
4. **馆藏记录修订**：对既有馆藏信息提出修订，由有审核权限的其他用户审核后生效。
5. **个人收藏馆**：个人书籍与藏品录入、批量导入、本地图片、书架与藏品展示、公开申请与审核。
6. **后台管理**：目录、馆藏、首页大图、研究资料、导入审核、个人馆藏审核、用户组与权限。
7. **通知**：账号授权、审核提交、审核结果等通知通过站内铃铛展示。

## 6. 主要数据结构和字段

### 用户、权限与通知

- `User`：`email`（唯一）、`displayName`、`passwordHash`、`role`、`isActive`、`groupId`、`reviewLane`、创建时间等。
- `UserGroup`：`name`（唯一）、`description`、`permissions`（字符串数组）、`isSystem`。
- `Notification`：`userId`、`kind`、`title`、`message`、`href`、`isRead`、创建时间。
- 已定义权限代码：
  - `CATALOG_WRITE` / `CATALOG_REVIEW`
  - `HOLDING_WRITE` / `HOLDING_REVIEW`
  - `PERSONAL_COLLECTION`
  - `USER_MANAGE`

### 数字化目录与媒体

- `Book`：`title`、`author`、`dynasty`、`eraDetail`、`publicationDate`、`imprintPublisher`、`versionType`、`binding`、`volumeCount`、`categories`、`description`、`source`、`keywords`、审核状态与媒体关联。
- `Artifact`：`title`、`category`、`era`、`material`、`description`、`source`、`keywords`、审核状态与媒体关联。
- `MediaAsset`：`storageKey`（唯一）、`mimeType`、`visibility`、所属书籍/文物/个人藏品、上传者。

### 图书馆馆藏与修订

- `Holding`：`institution`、`region`、`origin`、`callNumber`、`catalogUrl`、`description`、状态，以及关联 `Book` 或 `Artifact`。
- `HoldingRevision`：待审批的 `proposedBook` / `proposedHolding`（JSON）、提交者、审核者、审核说明、状态和时间戳。
- 当前修订输入已覆盖：书名、作者、年代/刊刻信息、版本、装帧、册数、分类、说明、图书馆、地区、来源、检索号、官方链接等。
- 文物馆藏修订是否已完整支持：**待确认**（现有修订服务明确以古籍馆藏为主）。

### 个人收藏与导入

- `PersonalCollectionItem`：所有者、类型（书籍/藏品）、题名、作者/来源、年代与刊刻信息、版本/类别、价格、装帧、分类、册数/数量、自动编号、说明、公开与审核状态、媒体关联。
- `ImportBatch`：格式、提交者、审核状态、总行数/有效行数、原始文件、审核信息。
- `ImportBatchRecord`：批次行号、原始行、解析值（JSON）、逐条状态、审核说明、应用时间。
- `ImportBatchEvent` 与 `AuditEvent`：批次和实体操作审计记录。

## 7. 权限与用户角色

- Prisma 用户角色：`MEMBER`、`COLLECTOR`、`SUPER_ADMIN`。
- 系统 Admin 是唯一的系统超级管理员；其余账号可以注册后由 Admin 分组并授权。
- 已授权管理组的实际能力由 `UserGroup.permissions` 决定；`SUPER_ADMIN` 默认拥有全部权限代码。
- 审核遵循“提交者不能审核本人提交内容”；具备相应审核权限的其他用户可审核。
- 个人收藏馆属于个人账号空间；个人公开收藏需走审核流程，不能作为“个人馆藏信息”提交到馆藏数据提交入口。

## 8. 页面和功能之间的关系

- 首页导航中的 **数字化遗产** 进入 `app/catalog/`；只检索数字化目录，不应混入图书馆馆藏记录。
- 首页导航中的 **图书馆检索** 进入 `app/holdings/`；检索馆藏记录，并按来源、机构/书名/表格等方式浏览。
- 馆藏详情 `app/holdings/[id]/` 负责馆藏书目与馆藏位置展示；可从此发起馆藏信息修订。
- 个人公开馆藏的详情链接指向 `app/personal-collection/public/[id]/`，而非普通馆藏详情。
- 个人收藏馆 `app/personal-collection/` 默认展示个人书架，可切换藏品；书籍管理和藏品管理负责录入、编辑、导入及图片管理。
- `app/admin/review/` 面向馆藏数据批次审核；`app/admin/catalog-review/` 面向古籍/文物审核；`app/admin/personal-review/` 面向个人馆藏公开审核。
- `app/admin/users/` 管理用户组、账号授权和权限分配。

## 9. 已确认的业务规则

- V1 仅提供中文界面。
- 图片先存本地服务器目录，后续才迁移对象存储。
- 文物图片游客可见；古籍图片仅会员可见；私有媒体仅超级管理员可见。
- 数字化遗产、图书馆检索、个人收藏馆三者必须区分数据范围与入口。
- 图书馆检索中的来源须区分国内、海外、个人公开收藏。
- 个人书籍/藏品上传后可在所有者自己的收藏馆内显示；“公开”须经审核，审核通过后自动公开。
- 个人公开申请至少需要一张图片；审核中可撤回。
- 导入表头、Schema、API、模板、管理列表、详情页、审核页必须同步更新，不能只修改其中一层。
- 外部目录链接可为空；列表中无需完整展示长链接，详情页应提供跳转入口。

## 10. 已完成模块与当前开发阶段

- 已具备：本地账号认证、用户组权限、站内通知、古籍/文物目录、馆藏检索、个人收藏馆、图片上传、CSV/Excel 导入、批次审核、个人公开审核与馆藏修订的基础实现。
- 当前阶段：优先持续完善核心馆藏目录、图书馆检索、详情页、导入与管理员审核流程的可靠性、数据一致性和界面体验。
- 会员与更细粒度媒体权限属于后续持续完善方向；对象存储迁移尚未实施。

## 11. 长期遵守的界面与数据原则

- 保持中文、信息层级清晰、入口位于相应一级或二级页面；避免仅依赖孤立链接。
- 按功能命名：使用“数字化遗产”“图书馆检索”“馆藏数据审核”“个人馆藏审核”等已确认术语。
- 表格/导入字段必须精确、统一；中文字段名与数据库字段映射变化时需全链路同步并做专项验证。
- 长链接在列表中以简洁入口呈现，在详情页提供“官方目录”等明确跳转。
- 图片数量、公开状态和媒体可见性必须由服务端策略控制，不能只依赖前端隐藏。
- 所有审核操作需记录状态、审核人、审核时间和需要补充/退回的说明；不得允许自审。
- 任何用户可见修改完成后，应按风险进行页面/接口专项自检；未获明确授权不发布公网。
- 不在项目文档或代码中写入数据库密码、令牌、真实私密路径或其他秘密。

