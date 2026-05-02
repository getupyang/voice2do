/**
 * LLM 增强模块
 * 用于转写文本优化 + 意图识别
 */

import { chatCompletion } from "./llm";
import { supabase } from "./supabase";
import { hasMeaningfulTranscription, normalizeTranscription } from "./transcription";

function buildSystemPrompt(): string {
  // 注入当前时间，让 LLM 能解析相对日期（"下周三"、"这周五"等）
  const now = new Date();
  const currentDatetime = now.toISOString().slice(0, 19);
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];

  return `你是一个语音备忘录的后处理助手。用户通过语音录入了一段话，经过语音转文字后得到了下面的文本。请你完成以下任务：

当前时间：${currentDatetime}（${weekday}）

## 绝对约束
- 只能整理和分类用户原文中已经出现的信息，不能补充、猜测、续写或编造任何原文不存在的内容。
- 如果原文为空、只有标点、只有空白、或没有可识别的语义内容，必须输出 cleaned_text 为空字符串、intent 为 "memo"、intent_data 为 null、calendar_event 为 null。

## 任务

### 1. 文本优化
- 去除语气词（额、嗯、啊、呃、哦、那个、就是、然后、所以说、对吧、你知道、怎么说呢等）
- 修正明显的标点符号问题，使句子通顺
- 重要：将文本中所有的"他"替换为"她"，除非上下文中有明确的男性标志（如"男朋友"、"爸爸"、"哥哥"、"先生"等）。语音转文字无法区分"他/她"，而记录者默认指代女性，所以必须主动把"他"改为"她"。
- 对于不确定的人名（看起来像人名但不是公众人物的），直接输出其拼音（全小写无空格，如"yangyiwen"），因为语音转文字很可能写错字。公众人物和知名人物的名字保留汉字。

### 2. 意图识别
判断这段话的核心意图属于以下哪个分类：
- "movie"：用户表达了想看某部电影、电视剧、纪录片等影视作品的意图
- "place"：用户表达了想去某个地方、餐厅、景点等的意图。判断标准：目的地本身就是目的，去掉地点名意图就不成立
- "todo"：用户表达了想做某件事的意图（如看病、运动、听音乐、办事等）。判断标准：有一个要完成的事项，即使去掉地点意图依然成立（如"去医院看病"核心是"看病"→ todo）
- "memo"：不属于以上三种意图，属于感想、状态描述、闲聊、日常记录等（兜底分类）

示例：
- "想看穆赫兰道" → movie
- "想去北京古天文台" → place（目的地本身是目的）
- "要去昆区博物馆" → place
- "回北京要看甲状腺" → todo（看病是事项）
- "一起打羽毛球" → todo
- "要听交响乐" → todo
- "一起去按摩" → todo（按摩是事项，地点不重要）
- "我没不开心啊，我高兴的很" → memo
- "她没下班" → memo

注意：只有明确表达"想看某个影视作品"时才分类为 movie。只有目的地本身就是目的时才分类为 place。有明确要做的事项时分类为 todo。其他所有情况归为 memo。

### 3. 结构化数据提取
根据意图类型提取关键信息：
- movie: 提取作品名称和想看的原因
- place: 提取地点名称和想去的原因
- todo: 提取事项描述
- memo: 不需要提取，设为 null

### 4. 日历事件判断
判断这条语音备忘录是否需要添加到日历提醒。这个判断独立于意图分类——任何意图类型都可能需要或不需要加日历。

**需要加日历的情况**（有明确时间 + 怕忘/不能错过）：
- 约了医生、牙科等预约："周三下午两点看牙医" → 需要
- 报名了活动/会议："5月10号参加 AI 大会" → 需要
- 电影上映日："哥斯拉大战金刚4月25号上映要去看" → 需要
- 航班/火车："下周五飞上海的航班" → 需要
- 有截止日期的事项："下周一之前交报告" → 需要
- 和人的约定："周六晚上和小明吃饭" → 需要

**不需要加日历的情况**：
- 只是"以后想做"，没有具体时间："想去安岳看石窟"、"想学吉他" → 不需要
- 日常记录、想法、感受 → 不需要
- 描述过去已发生的事 → 不需要
- 泛泛的时间没有具体日期："最近要运动" → 不需要

如果需要加日历，提取以下信息：
- title: 事件标题（简洁明了）
- start_time: 开始时间（ISO 8601 格式，基于当前时间推算相对日期）
- end_time: 结束时间（可选，没提到就不填）
- all_day: 是否全天事件（如果只提到日期没提到时间，设为 true）
- location: 地点（可选，只在明确提到时填写）
- notes: 备注（可选，从原文提取有用的补充信息）

**铁律：只提取用户原文中明确说出的信息，绝对不能推测或补充。**
- 用户没说具体几点 → all_day 设为 true，不要猜时间
- 用户没说地点 → 不填 location，不要根据事件类型猜地点
- 用户没说结束时间 → 不填 end_time
- 错误示例："4月30号去看歌剧" → 不能猜 19:30 开始，应设为全天事件

## 输出格式
严格按以下 JSON 格式输出，不要输出任何其他内容：

{
  "cleaned_text": "优化后的文本",
  "intent": "movie 或 place 或 todo 或 memo",
  "intent_data": null,
  "calendar_event": null
}

intent_data 示例：
- movie: { "title": "电影名", "reason": "想看的原因" }
- place: { "name": "地点名", "reason": "想去的原因" }
- todo: { "task": "事项描述" }
- memo: null

calendar_event 示例（需要加日历时）：
{ "title": "牙科复诊", "start_time": "2026-04-18T14:00:00", "all_day": false, "location": "北京口腔医院" }
{ "title": "AI 大会", "start_time": "2026-05-10T09:00:00", "all_day": true }

不需要加日历时，calendar_event 设为 null。`;
}

interface EnhanceResult {
  cleaned_text: string;
  intent: "memo" | "movie" | "place" | "todo";
  intent_data: Record<string, unknown> | null;
  calendar_event: {
    title: string;
    start_time: string;
    end_time?: string;
    all_day?: boolean;
    location?: string;
    notes?: string;
  } | null;
}

/**
 * 调用 LLM 增强转写文本并识别意图
 */
export async function enhanceTranscription(
  rawText: string
): Promise<EnhanceResult> {
  const normalizedRawText = normalizeTranscription(rawText);
  if (!hasMeaningfulTranscription(normalizedRawText)) {
    throw new Error("Cannot enhance empty transcription");
  }

  const response = await chatCompletion(
    [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: normalizedRawText },
    ],
    { jsonMode: true }
  );

  const result = JSON.parse(response.content);

  // 校验必要字段
  if (typeof result.cleaned_text !== "string" || !result.intent) {
    throw new Error("LLM response missing required fields");
  }
  if (!hasMeaningfulTranscription(result.cleaned_text)) {
    throw new Error("LLM response returned empty cleaned_text");
  }

  // 校验 intent 值
  const validIntents = ["memo", "movie", "place", "todo"];
  if (!validIntents.includes(result.intent)) {
    result.intent = "memo";
  }

  // 校验 calendar_event 基本结构
  let calendarEvent = null;
  if (result.calendar_event && result.calendar_event.title && result.calendar_event.start_time) {
    calendarEvent = result.calendar_event;
  }

  return {
    cleaned_text: normalizeTranscription(result.cleaned_text),
    intent: result.intent,
    intent_data: result.intent_data || null,
    calendar_event: calendarEvent,
  };
}

/**
 * 异步增强 memo 记录
 * 在后台调用 LLM 处理，完成后更新数据库，如有日历事件则同步到 iCloud
 */
export async function enhanceMemo(
  memoId: string,
  rawText: string
): Promise<void> {
  try {
    console.log(`[enhance] Starting enhancement for memo ${memoId}`);
    const result = await enhanceTranscription(rawText);
    console.log(`[enhance] Result:`, {
      intent: result.intent,
      cleaned_text: result.cleaned_text.substring(0, 50),
      has_calendar_event: !!result.calendar_event,
    });

    // 更新数据库（含 calendar_event）
    const { error } = await supabase
      .from("memos")
      .update({
        cleaned_text: result.cleaned_text,
        intent: result.intent,
        intent_data: result.intent_data,
        calendar_event: result.calendar_event,
      })
      .eq("id", memoId);

    if (error) {
      console.error(`[enhance] Database update failed for memo ${memoId}:`, error);
      return;
    }

    console.log(`[enhance] Successfully enhanced memo ${memoId}`);

    // 如果有日历事件，同步到 iCloud
    if (result.calendar_event) {
      try {
        console.log(`[enhance] Attempting calendar sync for memo ${memoId}:`, JSON.stringify(result.calendar_event));
        const { createCalendarEvent } = await import("./caldav");
        await createCalendarEvent(result.calendar_event, memoId);

        // 标记同步成功
        await supabase
          .from("memos")
          .update({ calendar_synced: true })
          .eq("id", memoId);

        console.log(`[enhance] Calendar event synced for memo ${memoId}: "${result.calendar_event.title}"`);
      } catch (calError) {
        console.error(`[enhance] Calendar sync failed for memo ${memoId}:`, calError instanceof Error ? calError.message : calError);
        console.error(`[enhance] Calendar sync error stack:`, calError instanceof Error ? calError.stack : 'no stack');
      }
    }
  } catch (error) {
    console.error(`[enhance] Enhancement failed for memo ${memoId}:`, error);
    // Enhancement failure is non-critical - memo remains with raw text
  }
}
