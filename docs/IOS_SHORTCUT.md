# iOS 捷径配置文档

## 当前推荐捷径 (v0.3)

捷径名称：**voice2do**

目标：不要再把音频文件直接 POST 到 Vercel。新版流程先向 Vercel 申请 Supabase 上传地址，再把音频直传 Supabase，最后用一个小 JSON 请求触发后台转写。

### 步骤总览

| # | 动作 | 设置 |
|---|------|------|
| 1 | 录音 | 结束录制：在 35 秒后 |
| 2 | 编码录制的音频 | 仅音频：开，格式：AIFF |
| 3 | 获取 URL 内容 | `POST /api/voice/init`，请求体 JSON |
| 4 | 获取词典值 | 从 init 结果中取 `data.signed_url` |
| 5 | 获取词典值 | 从 init 结果中取 `data.memo_id` |
| 6 | 获取词典值 | 从 init 结果中取 `data.path` |
| 7 | 获取 URL 内容 | `PUT signed_url`，请求体为编码后的媒体文件 |
| 8 | 获取 URL 内容 | `POST /api/voice/process`，请求体 JSON |
| 9 | 获取词典值 | 从 process 结果中取 `success` |
| 10 | 如果 success = true | 显示通知：`✓ 已保存，正在转写` |
| 11 | 否则 | 显示通知：`✗ 上传失败，请重试` |

## 详细配置

### 1. 录音

- **结束录制**：在时长之后
- **时长**：35 秒

35 秒是当前 AIFF 格式下比较稳的上限。更长录音需要先完成本地缓存队列。

### 2. 编码录制的音频

- **仅音频**：开
- **格式**：AIFF

### 3. 初始化上传

动作：**获取 URL 内容**

- **URL**：

```text
https://voice2do.vercel.app/api/voice/init
```

- **方法**：POST
- **头部**：
  - `Content-Type`: `application/json`
- **请求体**：JSON
- **JSON 字段**：
  - `device_name`: `Getup` 或 `Nono`
  - `file_ext`: `aiff`

响应示例：

```json
{
  "success": true,
  "data": {
    "memo_id": "uuid",
    "path": "incoming/xxx.aiff",
    "signed_url": "https://...supabase.co/storage/v1/object/upload/sign/..."
  }
}
```

### 4. 从 init 响应取值

用「获取词典值」动作取：

- `data` → `signed_url`
- `data` → `memo_id`
- `data` → `path`

如果捷径不方便一次取嵌套字段，可以先取 `data`，再从 `data` 里分别取 `signed_url`、`memo_id`、`path`。

### 5. 直传音频到 Supabase

动作：**获取 URL 内容**

- **URL**：第 4 步拿到的 `signed_url`
- **方法**：PUT
- **头部**：
  - `Content-Type`: `audio/aiff`
- **请求体**：文件
- **文件**：第 2 步的「编码后的媒体」

这个请求不经过 Vercel，不会触发 Vercel 的 4.5MB body 限制。

### 6. 触发后台处理

动作：**获取 URL 内容**

- **URL**：

```text
https://voice2do.vercel.app/api/voice/process
```

- **方法**：POST
- **头部**：
  - `Content-Type`: `application/json`
- **请求体**：JSON
- **JSON 字段**：
  - `memo_id`: 第 4 步拿到的 `memo_id`
  - `path`: 第 4 步拿到的 `path`

成功响应示例：

```json
{
  "success": true,
  "message": "录音已上传，正在后台转写",
  "data": {
    "memo_id": "uuid",
    "status": "pending"
  }
}
```

网页会先显示「转写中」，后台完成后变成正式文本；如果讯飞失败，仍会保留错误记录。

## 已废弃配置

不要再使用下面这种配置作为主路径：

```text
POST https://voice2do.vercel.app/api/voice
请求体：文件
```

这个旧接口仍保留兼容，但它会让大音频经过 Vercel request body，容易在 iOS 捷径里卡在上传进度中间，且受 Vercel 4.5MB 限制影响。
