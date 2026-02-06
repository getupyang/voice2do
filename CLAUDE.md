# Voice2Do - AI 开发上下文

> 本文件为 AI 编程助手提供项目上下文，确保代码风格和架构的一致性。

## 与 Claude 的协作规则

**核心原则：信息先对齐，方案先确认，再动手**

当用户提出一个方案时，如果 Claude 知道该方案存在技术限制、潜在风险、或有更优选择，应该：

1. **先暂停**，不要直接动手写代码
2. **告知用户相关的技术信息**（比如"HTTP 头部不支持中文"）
3. **列出可选方案的优劣**
4. **等用户决策后再开始写代码**

避免：在用户信息不完整时，直接按用户的方案执行，导致返工。

## 项目概述

Voice2Do 是一个语音备忘录应用：
- 用户通过 iOS 捷径录制语音，上传到后端
- 后端用讯飞 API 转写语音为文字
- 前端以时间轴方式展示所有备忘

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: Supabase (PostgreSQL)
- **语音转文字**: 讯飞中英识别大模型 API（WebSocket）
- **部署**: Vercel

## 项目结构

```
voice2do/
├── docs/                     # 项目文档
│   ├── PRD.md               # 产品需求文档
│   ├── DATABASE.md          # 数据库设计
│   ├── API.md               # 接口文档
│   └── CHANGELOG.md         # 版本记录
├── src/
│   ├── app/                 # Next.js 页面和API
│   │   ├── api/voice/       # 语音上传接口
│   │   ├── api/memos/       # 备忘查询接口
│   │   ├── page.tsx         # 首页时间轴
│   │   ├── layout.tsx       # 全局布局
│   │   └── globals.css      # 全局样式
│   ├── components/          # React组件
│   ├── lib/                 # 工具函数
│   │   ├── supabase.ts      # Supabase 客户端
│   │   ├── iflytek.ts       # 讯飞语音转写 API
│   │   ├── audio.ts         # 音频格式处理（WAV/AIFF → PCM）
│   │   └── utils.ts         # 通用工具
│   └── types/               # TypeScript类型定义
├── public/                  # 静态资源
├── .env.local               # 环境变量（不提交）
├── .env.example             # 环境变量模板
└── CLAUDE.md                # 本文件
```

## 环境变量

```
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
IFLYTEK_APPID=xxx
IFLYTEK_API_KEY=xxx
IFLYTEK_API_SECRET=xxx
```

## 数据库表

### memos
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| created_at | timestamptz | 创建时间 |
| raw_text | text | 原始转写文本 |
| cleaned_text | text | 去除语气词后的文本 |
| intent | text | 意图类型 (memo/movie/place)，默认 memo |
| intent_data | jsonb | 结构化意图数据 |
| user_id | uuid | 用户ID（预留） |
| device_id | text | 设备标识（预留） |
| status | text | 状态 (active/done/archived) |

## 编码规范

1. **组件**: 使用函数式组件 + hooks
2. **样式**: 优先使用 Tailwind CSS 类名
3. **API**: 使用 Next.js Route Handlers
4. **类型**: 所有函数参数和返回值都要有 TypeScript 类型
5. **命名**:
   - 组件文件: PascalCase (如 `MemoCard.tsx`)
   - 工具文件: camelCase (如 `supabase.ts`)
   - CSS类名: kebab-case

## 设计规范

- **风格**: 简约、温暖、有格调
- **字体**: 使用非工业化的衬线或手写风格字体
- **颜色**: 暖色调为主，避免冷色
- **布局**: 大量留白，卡片圆角，柔和阴影

## 版本计划

- **v0.1**: 语音上传 + 时间轴展示（纯 memo）
- **v0.2**: 意图识别 + 电影分类

## 常用命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run lint     # 代码检查
```
