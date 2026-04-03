// 意图数据：日历事件
export interface CalendarIntentData {
  title: string;
  datetime: string;        // ISO 8601，Asia/Shanghai
  end_datetime?: string;
  location?: string;
  is_all_day: boolean;
  notes?: string;
}

// 意图数据：代办事项
export interface TodoIntentData {
  title: string;
  due_date?: string;       // YYYY-MM-DD
  notes?: string;
}

// 备忘记录类型
export interface Memo {
  id: string;
  created_at: string;
  raw_text: string;
  cleaned_text: string;
  intent: 'memo' | 'movie' | 'place' | 'todo' | 'calendar';
  intent_data: CalendarIntentData | TodoIntentData | Record<string, unknown> | null;
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
