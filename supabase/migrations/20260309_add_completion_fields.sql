-- 为 memos 表添加完成记录专用字段
-- 执行方式：在 Supabase Dashboard > SQL Editor 中运行

ALTER TABLE memos
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_note    TEXT,
  ADD COLUMN IF NOT EXISTS completion_image_url TEXT;

-- 索引：快速查询已完成记录
CREATE INDEX IF NOT EXISTS memos_status_idx ON memos(status);
CREATE INDEX IF NOT EXISTS memos_completed_at_idx ON memos(completed_at DESC);
