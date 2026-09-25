# 公开馆藏信息检索：前后端接口约定

## 功能边界

检索公开收藏馆中的书籍和文物基本信息，不检索书籍正文、PDF、OCR 或图片文字。游客可使用，无需登录。

## 接口

```http
GET /api/personal-collections/items?q=&type=&page=1&limit=24
```

参数：

- `q`：可选，最长 100 字；匹配题名、作者／来源、年代、分类、版本、编号、收藏馆名称和收藏者公开名称。
- `type`：可选，只允许 `BOOK` 或 `ARTIFACT`。
- `page`：正整数，默认 1。
- `limit`：正整数，默认 24，最大 48。

成功响应：

```json
{
  "items": [{
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
      "ownerName": "岩境書舍"
    }
  }],
  "pagination": { "page": 1, "limit": 24, "total": 1, "totalPages": 1 }
}
```

隐私要求：只检索 `status=APPROVED`、`isPublic=true` 的内容和 `visibility=PUBLIC` 的图片；不得返回邮箱、用户 ID、角色、审核意见、私有媒体或消息资料。

错误响应统一为：

```json
{ "message": "面向用户的错误说明" }
```

参数错误返回 `400`，服务异常返回 `500`；没有结果返回 `200` 和空数组。

## 前端状态

页面位于 `/personal-collections/search`。当前使用与响应结构一致的 Mock 聚合数据，后端接口上线后替换 `searchPublicCollectionItems()` 内的数据来源。

