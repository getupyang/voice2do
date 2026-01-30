import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * 使用 Gemini 清理语气词
 * @param rawText 原始转写文本
 * @returns 清理后的文本
 */
export async function cleanText(rawText: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const cleanResult = await model.generateContent([
    {
      text: `请清理以下文本中的语气词（如"嗯"、"啊"、"额"、"那个"、"就是"等），保持原意不变。只输出清理后的文本，不要添加任何解释。

原文：${rawText}`,
    },
  ]);

  return cleanResult.response.text().trim();
}
