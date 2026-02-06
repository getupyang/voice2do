// 意图类型
export type IntentType = 'memo' | 'movie' | 'place';

// 意图标签映射（仅 movie 和 place 在前端显示 tag）
export const INTENT_LABELS: Record<IntentType, string> = {
  movie: '电影',
  place: '目的地',
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

export type IntentData = MovieIntentData | PlaceIntentData | null;

// 备忘记录类型
export interface Memo {
  id: string;
  created_at: string;
  raw_text: string;
  cleaned_text: string;
  intent: IntentType;
  intent_data: IntentData;
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
