import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface TodoIntentData {
  title: string;
  datetime?: string;       // ISO 8601 +08:00，有具体时间时存在（→ iPhone 日历）
  end_datetime?: string;
  location?: string;
  is_all_day?: boolean;
  deadline?: string;       // YYYY-MM-DD，无具体时间但有截止日期（→ iPhone 提醒）
  notes?: string;
}

export interface ClassificationResult {
  intent: "todo" | "memo";
  cleaned_text: string;
  intent_data: TodoIntentData | null;
}

const SYSTEM_PROMPT = `你是一个中文语音备忘录助手，分析转写的语音内容，去除语气词并提取结构化信息。

判断规则：
- intent = "todo"：内容需要行动——包括有具体时间的日程安排（会议、约会、出行、活动），也包括无具体时间的代办事项（买东西、联系某人、处理某事）
- intent = "memo"：纯粹的记录、想法、灵感，不需要行动

时间解析规则：
- 所有时间转为 ISO 8601 格式，时区 +08:00
- "明天" = 当前日期 +1 天
- "后天" = 当前日期 +2 天
- "下周X" = 下一个周X
- 只说了时间没说日期：今天；若今天该时间已过则用明天
- 有具体时分时填 datetime；只有日期没有时分时填 deadline

返回严格的 JSON，不要有任何额外文字。

有具体时间的待办（→ iPhone 日历）：
{
  "intent": "todo",
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

无具体时间的代办事项（→ iPhone 提醒）：
{
  "intent": "todo",
  "cleaned_text": "去除语气词后的简洁文本",
  "intent_data": {
    "title": "简短标题（15字以内）",
    "deadline": "2026-04-05",
    "notes": "补充说明（如有，否则省略）"
  }
}

普通备忘：
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

    const jsonText = responseText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const parsed = JSON.parse(jsonText) as ClassificationResult;

    if (!parsed.intent) parsed.intent = "memo";
    if (!parsed.cleaned_text) parsed.cleaned_text = text;

    return parsed;
  } catch (err) {
    console.error("Gemini classification failed:", err);
    return {
      intent: "memo",
      cleaned_text: text,
      intent_data: null,
    };
  }
}
