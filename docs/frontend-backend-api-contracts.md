# 个人收藏馆前后端接口总对接文档

## 1. 文档目的

本文汇总当前个人收藏馆相关前端等待后端实现或联调的全部接口，覆盖：

1. 公开收藏馆目录与馆页。
2. 收藏馆名称、简介和封面设置。
3. 公开馆藏信息检索。
4. 藏友私信／站内信。
5. 持有效借阅证导出其他收藏馆的公开书单。

公开收藏馆、收藏馆资料、公开馆藏检索、书单导出与站内信接口均已接通本地 PostgreSQL。

## 2. 接口总览

| 编号 | 方法 | 路径 | 登录 | 当前前端状态 | 后端状态 |
| --- | --- | --- | --- | --- | --- |
| PC-01 | `GET` | `/api/personal-collections` | 否 | 已接通 | 已实现（本地 PostgreSQL） |
| PC-02 | `GET` | `/api/personal-collections/:slug` | 否 | 已接通 | 已实现（本地 PostgreSQL） |
| PC-03 | `GET` | `/api/personal-collections/:slug/books/export?format=xlsx` | 是，且需有效借阅证 | 已接通 | 已实现（本地 PostgreSQL；XLSX） |
| PP-01 | `GET` | `/api/personal-collection/profile` | 是 | 已接通 | 已实现（本地 PostgreSQL） |
| PP-02 | `GET` | `/api/personal-collection/profile/cover-options` | 是 | 已接通 | 已实现（本地 PostgreSQL） |
| PP-03 | `PATCH` | `/api/personal-collection/profile` | 是 | 已接通 | 已实现（本地 PostgreSQL） |
| PS-01 | `GET` | `/api/personal-collections/items` | 否 | 已接通 | 已实现（本地 PostgreSQL） |
| MSG-01 | `GET` | `/api/messages/conversations` | 是 | 已接通 | 已实现（本地 PostgreSQL） |
| MSG-02 | `GET` | `/api/messages/conversations/:conversationId` | 是 | 已接通 | 已实现（本地 PostgreSQL） |
| MSG-03 | `POST` | `/api/messages/conversations` | 是 | 已接通 | 已实现（本地 PostgreSQL） |
| MSG-04 | `POST` | `/api/messages/conversations/:conversationId/messages` | 是 | 已接通 | 已实现（本地 PostgreSQL） |
| MSG-05 | `PATCH` | `/api/messages/conversations/:conversationId/read` | 是 | 已接通 | 已实现（本地 PostgreSQL） |

当前表内 12 条接口均已实现；PC-03 导出权限与 XLSX 内容验证见 `npm run collection-export:verify`。

## 3. 通用约定

### 3.1 数据格式

- 请求和响应使用 UTF-8 JSON。
- JSON 字段使用 camelCase。
- 时间使用 ISO 8601 UTC，例如 `2026-09-25T08:00:00.000Z`。
- 可空字段统一返回 `null`，不要在相同字段上混用空字符串、缺失字段和 `null`。
- 列表接口即使没有数据，也返回 `200` 和空数组。

### 3.2 统一错误格式

```json
{
  "code": "ERROR_CODE",
  "message": "面向用户的中文错误说明"
}
```

`code` 用于前端区分需要登录、办理借阅证和无可导出书籍等状态；新增接口必须返回，旧接口可在联调时逐步补齐。

通用状态码：

| 状态码 | 含义 |
| --- | --- |
| `400` | 参数格式或字段校验错误 |
| `401` | 未登录或登录已失效 |
| `403` | 已登录但无权进行该操作 |
| `404` | 资源不存在，或用户无权知道该资源是否存在 |
| `409` | 当前资源状态不允许操作 |
| `429` | 请求过于频繁 |
| `500` | 服务端异常 |

### 3.3 分页格式

```json
{
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 36,
    "totalPages": 2
  }
}
```

- `page` 从 1 开始。
- `total` 是筛选后的记录总数。
- `totalPages` 无结果时可以返回 `0` 或 `1`，但所有分页接口必须保持一致。

### 3.4 隐私基线

公开接口不得返回：

- 邮箱。
- 真实用户 ID。
- 用户角色和用户组。
- 审核意见。
- 私有媒体地址或存储路径。
- 登录、会话和私信资料。

公开书籍或文物必须同时满足：

```text
status = APPROVED
isPublic = true
图片 visibility = PUBLIC
```

## 4. 公开收藏馆接口

### PC-01：公开收藏馆目录

```http
GET /api/personal-collections?q=&page=1&limit=12
```

无需登录。

参数：

| 参数 | 规则 |
| --- | --- |
| `q` | 可选，最长 100 字；匹配收藏馆名称或收藏者公开名称 |
| `page` | 正整数，默认 1 |
| `limit` | 正整数，默认 12，最大 24 |

成功响应：

```json
{
  "items": [
    {
      "slug": "yan-jing-shu-she",
      "name": "岩境書舍",
      "ownerName": "张三",
      "description": "收藏清代至民国时期的汉文回教古籍。",
      "cover": {
        "itemId": "item_001",
        "mediaId": "media_001",
        "url": "/api/personal-collection/public/item_001/media/media_001"
      },
      "bookCount": 18,
      "artifactCount": 6,
      "totalCount": 24,
      "updatedAt": "2026-09-25T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 1,
    "totalPages": 1
  }
}
```

无封面时 `cover` 返回 `null`。

业务规则：

- 只有至少拥有一件已审核公开内容的用户才进入目录。
- 收藏馆名称和封面优先读取收藏馆资料表。
- 没有资料记录的旧用户使用兼容默认名称和默认封面。
- 用户撤回最后一件公开内容后，收藏馆立即从目录消失。

### PC-02：单个公开收藏馆

```http
GET /api/personal-collections/:slug?type=&q=&page=1&limit=24
```

无需登录。

参数：

| 参数 | 规则 |
| --- | --- |
| `type` | 可选，只允许 `BOOK` 或 `ARTIFACT` |
| `q` | 可选，最长 100 字；匹配题名、作者／来源、年代、分类、版本或编号 |
| `page` | 正整数，默认 1 |
| `limit` | 正整数，默认 24，最大 48 |

成功响应：

```json
{
  "collection": {
    "slug": "yan-jing-shu-she",
    "name": "岩境書舍",
    "ownerName": "张三",
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
      "itemId": "item_001",
      "mediaId": "media_001",
      "url": "/api/personal-collection/public/item_001/media/media_001"
    },
    "bookCount": 18,
    "artifactCount": 6,
    "totalCount": 24,
    "updatedAt": "2026-09-25T08:00:00.000Z"
  },
  "items": [
    {
      "id": "item_001",
      "type": "BOOK",
      "title": "清真指南",
      "creator": "马注",
      "era": "清",
      "category": "伊斯兰思想、哲学",
      "editionOrCategory": "木刻本",
      "serialNumber": "PC-0005",
      "cover": {
        "itemId": "item_001",
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

收藏馆不存在或已经没有任何公开内容时返回 `404`。

### PC-03：导出其他收藏馆的公开书单

```http
GET /api/personal-collections/:slug/books/export?format=xlsx
Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

该接口用于已登录且持有**有效借阅证**的用户，在公开个人收藏馆内导出该馆的公开书籍。前端只负责发起请求和下载文件，是否有导出资格必须由后端根据当前会话校验，不能信任前端传入的用户或借阅证信息。

请求规则：

| 项目 | 规则 |
| --- | --- |
| `slug` | 目标收藏馆的稳定 slug |
| `format` | 当前只允许 `xlsx` |
| 登录状态 | 必须已登录 |
| 借阅证 | 当前用户借阅证状态必须为 `ACTIVE` |
| 导出范围 | 目标馆内全部 `BOOK + APPROVED + isPublic=true` 记录，不受页面当前搜索、筛选和分页影响 |
| 自己的收藏馆 | 本功能定位为导出其他人的书单；请求自己的馆时返回 `403`，错误码 `OWN_COLLECTION_EXPORT_NOT_ALLOWED` |

成功响应为二进制文件：

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename*=UTF-8''%E5%B2%A9%E5%A2%83%E6%9B%B8%E8%88%8D-%E5%85%AC%E5%BC%80%E4%B9%A6%E5%8D%95-2026-10-03.xlsx
Cache-Control: private, no-store
```

表格建议列顺序：

| 列名 | 字段／来源 |
| --- | --- |
| 编号 | `serialNumber` |
| 书名 | `title` |
| 作者 | `creator` |
| 作者年代 | `era` |
| 刊刻年份 | `eraDetail` |
| 刊刻时间 | `publicationDate` |
| 刊刻主体 | `imprintPublisher` |
| 版本 | `editionOrCategory` |
| 装帧 | `binding` |
| 分类 | `categories`，多项使用中文分号连接 |
| 册数 | `volumeCount` |
| 公开说明 | `description` |

工作簿可在首行或单独的“导出信息”工作表中注明收藏馆名称、收藏者公开名称和导出时间。不得导出收藏者邮箱、真实用户 ID、私有图片地址、审核记录、价格及任何未公开字段。

失败响应使用 JSON：

| 状态码 | `code` | 场景 |
| --- | --- | --- |
| `400` | `UNSUPPORTED_EXPORT_FORMAT` | `format` 不是 `xlsx` |
| `401` | `AUTH_REQUIRED` | 未登录或会话失效 |
| `403` | `CARD_REQUIRED` | 当前用户尚未办理借阅证 |
| `403` | `CARD_INACTIVE` | 借阅证不是 `ACTIVE` 状态 |
| `403` | `OWN_COLLECTION_EXPORT_NOT_ALLOWED` | 尝试通过此入口导出自己的收藏馆 |
| `404` | `COLLECTION_NOT_FOUND` | 收藏馆不存在或已不公开 |
| `404` | `NO_PUBLIC_BOOKS` | 收藏馆没有可导出的公开书籍 |
| `500` | `EXPORT_FAILED` | 文件生成失败 |

权限验收必须至少覆盖：匿名用户、无借阅证用户、失效借阅证用户、有效借阅证用户，以及包含私有书籍和待审核书籍的目标收藏馆。

## 5. 收藏馆资料设置接口

建议新增一对一资料模型：

```text
PersonalCollectionProfile
├── id
├── ownerId              唯一，关联 User
├── slug                 唯一、稳定
├── displayName
├── description          可为空
├── publicCollectorName  可为空，公开称呼
├── themes               字符串数组，默认 []
├── primaryEras          字符串数组，默认 []
├── primaryRegion        可为空
├── collectingSinceYear  可为空
├── originStory          可为空
├── collaborationInterests 字符串数组，默认 []
├── acceptsMessages      可为空；null 表示未设置
├── coverMediaId         可为空，关联 MediaAsset
├── createdAt
└── updatedAt
```

### PP-01：读取当前用户收藏馆资料

```http
GET /api/personal-collection/profile
```

需要登录。资料不存在时，后端可 upsert 创建，也可返回默认资料。

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

没有封面时 `cover` 返回 `null`。

### PP-02：读取可选封面

```http
GET /api/personal-collection/profile/cover-options
```

需要登录。

成功响应：

```json
{
  "items": [
    {
      "mediaId": "media_001",
      "itemId": "item_001",
      "itemTitle": "清真指南",
      "itemType": "BOOK",
      "url": "/api/personal-collection/public/item_001/media/media_001"
    }
  ]
}
```

只能返回当前用户拥有、所属内容已审核公开且媒体为 `PUBLIC` 的图片。

### PP-03：保存收藏馆资料

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

恢复系统默认封面时提交：

```json
{
  "displayName": "岩境書舍",
  "description": "收藏清代至民国时期的汉文回教古籍。",
  "coverMediaId": null
}
```

成功返回与 PP-01 相同的完整资料对象。

字段规则：

- `displayName`：去除首尾空格，必填，2–40 字。
- `description`：去除首尾空格，选填，最多 300 字。
- `publicCollectorName`：选填，最多 20 字；为空时公开页使用账号公开名称回退。
- `themes`：选填，最多 5 项；每项去除首尾空格、去重且不超过 20 字。
- `primaryEras`：选填，最多 5 项；每项去除首尾空格并去重。
- `primaryRegion`：选填，最多 60 字，不应填写详细地址。
- `collectingSinceYear`：选填，四位整数，不得晚于当前年份。
- `originStory`：选填，最多 500 字。
- `collaborationInterests`：选填数组，当前允许 `学术研究`、`版本鉴定`、`数字化合作`、`展览借展`。
- `acceptsMessages`：选填布尔值；`null` 表示未设置，只有明确为 `false` 时隐藏公开页联系入口。
- `coverMediaId`：必须属于当前用户，并满足公开封面资格。
- 收藏馆名称不要求唯一。
- `slug` 唯一且稳定，本接口不可修改。

资料保存后，PC-01、PC-02 和 PS-01 必须立即读取最新名称、简介、扩展资料和封面。PC-02 应返回全部扩展资料；PC-01 只需返回目录卡片实际使用的字段。

封面所属内容被撤回、隐藏或删除，以及封面图片被删除时，后端必须清空 `coverMediaId`。

## 6. 公开馆藏信息检索接口

### PS-01：跨收藏馆检索公开书籍和文物

```http
GET /api/personal-collections/items?q=&type=&page=1&limit=24
```

无需登录。只检索公开馆藏的基本信息。

参数：

| 参数 | 规则 |
| --- | --- |
| `q` | 可选，最长 100 字 |
| `type` | 可选，只允许 `BOOK` 或 `ARTIFACT` |
| `page` | 正整数，默认 1 |
| `limit` | 正整数，默认 24，最大 48 |

`q` 匹配范围：

- 题名。
- 作者、制作者或来源。
- 年代。
- 分类。
- 版本。
- 收藏编号。
- 收藏馆名称。
- 收藏者公开名称。

成功响应：

```json
{
  "items": [
    {
      "id": "item_001",
      "type": "BOOK",
      "title": "清真指南",
      "creator": "马注",
      "era": "清",
      "category": "伊斯兰思想、哲学",
      "editionOrCategory": "木刻本",
      "serialNumber": "PC-0005",
      "cover": {
        "itemId": "item_001",
        "mediaId": "media_001",
        "url": "/api/personal-collection/public/item_001/media/media_001"
      },
      "collection": {
        "slug": "yan-jing-shu-she",
        "name": "岩境書舍",
        "ownerName": "张三"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 1,
    "totalPages": 1
  }
}
```

无搜索结果返回 `200`、`items: []` 和正确的分页信息。

## 7. 藏友私信／站内信接口

V1 范围：一对一纯文本会话、发送、接收和已读状态。不包含群聊、附件、删除、撤回、富文本和实时推送。

### 7.1 数据结构

参与者：

```json
{
  "displayName": "岩境書舍",
  "collectionSlug": "yan-jing-shu-she",
  "collectionName": "岩境書舍"
}
```

消息：

```json
{
  "id": "message_001",
  "body": "想请教这册书的版本信息。",
  "sentAt": "2026-09-25T08:00:00.000Z",
  "sender": "SELF"
}
```

`sender` 相对当前登录用户只返回 `SELF` 或 `OTHER`，不返回发送者用户 ID。

会话摘要：

```json
{
  "id": "conversation_001",
  "participant": {
    "displayName": "岩境書舍",
    "collectionSlug": "yan-jing-shu-she",
    "collectionName": "岩境書舍"
  },
  "lastMessage": {
    "id": "message_001",
    "body": "想请教这册书的版本信息。",
    "sentAt": "2026-09-25T08:00:00.000Z",
    "sender": "SELF"
  },
  "unreadCount": 0,
  "updatedAt": "2026-09-25T08:00:00.000Z"
}
```

### MSG-01：会话列表

```http
GET /api/messages/conversations?page=1&limit=50
```

需要登录。

成功响应：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 0,
    "totalPages": 0
  }
}
```

会话按 `updatedAt` 倒序排列。

### MSG-02：会话详情

```http
GET /api/messages/conversations/:conversationId
```

需要登录，只允许会话参与者读取。

成功响应为会话摘要字段加：

```json
{
  "messages": [
    {
      "id": "message_001",
      "body": "想请教这册书的版本信息。",
      "sentAt": "2026-09-25T08:00:00.000Z",
      "sender": "SELF"
    }
  ]
}
```

第一版可以返回完整消息列表；数据量增大后再为消息增加游标分页。

### MSG-03：从公开收藏馆发起私信

```http
POST /api/messages/conversations
Content-Type: application/json
```

请求体：

```json
{
  "recipientCollectionSlug": "yan-jing-shu-she",
  "body": "想请教这册书的版本信息。"
}
```

需要登录。

业务规则：

- 前端提交公开收藏馆 slug，不提交对方用户 ID。
- 后端根据 slug 解析接收者。
- 不能给自己发私信。
- 收藏馆不存在、没有公开内容或不能接收消息时返回 `404` 或 `409`。
- 如果双方已有会话，则在原会话追加消息。
- 成功返回完整会话详情。

### MSG-04：回复消息

```http
POST /api/messages/conversations/:conversationId/messages
Content-Type: application/json
```

请求体：

```json
{
  "body": "谢谢您的关注。"
}
```

需要登录且当前用户必须是会话参与者。成功返回更新后的完整会话详情。

### MSG-05：标记会话已读

```http
PATCH /api/messages/conversations/:conversationId/read
```

需要登录且当前用户必须是会话参与者。

成功响应：

```json
{
  "unreadCount": 0
}
```

### 7.2 消息校验和安全要求

- 消息为纯文本。
- 去除首尾空格后长度为 1–1000 字。
- 只能读取自己参与的会话；其他会话统一返回 `404`。
- 建议限制单位时间内的发送次数，超限返回 `429`。
- 后端必须防止 HTML／脚本注入和批量垃圾消息。
- 接口不得返回邮箱、真实用户 ID、角色或登录信息。
- V1 不要求 WebSocket；页面刷新或重新进入时获取最新消息即可。

## 8. 已存在并继续复用的接口

以下接口已经存在，不需要重复开发，但新的公开目录、搜索和馆页应继续使用其 URL：

### 公开单件详情

```http
GET /api/personal-collection/public/:itemId
```

### 公开单件图片

```http
GET /api/personal-collection/public/:itemId/media/:mediaId
```

这两个接口已经限制内容必须为 `APPROVED + isPublic=true`，图片必须为 `PUBLIC`。

## 9. 推荐后端实现顺序

1. 新增 `PersonalCollectionProfile` 数据模型和迁移。
2. 实现 PP-01、PP-02、PP-03。
3. 实现 PC-01、PC-02，并读取收藏馆资料。
4. 实现 PC-03，复用 PC-02 的公开书籍过滤逻辑并校验借阅证。
5. 实现 PS-01，复用 PC-02 的公开内容过滤逻辑。
6. 实现消息会话和消息数据模型。
7. 实现 MSG-01 至 MSG-05。
8. 增加权限、隐私、分页、封面失效、导出和消息越权测试。

## 10. 联调验收顺序

### 收藏馆与检索

1. 使用至少两个测试用户，每人准备公开和私有内容。
2. 验证目录只出现拥有公开内容的用户。
3. 验证馆页、类型筛选、搜索和分页。
4. 修改收藏馆名称、简介和封面，刷新公开页面验证更新。
5. 撤回或删除封面所属内容，验证默认封面回退。
6. 验证跨馆检索不会出现草稿、私有内容或私有图片。
7. 分别用匿名、无证、失效证和有效证账号测试书单导出。
8. 验证导出的表格包含全部公开书籍，且不包含私有、待审核记录和隐私字段。

### 站内信

1. 用户 A 从用户 B 的公开收藏馆发起私信。
2. 用户 B 的会话列表出现未读数量。
3. 用户 B 打开会话后未读数清零。
4. 用户 B 回复，用户 A 能在重新进入后看到回复。
5. 验证不能给自己发信，不能读取第三方会话。
6. 验证空消息、超长消息、登录失效和频率限制提示。

## 11. 前端切换真实接口时的清理项

- 删除 `public-collections-data.ts` 中的公开收藏馆、馆页和跨馆检索 Mock。
- 收藏馆设置和站内信已改为仅使用真实 API；接口异常时显示错误，不再使用 `localStorage` Mock 回退。
- 保留现有 TypeScript 类型，并以本文响应结构为准。
- 所有读取接口使用 `cache: "no-store"`，或者由后端提供明确的缓存失效策略。
- 完成桌面端和手机端的真实数据联调。

