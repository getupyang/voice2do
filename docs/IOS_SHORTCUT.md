# iOS 捷径配置文档

## 当前捷径

捷径名称：**voice2do**

### 步骤

| # | 动作 | 设置 |
|---|------|------|
| 1 | 录音 | 结束录制：在 35 秒后 |
| 2 | 编码录制的音频 | 仅音频：开，格式：AIFF |
| 3 | 获取 URL 内容 | `POST https://voice2do.vercel.app/api/voice`，请求体为文件 |
| 4 | 获取词典值 | 从 URL 结果中获取 `success` 的值 |
| 5 | 如果 success = true | 显示通知：`✓ 已记录` |
| 6 | 否则 | 显示通知：`✗ 录音保存失败，请重试` |

### 录音

- **结束录制**：在时长之后
- **时长**：35 秒

AIFF 是未压缩音频，过长录音会接近 Vercel request body 限制。当前先使用 35 秒作为稳定上限。

### 编码录制的音频

- **仅音频**：开
- **格式**：AIFF

### 获取 URL 内容

- **URL**：

```text
https://voice2do.vercel.app/api/voice
```

- **方法**：POST
- **头部**：
  - `device_name`: `Getup`（Nono 的手机改为 `Nono`）
- **请求体**：文件
- **文件**：编码后的媒体

成功时接口会返回转写后的文本和音频 URL。失败时会返回 `success: false` 和错误原因。

### 音频处理说明

iOS 捷径编码出的 AIFF 格式会在后端被转为 WAV 格式存储：

1. 后端提取 AIFF/WAV 中的 PCM 数据
2. 转成 16kHz、16bit、单声道 PCM 给讯飞转写
3. 包装为 WAV 上传到 Supabase Storage
4. WAV 用于网页端播放，转写文本用于 memo 展示
