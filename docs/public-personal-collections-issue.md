# 公开个人收藏馆目录与详情页

## 目标

让游客无需登录即可浏览已公开的个人收藏馆，进入某一位收藏者的公开馆页，并查看该馆已审核公开的书籍和藏品。

## 用户流程

```text
访客打开网站
-> 点击主导航“个人收藏馆”
-> 浏览公开收藏馆目录
-> 点击一个收藏馆
-> 在收藏馆主页按“全部 / 书籍 / 藏品”浏览
-> 点击单件内容进入现有公开详情页
```

公开浏览入口与私人管理入口分开：

```text
/personal-collections                 公开收藏馆目录，游客可访问
/personal-collections/[slug]          单个公开收藏馆，游客可访问
/personal-collection                  我的收藏馆管理，登录后可访问
/personal-collection/public/[itemId]  已有单件公开藏品详情，继续复用
```

## 本期前端页面

### 公开收藏馆目录 `/personal-collections`

每张收藏馆卡片显示：

- 封面图；没有封面时显示默认图。
- 收藏馆名称。
- 收藏者公开名称。
- 收藏馆简介。
- 公开书籍数、公开藏品数和公开内容总数。
- “进入收藏馆”入口。

页面还需支持：

- 按收藏馆名称或收藏者名称搜索。
- 分页，默认每页 12 个收藏馆。
- 加载中、无公开收藏馆、搜索无结果、请求失败的状态。
- 手机端适配。

主导航的“个人收藏馆”改为链接到此公开目录；登录用户从账户中心进入 `/personal-collection` 管理自己的收藏。

### 单个公开收藏馆 `/personal-collections/[slug]`

页面显示：

- 收藏馆名称。
- 收藏者公开名称。
- 收藏馆简介。
- 公开书籍数、公开藏品数和总数。
- `全部 / 书籍 / 藏品` 切换。
- 关键词搜索。
- 公开内容卡片列表与分页。

内容卡片显示：封面、标题、作者/来源、年代、分类或版本、编号；点击后链接到现有 `/personal-collection/public/[itemId]` 单件详情页。

## 本期不做

- 收藏者编辑收藏馆名称、简介或封面。
- 关注、点赞、评论、收藏。
- 藏友私信或站内信。
- 收藏馆推荐、排行榜。
- 全文内容检索。
- 多书架、主题分区。

## 公开与隐私规则

1. 只有至少存在一件 `status=APPROVED` 且 `isPublic=true` 内容的用户，才显示为公开收藏馆。
2. 目录和详情页只返回 `APPROVED + isPublic=true` 的书籍、藏品及其 `PUBLIC` 图片。
3. `DRAFT`、`PENDING`、`REJECTED`、`NEEDS_REVISION` 和 `isPublic=false` 的内容不能出现在任何公开响应中。
4. 游客响应中不得包含邮箱、用户角色、审核意见、私有媒体或其他私人资料。
5. 收藏者撤回公开内容后，该内容必须从公开馆页消失；若该馆没有任何公开内容，则该馆也从目录消失。

## 后端待实现与确认

### 数据字段

请确认公开收藏馆使用的稳定路由标识：

- 推荐在用户侧增加唯一、稳定的 `publicCollectionSlug`。
- 收藏馆名称：优先 `publicCollectionName`；为空时使用“`displayName` 的收藏馆”。
- 收藏馆简介：`publicCollectionDescription`，允许为空。

本期不做这些字段的前端编辑页，但接口需要返回可展示的数据。

封面规则：从该收藏馆已有的公开内容中选择一张 `PUBLIC` 图片；建议取最新更新的公开内容的第一张图片。没有可用图片时返回 `cover: null`。

### 接口一：公开收藏馆目录

```http
GET /api/personal-collections?q=&page=1&limit=12
```

参数：

| 参数 | 规则 |
| --- | --- |
| `q` | 可选，按收藏馆名称或收藏者公开名称搜索，最长 100 字。 |
| `page` | 可选，正整数，默认 `1`。 |
| `limit` | 可选，正整数，默认 `12`，最大 `24`。 |

成功响应：

```json
{
  "items": [
    {
      "slug": "zhang-san",
      "name": "张三的收藏馆",
      "ownerName": "张三",
      "description": "主要收藏清代汉文回教古籍。",
      "cover": {
        "itemId": "item_001",
        "mediaId": "media_001",
        "url": "/api/personal-collection/public/item_001/media/media_001"
      },
      "bookCount": 18,
      "artifactCount": 6,
      "totalCount": 24,
      "updatedAt": "2026-09-07T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 36,
    "totalPages": 3
  }
}
```

### 接口二：单个公开收藏馆

```http
GET /api/personal-collections/:slug?type=BOOK&q=&page=1&limit=24
```

参数：

| 参数 | 规则 |
| --- | --- |
| `type` | 可选，`BOOK` 或 `ARTIFACT`；省略代表全部。 |
| `q` | 可选，按标题、作者/来源、分类或编号搜索，最长 100 字。 |
| `page` | 可选，正整数，默认 `1`。 |
| `limit` | 可选，正整数，默认 `24`，最大 `48`。 |

成功响应：

```json
{
  "collection": {
    "slug": "zhang-san",
    "name": "张三的收藏馆",
    "ownerName": "张三",
    "description": "主要收藏清代汉文回教古籍。",
    "bookCount": 18,
    "artifactCount": 6,
    "totalCount": 24
  },
  "items": [
    {
      "id": "item_001",
      "type": "BOOK",
      "title": "天方性理",
      "creator": "刘智",
      "era": "清",
      "category": "经学",
      "editionOrCategory": "刻本",
      "serialNumber": "PC-0001",
      "cover": {
        "mediaId": "media_001",
        "url": "/api/personal-collection/public/item_001/media/media_001"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 24,
    "totalPages": 1
  }
}
```

### 复用现有接口

```http
GET /api/personal-collection/public/:itemId
GET /api/personal-collection/public/:itemId/media/:mediaId
```

### 错误格式

```json
{ "message": "面向用户的错误说明" }
```

| 场景 | HTTP 状态 |
| --- | --- |
| 请求参数不合法 | `400` |
| 收藏馆不存在，或已无公开内容 | `404` |
| 服务端异常 | `500` |

目录为空或搜索无结果应返回 `200` 和空数组，不视为错误。

## 分工

| 前端 | 后端 |
| --- | --- |
| 目录页、馆详情页、卡片、搜索、筛选、分页、空状态、错误状态和移动端适配。 | 字段迁移、公开内容聚合、两条接口、参数校验、统计数量、封面选择、隐私过滤与测试。 |
| 调整导航与面包屑，区分公开浏览和私人管理入口。 | 复用现有单件公开详情和图片读取接口。 |

## 联调方式

1. 后端先在本 Issue 中确认字段、封面规则和响应 JSON；字段确认后不要无通知修改名称或类型。
2. 前端先根据上述 JSON 使用 Mock 数据开发页面。
3. 后端完成接口后，在本 Issue 留下测试地址和至少两组测试数据：有公开内容的收藏馆，以及无公开内容的用户。
4. 前端切换真实接口，测试目录、搜索、分页、筛选、封面、404 和手机端。
5. 前后端各自提交 PR；后端接口先合并，前端联调完成后合并。

## 验收清单

- [ ] 游客可从主导航进入公开收藏馆目录。
- [ ] 目录只显示至少有一件已审核公开内容的收藏馆。
- [ ] 目录卡片显示封面、收藏馆名称、收藏者名称、简介和数量统计。
- [ ] 目录搜索、分页、空状态、默认封面和错误状态正常。
- [ ] 馆页显示简介和统计，并支持全部、书籍、藏品切换。
- [ ] 馆页搜索、分页和跳转单件公开详情正常。
- [ ] 私有、草稿、审核中、退回和待补充内容不出现在公开接口中。
- [ ] 响应不含邮箱或其他私密资料。
- [ ] 撤回公开内容后，内容与空馆从公开页面消失。
- [ ] 目录和馆页的手机端可用。
