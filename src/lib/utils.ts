import { Memo, TimelineGroup } from '@/types';

/**
 * 去除语音转写中的语气词
 */
export function cleanTranscription(text: string): string {
  // 常见的中文语气词
  const fillerWords = [
    '额', '嗯', '啊', '呃', '哦', '噢',
    '那个', '就是', '然后', '所以说',
    '对吧', '你知道', '怎么说呢',
  ];

  let cleaned = text;

  // 移除开头的语气词
  for (const word of fillerWords) {
    const startPattern = new RegExp(`^${word}[，,、\\s]*`, 'g');
    cleaned = cleaned.replace(startPattern, '');
  }

  // 移除中间重复的语气词
  for (const word of fillerWords) {
    const middlePattern = new RegExp(`[，,、\\s]*${word}[，,、\\s]*`, 'g');
    cleaned = cleaned.replace(middlePattern, '，');
  }

  // 清理多余的标点
  cleaned = cleaned
    .replace(/^[，,、\s]+/, '')     // 开头的标点
    .replace(/[，,、\s]+$/, '')     // 结尾的标点
    .replace(/[，,]{2,}/g, '，')    // 多个逗号
    .trim();

  return cleaned || text; // 如果清理后为空，返回原文
}

/**
 * 将备忘按时间分组
 * - 近1月：按天
 * - 1月-1年：按月
 * - 超1年：按年
 */
export function groupMemosByTime(memos: Memo[]): TimelineGroup[] {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const groups: Map<string, TimelineGroup> = new Map();

  for (const memo of memos) {
    const date = new Date(memo.created_at);
    let key: string;
    let label: string;
    let type: 'day' | 'month' | 'year';

    if (date >= oneMonthAgo) {
      // 近1月：按天分组
      type = 'day';
      const dayDiff = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));

      if (dayDiff === 0) {
        key = 'today';
        label = '今天';
      } else if (dayDiff === 1) {
        key = 'yesterday';
        label = '昨天';
      } else {
        key = `day-${date.toISOString().split('T')[0]}`;
        label = `${date.getMonth() + 1}月${date.getDate()}日`;
      }
    } else if (date >= oneYearAgo) {
      // 1月-1年：按月分组
      type = 'month';
      key = `month-${date.getFullYear()}-${date.getMonth()}`;
      label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
    } else {
      // 超1年：按年分组
      type = 'year';
      key = `year-${date.getFullYear()}`;
      label = `${date.getFullYear()}年`;
    }

    if (!groups.has(key)) {
      groups.set(key, { label, type, memos: [] });
    }
    groups.get(key)!.memos.push(memo);
  }

  // 按时间倒序排列
  return Array.from(groups.values());
}

/**
 * 格式化时间显示
 */
export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
