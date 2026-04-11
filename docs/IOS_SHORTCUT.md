# iOS 捷径配置文档

## 当前捷径 (v0.1)

捷径名称：**voice2do**

### 步骤

| # | 动作 | 设置 |
|---|------|------|
| 1 | 录音 | 默认（用户手动停止） |
| 2 | 编码录制的音频 | 仅音频: 开, 格式: **AIFF** |
| 3 | 获取 URL 内容 | 见下方详细配置 |
| 4 | 在"快速查看"中显示 | 显示 URL 的内容（API 返回的 JSON） |

### "获取 URL 内容"详细配置

- **URL**: `https://voice2do-git-claude-integrate-i-4527a0-getups-projects-3677776c.vercel.app/api/voice`
  - 注意：当前指向 preview 分支部署，生产域名待切换
- **方法**: POST
- **头部**:
  - `device_name`: `Getup`（用于标识设备/用户）
- **请求体**: 文件
  - **文件**: 编码后的媒体（步骤 2 的输出）

### 音频格式说明

iOS 捷径的"编码媒体"动作将录音编码为 **AIFF** 格式（Audio Interchange File Format）。
后端 `src/lib/audio.ts` 的 `extractPcm()` 函数支持 AIFF 解析：
- 检测 FORM magic bytes
- 提取 COMM chunk 获取采样率、位深度、声道数
- 提取 SSND chunk 获取 PCM 数据
- 大端转小端（讯飞要求小端 16bit PCM）

### 已知限制

- 录音无时长限制提示，用户需自行控制在 60 秒以内（Vercel Hobby 函数超时限制）
- 上传失败时没有错误通知（快速查看显示 JSON 但用户不一定看得懂）
- `device_name` 头部值硬编码为 Getup

---

## 计划中的捷径改动 (v0.2)

### URL 切换
- 从 preview 分支 URL 切换到 production 域名

### 错误反馈
- 解析 API 返回的 JSON
- `success: true` → 显示通知："已记录: {cleaned_text 前 20 字}"
- `success: false` → 显示通知："Voice2Do: 录音保存失败"

### 录音时长提示
- 考虑在捷径描述中标注"建议 60 秒以内"
