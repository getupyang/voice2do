# Voice2Do 数据库设计

## 数据库信息

- **平台**: Supabase
- **URL**: `https://ecctoixndgjycpounyfd.supabase.co`

## 变更记录

| 日期 | 操作 | 执行人 | 说明 |
|------|------|--------|------|
| 2025-01-30 | 建表 | 用户 | 执行了 memos 表的创建 SQL，包含索引 |
| 2025-01-30 | 测试数据 | 用户 | 插入了一条测试记录 |
| 2026-03-09 | 加字段 | Claude | 添加完成记录专用字段（见迁移文件） |

## 表结构

### memos 表

存储所有语音备忘记录。

```sql
create table memos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,

  -- 核心字段
  raw_text text not null,           -- Gemini转写的原始文本
  cleaned_text text not null,       -- 去除语气词后的文本

  -- 意图识别（v0.2）
  intent text default 'memo',       -- 意图类型: memo/movie/place
  intent_data jsonb,                -- 结构化数据，如 {"movie_name": "沙丘"}

  -- 扩展字段（预留）
  user_id uuid,                     -- 用户ID（未来多用户）
  device_id text,                   -- 设备标识
  status text default 'active',     -- 状态: active/done/archived

  -- 完成记录字段（执行 supabase/migrations/20260309_add_completion_fields.sql 添加）
  completed_at timestamptz,         -- 标记完成的时间
  completion_note text,             -- 完成时的文字备注（可选）
  completion_image_url text         -- 完成时上传的图片 URL（可选）
);

-- 索引
create index memos_created_at_idx on memos(created_at desc);
create index memos_intent_idx on memos(intent);
create index memos_status_idx on memos(status);
create index memos_completed_at_idx on memos(completed_at desc);
```

## 字段说明

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | 是 | 自动生成 | 主键 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| raw_text | text | 是 | - | 语音转文字的原始结果 |
| cleaned_text | text | 是 | - | 去除语气词后的干净文本 |
| intent | text | 否 | 'memo' | 意图类型 |
| intent_data | jsonb | 否 | null | 意图相关的结构化数据 |
| user_id | uuid | 否 | null | 用户ID（预留） |
| device_id | text | 否 | null | 设备标识（预留） |
| status | text | 否 | 'active' | 记录状态 |
| completed_at | timestamptz | 否 | null | 标记完成时间 |
| completion_note | text | 否 | null | 完成时的文字备注 |
| completion_image_url | text | 否 | null | 完成时上传的图片 URL |

## intent 类型

| 值 | 说明 | intent_data 示例 |
|----|------|------------------|
| memo | 普通备忘（默认） | null |
| movie | 电影 | `{"movie_name": "沙丘2"}` |
| place | 地点 | `{"place_name": "古天文台"}` |
| todo | 待办 | `{"deadline": "2024-02-01"}` |

## 查询示例

### 获取所有 memo（时间倒序）
```sql
select * from memos
where status = 'active'
order by created_at desc;
```

### 获取电影类型的 memo
```sql
select * from memos
where intent = 'movie' and status = 'active'
order by created_at desc;
```

### 按时间分组统计
```sql
select
  date_trunc('day', created_at) as day,
  count(*) as count
from memos
where created_at > now() - interval '30 days'
group by day
order by day desc;
```
