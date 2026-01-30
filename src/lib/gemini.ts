import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * 使用 Gemini 转写音频并清理语气词
 * @param audioBuffer 音频文件的 Buffer
 * @param mimeType 音频 MIME 类型，如 'audio/m4a'
 * @returns 转写结果，包含原始文本和清理后的文本
 */
export async function transcribeAndClean(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ rawText: string; cleanedText: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // 将音频转为 base64
  const audioBase64 = audioBuffer.toString("base64");

  // 第一步：转写音频
  const transcribeResult = await model.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: audioBase64,
      },
    },
    {
      text: "请将这段音频转写为文字。只输出转写结果，不要添加任何其他内容。",
    },
  ]);

  const rawText = transcribeResult.response.text().trim();

  // 第二步：清理语气词
  const cleanResult = await model.generateContent([
    {
      text: `请清理以下文本中的语气词（如"嗯"、"啊"、"额"、"那个"、"就是"等），保持原意不变。只输出清理后的文本，不要添加任何解释。

原文：${rawText}`,
    },
  ]);

  const cleanedText = cleanResult.response.text().trim();

  return {
    rawText,
    cleanedText,
  };
}
