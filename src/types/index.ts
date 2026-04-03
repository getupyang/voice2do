// todo 意图的结构化数据
// - 有 datetime 字段 → 时间型任务，iOS 捷径写入「Voice2Do」日历
// - 无 datetime 只有 deadline 或无日期 → 代办任务，iOS 捷径写入「Voice2Do」提醒
export interface TodoIntentData {
  title: string;
  datetime?: string;       // ISO 8601 +08:00，有具体时间时存在
  end_datetime?: string;
  location?: string;
  is_all_day?: boolean;
  deadline?: string;       // YYYY-MM-DD，截止日期（无具体时分时用）
  notes?: string;
}

// 备忘记录类型
export interface Memo {
  id: string;
  created_at: string;
  raw_text: string;
  cleaned_text: string;
  intent: 'memo' | 'movie' | 'place' | 'todo';
  intent_data: TodoIntentData | Record<string, unknown> | null;
  user_id: string | null;
  device_id: string | null;
  status: 'active' | 'done' | 'archived';
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
