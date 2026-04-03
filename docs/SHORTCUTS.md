# iOS 捷径配置指南 — 日历 & 提醒同步

本文档说明如何配置 iOS 捷径，使 Voice2Do 识别出的日程和代办事项自动同步到你和对象 iPhone 上的「Voice2Do」日历和提醒事项列表。

---

## 一、前置准备：创建共享日历和提醒列表

> 只需一人操作（建议主账号操作），另一人接受邀请。

### 1. 创建共享 iCloud 日历

1. 打开 iPhone **日历** App
2. 点击底部「日历」→ 左下角「添加日历」→「添加 iCloud 日历」
3. 名称填写：**Voice2Do**
4. 颜色建议选橙色或金色（与 App 风格一致）
5. 点击右上角「完成」
6. 再次点击「Voice2Do」日历 → 滑到底部「添加联系人」
7. 输入对象的 Apple ID（邮箱），点击「添加」
8. 对方在 iPhone 上会收到邀请，接受后两边都能看到该日历

### 2. 创建共享提醒事项列表

1. 打开 iPhone **提醒事项** App
2. 点击右下角「添加列表」
3. 名称填写：**Voice2Do**
4. 图标选择一个（建议选麦克风或星星）
5. 颜色选橙色
6. 点击右上角「完成」
7. 点击「Voice2Do」列表右侧的「···」→「共享列表」
8. 输入对象的 Apple ID，点击「添加联系人」
9. 对方接受后，两边的提醒事项都会同步

---

## 二、更新 iOS 捷径

在现有的 Voice2Do 录音捷径基础上，在收到 API 响应后添加以下逻辑：

### 捷径步骤结构（完整流程）

```
[录制音频]
    ↓
[获取 URL 内容]  POST https://your-domain.com/api/voice
    文件：录制的音频
    ↓
[获取词典值]  "data" from 获取 URL 内容
    ↓
[获取词典值]  "intent" from 上一步
    ↓
[如果] intent = "calendar"
    └── [在日历中添加新事件]  （见下方参数说明）
[否则，如果] intent = "todo"
    └── [添加新提醒事项]  （见下方参数说明）
```

---

### 日历事件参数配置

当 `intent = "calendar"` 时，从 `data.intent_data` 中读取：

| 捷径字段 | 读取路径 | 说明 |
|---------|---------|------|
| 标题 | `data.intent_data.title` | 事件名称 |
| 开始日期 | `data.intent_data.datetime` | ISO 8601 时间字符串 |
| 结束日期 | `data.intent_data.end_datetime` | 可选，没有时同开始时间 +1小时 |
| 地点 | `data.intent_data.location` | 可选 |
| 备注 | `data.intent_data.notes` | 可选 |
| **日历** | Voice2Do | **必须选择「Voice2Do」共享日历** |
| 全天事件 | `data.intent_data.is_all_day` | 布尔值 |

> **关键**：「日历」字段固定选择「Voice2Do」，这样才能两边 iPhone 同步。

---

### 提醒事项参数配置

当 `intent = "todo"` 时，从 `data.intent_data` 中读取：

| 捷径字段 | 读取路径 | 说明 |
|---------|---------|------|
| 标题 | `data.intent_data.title` | 提醒事项名称 |
| 备注 | `data.intent_data.notes` | 可选 |
| 截止日期 | `data.intent_data.due_date` | 可选，YYYY-MM-DD 格式 |
| **列表** | Voice2Do | **必须选择「Voice2Do」共享列表** |

> **关键**：「列表」字段固定选择「Voice2Do」，这样才能两边 iPhone 同步。

---

## 三、API 响应格式参考

捷径需要处理的 JSON 结构：

### 日历事件响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "intent": "calendar",
    "cleaned_text": "明天下午两点和小李开会，在星巴克",
    "intent_data": {
      "title": "和小李开会",
      "datetime": "2026-04-04T14:00:00+08:00",
      "end_datetime": "2026-04-04T15:00:00+08:00",
      "location": "星巴克",
      "is_all_day": false,
      "notes": ""
    },
    "created_at": "2026-04-03T10:30:00Z"
  }
}
```

### 代办事项响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "intent": "todo",
    "cleaned_text": "买一盒鸡蛋，记得买土鸡蛋",
    "intent_data": {
      "title": "买鸡蛋",
      "notes": "记得买土鸡蛋"
    },
    "created_at": "2026-04-03T10:30:00Z"
  }
}
```

### 普通备忘响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "intent": "memo",
    "cleaned_text": "这个配色方案很好看，可以用在下一个项目里",
    "intent_data": null,
    "created_at": "2026-04-03T10:30:00Z"
  }
}
```

---

## 四、使用说明

### 触发规则（Gemini 自动识别）

| 你说的话 | 识别为 | 结果 |
|---------|--------|------|
| 「明天下午三点去医院」 | calendar | 日历事件 + 地点 |
| 「下周五和老王吃饭，在外婆家餐厅」 | calendar | 日历事件 + 地点 |
| 「提醒我买牛奶」 | todo | 提醒事项 |
| 「记得联系供应商」 | todo | 提醒事项 |
| 「这部电影名字叫奥本海默」 | memo | 普通备忘 |
| 「今天天气很好，心情不错」 | memo | 普通备忘 |

### 双端同步逻辑

```
你的 iPhone 录音
    ↓
Voice2Do 后端识别
    ↓
捷径创建「Voice2Do」日历事件 / 提醒
    ↓
iCloud 自动同步
    ↓
对象的 iPhone 收到同步（共享日历/提醒）
```

---

## 五、隐私说明

- 「Voice2Do」日历和提醒列表是独立的，不影响你原有的私人日历和提醒
- iCloud 共享是端对端加密的
- 你可以随时从日历/提醒 App 中移除共享，恢复为私人列表
