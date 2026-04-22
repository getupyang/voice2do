// 意图类型
export type IntentType = 'memo' | 'movie' | 'place' | 'todo';

// 意图标签映射
export const INTENT_LABELS: Record<IntentType, string> = {
  movie: '电影',
  place: '目的地',
  todo: '要做的事',
  memo: '记录',
};

// 意图结构化数据
export interface MovieIntentData {
  title: string;
  reason?: string;
}

export interface PlaceIntentData {
  name: string;
  reason?: string;
}

export interface TodoIntentData {
  task: string;
}

export type IntentData = MovieIntentData | PlaceIntentData | TodoIntentData | null;

// 日历事件数据
export interface CalendarEvent {
  title: string;
  start_time: string;       // ISO 8601, e.g. "2026-04-18T14:00:00"
  end_time?: string;         // 可选，默认 start_time + 1h
  all_day?: boolean;         // 全天事件
  location?: string;         // 地点
  notes?: string;            // 备注
}

// 备忘记录类型
export interface Memo {
  id: string;
  created_at: string;
  raw_text: string;
  cleaned_text: string;
  intent: IntentType;
  intent_data: IntentData;
  calendar_event: CalendarEvent | null;
  calendar_synced: boolean;
  user_id: string | null;
  device_id: string | null;
  status: 'active' | 'done' | 'archived' | 'pending' | 'error';
  audio_url: string | null;
  completed_at: string | null;
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
