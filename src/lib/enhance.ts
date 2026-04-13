/**
 * LLM 增强模块
 * 用于转写文本优化 + 意图识别
 */

import { chatCompletion } from "./llm";
import { supabase } from "./supabase";

const SYSTEM_PROMPT = `你是一个语音备忘录的后处理助手。用户通过语音录入了一段话，经过语音转文字后得到了下面的文本。请你完成以下任务：

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

## 输出格式
严格按以下 JSON 格式输出，不要输出任何其他内容：

{
  "cleaned_text": "优化后的文本",
  "intent": "movie 或 place 或 todo 或 memo",
  "intent_data": null
}

intent_data 示例：
- movie: { "title": "电影名", "reason": "想看的原因" }
- place: { "name": "地点名", "reason": "想去的原因" }
- todo: { "task": "事项描述" }
- memo: null`;

interface EnhanceResult {
  cleaned_text: string;
  intent: "memo" | "movie" | "place" | "todo";
  intent_data: Record<string, unknown> | null;
}

/**
 * 调用 LLM 增强转写文本并识别意图
 */
export async function enhanceTranscription(
  rawText: string
): Promise<EnhanceResult> {
  const response = await chatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: rawText },
    ],
    { jsonMode: true }
  );

  const result = JSON.parse(response.content);

  // 校验必要字段
  if (!result.cleaned_text || !result.intent) {
    throw new Error("LLM response missing required fields");
  }

  // 校验 intent 值
  const validIntents = ["memo", "movie", "place", "todo"];
  if (!validIntents.includes(result.intent)) {
    result.intent = "memo";
  }

  return {
    cleaned_text: result.cleaned_text,
    intent: result.intent,
    intent_data: result.intent_data || null,
  };
}

/**
 * 异步增强 memo 记录
 * 在后台调用 LLM 处理，完成后更新数据库
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
    });

    const { error } = await supabase
      .from("memos")
      .update({
        cleaned_text: result.cleaned_text,
        intent: result.intent,
        intent_data: result.intent_data,
      })
      .eq("id", memoId);

    if (error) {
      console.error(`[enhance] Database update failed for memo ${memoId}:`, error);
    } else {
      console.log(`[enhance] Successfully enhanced memo ${memoId}`);
    }
  } catch (error) {
    console.error(`[enhance] Enhancement failed for memo ${memoId}:`, error);
    // Enhancement failure is non-critical - memo remains with raw text
  }
}
