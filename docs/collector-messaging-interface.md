# 藏友私信／站内信：前后端接口约定

## 功能边界

登录用户可以从公开收藏馆联系收藏者，在站内信中查看会话、回复消息和看到未读状态。V1 不提供群聊、附件、删除、撤回、富文本和实时推送。

发起私信时，前端提交公开收藏馆 `slug`，不要求公开接收者用户 ID。

## 数据结构

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

`sender` 只返回相对当前登录用户的 `SELF` 或 `OTHER`，不向前端暴露用户 ID。

## 接口

### 会话列表

```http
GET /api/messages/conversations?page=1&limit=50
```

响应：`{ "items": ConversationSummary[], "pagination": {...} }`。

### 会话详情

```http
GET /api/messages/conversations/:conversationId
```

响应为会话摘要字段加：

```json
{ "messages": [{ "id": "message_001", "body": "...", "sentAt": "...", "sender": "SELF" }] }
```

### 从公开收藏馆发起私信

```http
POST /api/messages/conversations
Content-Type: application/json

{ "recipientCollectionSlug": "yan-jing-shu-she", "body": "想请教这册书的版本信息。" }
```

若双方已有会话，返回已有会话并追加消息；不能给自己发信。成功返回完整会话详情。

### 回复消息

```http
POST /api/messages/conversations/:conversationId/messages
Content-Type: application/json

{ "body": "谢谢您的关注。" }
```

### 标为已读

```http
PATCH /api/messages/conversations/:conversationId/read
```

成功响应：`{ "unreadCount": 0 }`。

## 校验与权限

- 所有接口都需要登录；未登录返回 `401`。
- 消息纯文本，去除首尾空格，长度 1–1000 字。
- 只能读取自己参与的会话，否则返回 `404`，避免泄露会话是否存在。
- 收藏馆不存在、没有公开内容或不能接收消息时返回 `404` 或 `409`。
- 接口不得返回邮箱、真实用户 ID、角色、登录信息或其他私密资料。
- 建议后端增加发送频率限制和敏感内容治理能力。

统一错误响应：`{ "message": "面向用户的错误说明" }`。

## 前端状态

页面位于 `/messages`；公开收藏馆的“联系收藏者”链接使用 `/messages?collection=:slug`。当前开发环境在接口 `404` 时使用 localStorage Mock，接口上线后删除 Mock 回退。

