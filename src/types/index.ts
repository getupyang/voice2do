// 备忘记录类型
export interface Memo {
  id: string;
  created_at: string;
  raw_text: string;
  cleaned_text: string;
  intent: 'memo' | 'movie' | 'place' | 'todo';
  intent_data: Record<string, unknown> | null;
  user_id: string | null;
  device_id: string | null;
  status: 'active' | 'done' | 'archived';
  // 完成记录专用字段（需执行 supabase/migrations/20260309_add_completion_fields.sql）
  completed_at: string | null;
  completion_note: string | null;
  completion_image_url: string | null;
}

// 创建备忘的输入类型
export interface CreateMemoInput {
  raw_text: string;
  cleaned_text: string;
  intent?: string;
  intent_data?: Record<string, unknown>;
  device_id?: string;
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 时间轴分组类型
export interface TimelineGroup {
  label: string;        // 显示的标签，如 "今天"、"昨天"、"2024年1月"
  type: 'day' | 'month' | 'year';
  memos: Memo[];
}
