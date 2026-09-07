# HUI HERITAGE 项目开发规则

## 项目概况

- 项目：HUI HERITAGE（中文界面，V1 版本保持本地运行）。
- 前端与页面：Next.js `16.2.6` App Router、React `19.2.6`、TypeScript `5.9.3`。
- 数据库：PostgreSQL，通过 Prisma `6.19.3` 访问；项目同时保留 Drizzle 相关配置与旧数据结构，新增功能以 Prisma 为主。
- 图片与文件：第一版使用服务器本地文件目录保存，后续再迁移对象存储。
- 部署形态：仓库包含 `.openai/hosting.json`，但当前开发、验收与运行范围保持在本地，未经明确要求不得发布。
- 权限基线：V1 保留系统 Admin/超级管理员、普通会员及已授权管理组的业务规则；权限细分需遵循现有产品约定。

## 开发工作流

- 继续推进下一个已确定的 HUI HERITAGE 任务；常规开发步骤不等待重复确认。
- 每完成一个清晰阶段主动汇报进度；长时间任务至少每分钟提供一次状态更新。
- 对用户可见的改动，在报告完成前进行适度自检：至少检查相关页面/接口流程，并按风险决定是否运行构建或专项验证。
- 保持网站本地运行，除非用户明确要求，否则不发布或配置公网地址。
- 优先完善核心馆藏目录、图书馆检索、详情页、导入与管理员审核工作流，再扩展会员与媒体权限功能。
- 只有涉及密钥、系统级安装、外部发布、付款或其他超出常规开发授权的动作时，才向用户请求介入。
- 配置/文档类任务若用户明确要求不构建、不启动浏览器，应遵守该限制，不额外执行这些操作。

## 目录用途

- `app/`：Next.js App Router 页面、布局、样式和 API Route Handlers。
  - `app/admin/`：Admin 后台，包括首页大图、馆藏管理、导入/批量审核、个人馆藏审核、用户与权限等。
  - `app/api/`：服务端 API 路由，覆盖认证、馆藏、目录、导入、媒体、通知、审核和个人收藏馆。
  - `app/catalog/`：数字化遗产（古籍/文物）检索、列表和详情页面。
  - `app/holdings/`：图书馆检索（国内、海外及个人公开馆藏记录）、多种浏览模式与详情页。
  - `app/personal-collection/`：个人收藏馆、书架、藏品、个人书籍/藏品管理及公开详情。
  - `app/components/`：跨页面共享组件，例如通知铃铛和元数据字段组件。
  - `app/data/`、`app/research/`、`app/about/`、`app/account/`、`app/login/`、`app/register/`、`app/submissions/`：数据、研究、关于、账号、登录、注册和提交相关页面。
- `lib/`：服务端领域逻辑、仓储、认证、权限、导入解析、审核工作流、媒体策略、通知和个人收藏业务模块。
- `prisma/`：Prisma schema 与数据库迁移；数据库提供者为 PostgreSQL。
- `db/`：Drizzle/SQL 旧结构、种子及数据库辅助代码；修改时需确认是否属于兼容层。
- `public/`：静态资源；品牌 Logo、首页背景、收藏馆示例素材和 Excel/CSV 模板位于其子目录。
- `uploads/`：本地上传文件运行目录，不应提交无关大文件或凭用户授权清理。
- `scripts/`：数据库、权限、导入、审核、媒体和个人收藏工作流的专项验证脚本，以及模板维护脚本。
- `tests/`：自动化测试文件。
- `docs/`：项目文档；`outputs/`、`work/`、`examples/`：过程产物、工作文件和示例，不作为生产代码入口。
- `.openai/hosting.json`：Sites 托管元数据；当前仅保留本地开发。

## 正确命令（Windows PowerShell）

PowerShell 可能禁止执行 `npm.ps1`。优先使用已安装的 npm 命令文件：

```powershell
cd "C:\Users\minqi\Documents\Codex\2026-07-10\sites-plugin-sites-openai-bundled-3"
& "C:\Program Files\nodejs\npm.cmd" run dev:postgres
```

常用脚本（按需执行，不代表每项任务都必须运行）：

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:generate
& "C:\Program Files\nodejs\npm.cmd" run db:verify
& "C:\Program Files\nodejs\npm.cmd" run lint
& "C:\Program Files\nodejs\npm.cmd" run build:postgres
& "C:\Program Files\nodejs\npm.cmd" run start:postgres
```

专项验证脚本：

```powershell
& "C:\Program Files\nodejs\npm.cmd" run admin:verify
& "C:\Program Files\nodejs\npm.cmd" run import:verify
& "C:\Program Files\nodejs\npm.cmd" run personal-import:verify
& "C:\Program Files\nodejs\npm.cmd" run review-workflow:verify
& "C:\Program Files\nodejs\npm.cmd" run catalog-review:verify
& "C:\Program Files\nodejs\npm.cmd" run catalog-metadata:verify
& "C:\Program Files\nodejs\npm.cmd" run media:verify
& "C:\Program Files\nodejs\npm.cmd" run auth:verify
& "C:\Program Files\nodejs\npm.cmd" run member-media:verify
```

- `dev:postgres`、`build:postgres`、`start:postgres` 使用 Next.js，端口固定为 `3014`。
- `dev`、`build`、`start` 使用 Vinext/Wrangler 兼容入口；除非任务明确针对 Sites/Vinext，否则本项目的 PostgreSQL 功能验收优先使用 `*-postgres` 脚本。
- `test` 会先执行 `npm run build`，因此仅在明确允许构建时运行。
- Prisma 数据库连接读取 `.env` 中的 `DATABASE_URL`；不要把密码、令牌或本地环境变量写入代码或提交到版本库。

## 数据与功能规则

- 保持现有中文字段命名与产品术语一致，尤其是“数字化遗产”“图书馆检索”“馆藏数据审核”“个人馆藏审核”等已确认名称。
- 馆藏书目信息的导入、编辑和审核必须区分国内馆藏、海外馆藏与个人收藏；个人收藏不能通过公共馆藏提交入口写入公共馆藏。
- 审核动作必须留下状态和理由；涉及提交者本人、重复批次、退回/补充和通知时，先核对现有审核工作流与 Prisma 模型，再修改接口和页面。
- 图片访问必须遵守现有媒体可见性策略；不要为了页面预览绕过会员或审核权限。
- 修改数据模型或导入表头时，同时检查 Prisma schema、API、模板、列表、详情和审核页面，避免只改一处造成字段不一致。

## 修改与验收边界

- 只修改完成当前任务所需的文件，保留用户已有改动；不要使用破坏性 Git 操作。
- 修改前优先阅读相关页面、API、领域模块和样式文件；不要凭截图重写未涉及的功能。
- 文档或配置任务中，若用户要求只检查目录与配置，不得修改业务代码、运行全站构建或启动浏览器。
- 完成后说明：做了什么、改了哪些文件、执行了哪些检查，以及仍存在的限制。
