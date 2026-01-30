# Voice2Do API 接口文档

## 基础信息

- **Base URL**: `https://voice2do.vercel.app` (部署后替换)
- **Content-Type**: 见各接口说明

---

## 接口列表

### 1. 上传语音

上传语音文件，自动转写为文字并保存。

**请求**

```
POST /api/voice
Content-Type: audio/m4a 或 audio/mpeg 或 audio/wav
Body: 音频文件二进制数据
```

**响应**

成功 (200):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "raw_text": "那个，我想去古天文台",
    "cleaned_text": "我想去古天文台",
    "intent": "memo",
    "created_at": "2024-01-30T10:00:00Z"
  }
}
```

失败 (400/500):
```json
{
  "success": false,
  "error": "错误信息"
}
```

**iOS 捷径配置**

1. 添加「录制音频」操作
2. 添加「获取 URL 内容」操作
   - URL: `https://你的域名/api/voice`
   - 方法: POST
   - 请求体: 文件
   - 文件: 录制的音频

---

### 2. 获取备忘列表

获取所有备忘记录。

**请求**

```
GET /api/memos
```

**参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| intent | string | 否 | - | 筛选意图类型 (memo/movie/place) |
| limit | number | 否 | 100 | 返回数量 |
| status | string | 否 | active | 状态筛选 |

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "raw_text": "那个，我想去古天文台",
      "cleaned_text": "我想去古天文台",
      "intent": "memo",
      "intent_data": null,
      "created_at": "2024-01-30T10:00:00Z",
      "status": "active"
    }
  ]
}
```

---

### 3. 获取单条备忘

根据 ID 获取单条备忘详情。

**请求**

```
GET /api/memos/[id]
```

**响应**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "raw_text": "那个，我想去古天文台",
    "cleaned_text": "我想去古天文台",
    "intent": "memo",
    "intent_data": null,
    "created_at": "2024-01-30T10:00:00Z",
    "status": "active"
  }
}
```

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 测试命令

### 测试语音上传

```bash
# 上传本地音频文件
curl -X POST \
  -H "Content-Type: audio/m4a" \
  --data-binary @test.m4a \
  https://你的域名/api/voice
```

### 测试获取列表

```bash
curl https://你的域名/api/memos
```
