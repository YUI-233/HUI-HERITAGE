# HUI HERITAGE 本地交接包（2026-09-02）

本交接包用于让新的开发人员在 Windows 本地环境接手 HUI HERITAGE。当前基线为 Git 提交 `98b01e7`（2026-09-02，`Publish holding entry and review workflow updates`）。

## 交付物与边界

请在 `outputs/HUI-HERITAGE-handoff-20260902/` 查收以下文件：

| 文件 | 用途 | 是否含敏感信息 |
| --- | --- | --- |
| `source-*.zip` | 完整可运行源码、Prisma migration、文档、静态资源和验证脚本 | 否；不含 `.env` |
| `uploads-*.zip` | 本地上传的图片、PDF 等业务媒体 | 可能含业务资料；仅交给受授权人员 |
| `database-*.backup` | PostgreSQL 自定义格式完整备份，可用 `pg_restore` 还原 | 可能含用户与业务数据；仅交给受授权人员 |
| `MANIFEST.txt` | 每个交付物的文件大小与 SHA-256 校验值 | 否 |
| `HUI-HERITAGE-交接确认表.xlsx` | 交接事项、责任人和验收签字表 | 否 |

`.env`、`node_modules`、构建缓存和历史输出均不属于交付物。`.env` 必须由现任管理员通过安全渠道单独交给接手人；不得通过聊天、邮件正文或 Git 提交发送。

## 新电脑的最短接手流程

1. 解压 `source-*.zip` 到一个新目录；不要覆盖原项目。
2. 安装 Node.js 22.13 或更高版本与 PostgreSQL 客户端/服务端（建议 17）；在项目根目录执行 `npm ci`。
3. 从安全渠道取得 `.env`，复制为项目根目录的 `.env`。至少确认 `DATABASE_URL`、`UPLOAD_DIR`、`SUPER_ADMIN_EMAIL`、`ADMIN_LOCAL_TOKEN`、`AUTH_SESSION_SECRET`；如启用了邮件功能，另确认 `APP_BASE_URL`、`EMAIL_FROM`、`RESEND_API_KEY`。
4. 创建空的 PostgreSQL 数据库，并执行：

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --clean --if-exists --no-owner --dbname "postgresql://<user>:<password>@<host>:<port>/<database>" ".\database-YYYYMMDD.backup"
```

5. 将 `uploads-*.zip` 解压到 `.env` 中 `UPLOAD_DIR` 所指目录。目录应只由应用程序账户读写，不能作为静态公开目录。
6. 运行 `& "C:\Program Files\nodejs\npm.cmd" run db:generate`，再运行 `& "C:\Program Files\nodejs\npm.cmd" run db:verify`。当前 2026-09-02 基线中，该脚本会因**没有已批准的国内馆藏（`DOMESTIC`）**而报错 `An approved holding must resolve to a catalogue record.`；这是一项已知数据/验证前置条件，不是新电脑安装失败。先记录结果并由产品负责人决定补录样本数据或调整验证脚本。其余流程以 `& "C:\Program Files\nodejs\npm.cmd" run dev:postgres` 启动；本地地址是 `http://localhost:3014`。

如不还原完整备份而是新建空库，必须先审阅 `prisma/migrations/` 并执行经确认的 Prisma migration；不要把旧的 Drizzle/D1 文件当作 PostgreSQL 主库迁移入口。

## 当前架构要点

- 主运行方式：Next.js App Router + React + TypeScript；本地完整业务版本使用 PostgreSQL + Prisma。
- 兼容层：`db/`、`drizzle/`、Vinext/Wrangler 配置用于旧结构和云端试运行；新增本地业务以 Prisma 为准。
- 本地媒体：`uploads/` 存储图片/PDF；数据库仅保存媒体关联与存储键。备份与还原必须成对进行。
- 权限/认证：账号、用户组、审核权限、会话 Cookie 与媒体策略都在服务端控制；不可只依赖前端隐藏。
- 外部发布不是本次交接范围。`.openai/hosting.json` 存在，但当地 PostgreSQL 版本仍是完整功能验收基线。

## 建议优先阅读顺序

1. `PROJECT.md`：产品、模块、权限与运行基线。
2. `AGENTS.md`：项目开发规则和常用验证命令。
3. `prisma/schema.prisma` 与 `prisma/migrations/`：真实数据模型与演进。
4. `lib/` 与 `app/api/`：领域规则、认证、审核和接口。
5. `HANDOFF.md`：历史功能交接说明（部分内容早于当前基线，须以代码和本文件为准）。
6. `docs/production-release-runbook.md`：仅在未来明确授权发布时使用。

## 接手后最低验收

按交接确认表执行：数据库连接、管理员登录、数字化遗产检索、图书馆检索、导入/审核闭环、个人收藏公开审核和受限媒体权限。验证时须使用两个不同账号确认“提交者不可自审”。
