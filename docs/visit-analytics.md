# 访问数据

系统 Admin 可从账号中心或后台导航进入 `/admin/analytics`。

包含日期、用户类型、内容类型及关键词筛选，核心指标与上一周期对比，注册用户/游客趋势，古籍与文章各前 20 名排行榜，分页访问明细及 CSV 导出。数据使用北京时间，默认最近 30 天。每次打开或刷新页面计一次浏览，古籍详情/阅读器与文章详情计阅读；游客与注册用户记录不合并。统计从启用后开始，不补算历史。系统 Admin 和后台页面不计入访问数据。

数据持久化到 Prisma `VisitEvent` / PostgreSQL `visit_events`。只记录匿名访客标识或账号标识，不记录邮箱、IP、完整来源 URL。游客标识使用 HttpOnly cookie。前台只提交事件、页面和会话信息；身份、内容标题与已发布状态由服务端确认。

本地更新数据库和客户端：

```powershell
npm.cmd run db:generate
npx.cmd prisma migrate deploy
```

启动本地服务后运行专项检查：

```powershell
npx.cmd tsx scripts/verify-visit-analytics.ts
```

检查使用临时资料和临时会员，结束后清理其事件和数据。覆盖真实 HTTP 采集、重复事件、身份分离、排行榜、筛选、导出及管理员权限。
