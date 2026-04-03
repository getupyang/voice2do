import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface CalendarIntentData {
  title: string;
  datetime: string;        // ISO 8601, Asia/Shanghai
  end_datetime?: string;
  location?: string;
  is_all_day: boolean;
  notes?: string;
}

export interface TodoIntentData {
  title: string;
  due_date?: string;       // YYYY-MM-DD
  notes?: string;
}

export interface MemoIntentData {
  title?: string;
}

export interface ClassificationResult {
  intent: "calendar" | "todo" | "memo";
  cleaned_text: string;
  intent_data: CalendarIntentData | TodoIntentData | MemoIntentData | null;
}

const SYSTEM_PROMPT = `你是一个中文语音备忘录助手，负责分析转写的语音内容，去除语气词并提取结构化信息。

判断规则：
- intent = "calendar"：内容涉及具体时间安排（会议、约会、出行、活动、提醒我几点做什么等），**只要能识别到时间或地点就用 calendar**
- intent = "todo"：需要完成的任务或代办事项（买东西、联系某人、处理某件事），但没有具体时间
- intent = "memo"：其他情况（想法、灵感、随手记录）

时间解析规则：
- 所有时间转为 ISO 8601 格式，时区 +08:00
- "明天" = 当前日期 +1 天
- "后天" = 当前日期 +2 天
- "下周X" = 下一个周X
- 未指定具体时分时：会议/约会默认1小时；提醒类用 is_all_day: true
- 若只说了时间没说日期，默认今天；若今天的那个时间已过，用明天

返回严格的 JSON，不要有任何额外文字，格式如下：

对于 calendar：
{
  "intent": "calendar",
  "cleaned_text": "去除语气词后的简洁文本",
  "intent_data": {
    "title": "简短标题（15字以内）",
    "datetime": "2026-04-04T14:00:00+08:00",
    "end_datetime": "2026-04-04T15:00:00+08:00",
    "location": "地点（如有，否则省略该字段）",
    "is_all_day": false,
    "notes": "补充说明（如有，否则省略）"
  }
}

对于 todo：
{
  "intent": "todo",
  "cleaned_text": "去除语气词后的简洁文本",
  "intent_data": {
    "title": "简短标题（15字以内）",
    "due_date": "2026-04-05",
    "notes": "补充说明（如有，否则省略）"
  }
}

对于 memo：
{
  "intent": "memo",
  "cleaned_text": "去除语气词后的简洁文本",
  "intent_data": null
}`;

export async function classifyMemo(
  text: string,
  now: Date = new Date()
): Promise<ClassificationResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const nowStr = now.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
  });

  const prompt = `${SYSTEM_PROMPT}

当前时间：${nowStr}

语音转写文本：
${text}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // 去掉可能的 markdown 代码块包裹
    const jsonText = responseText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const parsed = JSON.parse(jsonText) as ClassificationResult;

    // 确保字段完整
    if (!parsed.intent) parsed.intent = "memo";
    if (!parsed.cleaned_text) parsed.cleaned_text = text;

    return parsed;
  } catch (err) {
    console.error("Gemini classification failed:", err);
    // 降级：返回原始文本作为 memo
    return {
      intent: "memo",
      cleaned_text: text,
      intent_data: null,
    };
  }
}
