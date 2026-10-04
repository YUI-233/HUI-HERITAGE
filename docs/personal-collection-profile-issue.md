# 个人收藏馆资料编辑：基本资料、收藏特征、合作意向与封面

## 目标

让已开通个人收藏馆的登录用户维护自己公开馆页的基础资料：收藏馆名称、简介和封面。

资料保存后，已公开的收藏馆目录和收藏馆详情页应显示最新内容；没有任何公开藏品的用户仍不会出现在公开目录中。

## 本期范围

### 用户可编辑内容

- 收藏馆名称：必填，2–40 个字符。
- 收藏馆简介：选填，最多 300 个字符。
- 收藏者公开称呼：选填，最多 20 个字符。
- 收藏主题、主要收藏年代：选填，各最多 5 项。
- 主要收藏地域、开始收藏年份：选填。
- 收藏缘起：选填，最多 500 个字符。
- 研究与合作意向、是否接受私信：选填。
- 收藏馆封面：从本人已审核公开的书籍或藏品图片中选择一张，也可恢复为系统默认封面。

### 页面与入口

在登录用户的 `/personal-collection` 管理页面增加“收藏馆设置”入口。

设置页包含：

- 当前封面预览。
- 收藏馆名称输入框与字数提示。
- 收藏馆简介文本框与字数提示。
- “从公开藏品中选择封面”图片列表。
- “恢复默认封面”“取消”“保存设置”操作。
- 保存成功、表单错误、请求失败和无可选公开图片状态。

公开页面继续使用：

```text
/personal-collections
/personal-collections/[slug]
```

## 本期不做

- 上传独立于藏品之外的新封面图片。
- 修改公开 URL（slug）。
- 收藏馆分区、多书架、主题皮肤。
- 名称和简介的审核工作流。
- 私信、评论、点赞、关注。

独立上传封面需要扩展媒体模型和存储关联，本期先复用已经审核公开的藏品图片，避免公开页面引用私有文件。

## 业务规则

1. 仅收藏馆所有者可以读取和修改自己的设置。
2. 封面只能选择当前用户拥有，且所属藏品同时满足 `status=APPROVED` 与 `isPublic=true` 的 `PUBLIC` 图片。
3. 用户将封面所属藏品撤回公开后，后端必须自动清空该封面引用；公开页面回退为默认封面。
4. 用户没有公开藏品时，仍可保存名称和简介，但其收藏馆不应进入公开目录。
5. 名称与简介保存后即时生效；后端必须去除首尾空格、限制长度，并以纯文本安全存储和输出。
6. 收藏馆名称不要求唯一；公开 URL 使用稳定且不可在本期编辑的 `slug`。
7. 接口不得暴露用户邮箱、角色、审核意见或任何私有媒体信息。

## 数据设计

建议新增独立的一对一资料表，而不是把公开馆字段混入 `User`：

```text
PersonalCollectionProfile
├── id
├── ownerId                     唯一，关联 User
├── slug                        唯一、稳定，用于公开 URL
├── displayName                 收藏馆名称
├── description                 收藏馆简介，可为空
├── publicCollectorName         公开称呼，可为空
├── themes                      收藏主题数组
├── primaryEras                 主要年代数组
├── primaryRegion               主要地域，可为空
├── collectingSinceYear         开始收藏年份，可为空
├── originStory                 收藏缘起，可为空
├── collaborationInterests      合作意向数组
├── acceptsMessages             是否接受私信，可为空
├── coverMediaId                可为空，关联 MediaAsset
├── createdAt
└── updatedAt
```

创建时机：用户第一次打开“收藏馆设置”或第一次保存时，后端通过 upsert 创建资料记录。

默认值：

```text
displayName = “{用户 displayName} 的收藏馆”
slug = 后端生成的唯一稳定值
description = null
coverMediaId = null
```

公开目录和公开馆详情接口需要从该资料表读取 `displayName`、`description`、`coverMediaId` 与 `slug`；没有资料记录的旧用户使用默认名称和默认封面兼容展示。

## 后端接口契约

### 1. 获取当前用户的收藏馆设置

```http
GET /api/personal-collection/profile
```

需要登录。若资料尚未存在，后端可返回默认资料，也可以先创建后返回。

成功响应：

```json
{
  "slug": "yan-jing-shu-she",
  "displayName": "岩境書舍",
  "description": "收藏清代至民国时期的汉文回教古籍。",
  "publicCollectorName": "岩境主人",
  "themes": ["经训", "语言文字"],
  "primaryEras": ["清代", "民国"],
  "primaryRegion": "西北地区",
  "collectingSinceYear": 2012,
  "originStory": "从整理家藏旧籍开始，逐步关注相关古籍的版本与流传。",
  "collaborationInterests": ["学术研究", "版本鉴定", "数字化合作"],
  "acceptsMessages": true,
  "cover": {
    "mediaId": "media_001",
    "itemId": "item_001",
    "url": "/api/personal-collection/public/item_001/media/media_001"
  }
}
```

无封面时：

```json
{
  "slug": "yan-jing-shu-she",
  "displayName": "岩境書舍",
  "description": null,
  "cover": null
}
```

### 2. 获取可选封面图片

```http
GET /api/personal-collection/profile/cover-options
```

需要登录。只返回当前用户可作为公开封面的图片。

成功响应：

```json
{
  "items": [
    {
      "mediaId": "media_001",
      "itemId": "item_001",
      "itemTitle": "天方性理",
      "itemType": "BOOK",
      "url": "/api/personal-collection/public/item_001/media/media_001"
    }
  ]
}
```

没有可选封面时返回：

```json
{ "items": [] }
```

### 3. 保存收藏馆设置

```http
PATCH /api/personal-collection/profile
Content-Type: application/json
```

请求体：

```json
{
  "displayName": "岩境書舍",
  "description": "收藏清代至民国时期的汉文回教古籍。",
  "publicCollectorName": "岩境主人",
  "themes": ["经训", "语言文字"],
  "primaryEras": ["清代", "民国"],
  "primaryRegion": "西北地区",
  "collectingSinceYear": 2012,
  "originStory": "从整理家藏旧籍开始，逐步关注相关古籍的版本与流传。",
  "collaborationInterests": ["学术研究", "版本鉴定", "数字化合作"],
  "acceptsMessages": true,
  "coverMediaId": "media_001"
}
```

恢复默认封面：

```json
{
  "displayName": "岩境書舍",
  "description": "收藏清代至民国时期的汉文回教古籍。",
  "coverMediaId": null
}
```

成功响应：`200`，返回与 `GET /api/personal-collection/profile` 相同的完整资料对象。

## 错误约定

统一错误响应：

```json
{ "message": "面向用户的错误说明" }
```

| 场景 | HTTP 状态 | 示例提示 |
| --- | --- | --- |
| 未登录 | `401` | 请先登录后再管理收藏馆。 |
| 名称为空或长度超限 | `400` | 收藏馆名称应为 2–40 个字符。 |
| 简介超限 | `400` | 收藏馆简介不能超过 300 个字符。 |
| 封面不存在或不属于当前用户 | `403` | 不能使用这张图片作为收藏馆封面。 |
| 封面未公开或其所属内容未审核通过 | `409` | 请选择已公开藏品中的图片。 |
| 服务异常 | `500` | 暂时无法保存收藏馆设置，请稍后重试。 |

## 前端分工

- 在个人收藏馆管理页增加“收藏馆设置”导航项。
- 开发设置表单、封面预览、图片选择区、默认封面与保存反馈。
- 请求上述三条接口，并处理登录失效、字段校验、保存中、成功和失败状态。
- 资料保存后刷新本页显示；公开目录和详情页在重新访问时读取最新资料。
- 完成桌面端与手机端适配。

## 后端分工

- 新增资料表、Prisma 模型与迁移。
- 生成稳定唯一 slug，并为现有个人收藏用户提供默认资料兼容逻辑。
- 实现三条接口、所有者授权判断和输入校验。
- 严格筛选可选封面，确保封面图片与其所属藏品均为公开状态。
- 在撤回公开、删除图片或删除藏品时清空失效 `coverMediaId`。
- 调整公开收藏馆目录和详情接口，使其读取保存后的名称、简介、封面与 slug。

## 联调顺序

1. 后端先确认资料表字段和 slug 生成规则。
2. 前端按以上响应结构用 Mock 数据完成设置页。
3. 后端提供测试账号与至少两类数据：有可选公开图片的用户、没有公开图片的用户。
4. 前端联调读取、选图、保存、恢复默认封面和错误提示。
5. 共同测试：保存后公开目录与详情页更新；撤回封面所属内容后公开页回退默认封面。

## 验收清单

- [ ] 登录收藏者可进入“收藏馆设置”。
- [ ] 页面展示当前名称、简介和封面。
- [ ] 名称与简介的长度限制、字符提示和提交校验正确。
- [ ] 用户只能看到并选择自己的已公开藏品图片。
- [ ] 保存后设置页、公开目录和公开馆详情显示新资料。
- [ ] 恢复默认封面后公开页不再展示旧封面。
- [ ] 撤回或删除被选为封面的内容后，封面引用自动失效并回退默认图。
- [ ] 私有图片、邮箱、审核意见等信息不会出现在请求响应中。
- [ ] 无公开图片、网络错误、登录失效和保存失败有明确提示。
- [ ] 手机端可完成输入、选图和保存。

## 建议分支

```text
feature/frontend-collection-profile
feature/backend-collection-profile
```
