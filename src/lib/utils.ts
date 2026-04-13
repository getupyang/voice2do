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
 * 获取 Asia/Shanghai 时区的日期部分
 */
function toShanghaiDate(date: Date): { year: number; month: number; day: number; dateStr: string } {
  const formatted = date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  // sv-SE locale 输出格式为 YYYY-MM-DD
  const [year, month, day] = formatted.split('-').map(Number);
  return { year, month, day, dateStr: formatted };
}

/**
 * 将备忘按时间分组（统一使用 Asia/Shanghai 时区）
 * - 近1月：按天
 * - 1月-1年：按月
 * - 超1年：按年
 */
export function groupMemosByTime(memos: Memo[]): TimelineGroup[] {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const nowSh = toShanghaiDate(now);
  const groups: Map<string, TimelineGroup> = new Map();

  for (const memo of memos) {
    const date = new Date(memo.created_at);
    const dateSh = toShanghaiDate(date);
    let key: string;
    let label: string;
    let type: 'day' | 'month' | 'year';

    if (date >= oneMonthAgo) {
      // 近1月：按天分组
      type = 'day';

      if (dateSh.dateStr === nowSh.dateStr) {
        key = 'today';
        label = '今天';
      } else {
        // 计算与今天相差的天数
        const nowDayStart = new Date(`${nowSh.dateStr}T00:00:00+08:00`).getTime();
        const dateDayStart = new Date(`${dateSh.dateStr}T00:00:00+08:00`).getTime();
        const dayDiff = Math.round((nowDayStart - dateDayStart) / (24 * 60 * 60 * 1000));

        if (dayDiff === 1) {
          key = 'yesterday';
          label = '昨天';
        } else {
          key = `day-${dateSh.dateStr}`;
          label = `${dateSh.month}月${dateSh.day}日`;
        }
      }
    } else if (date >= oneYearAgo) {
      // 1月-1年：按月分组
      type = 'month';
      key = `month-${dateSh.year}-${dateSh.month}`;
      label = `${dateSh.year}年${dateSh.month}月`;
    } else {
      // 超1年：按年分组
      type = 'year';
      key = `year-${dateSh.year}`;
      label = `${dateSh.year}年`;
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
  return date.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
