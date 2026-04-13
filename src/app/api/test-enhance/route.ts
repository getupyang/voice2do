import { NextRequest, NextResponse } from "next/server";
import { enhanceTranscription } from "@/lib/enhance";

/**
 * 测试端点：直接输入文本，测试 LLM 增强和意图识别效果
 * POST /api/test-enhance
 * Body: { "text": "要测试的文本" }
 */
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "请提供 text 字段" },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENROUTER_API_KEY 未配置" },
        { status: 500 }
      );
    }

    const startTime = Date.now();
    const result = await enhanceTranscription(text);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      input: text,
      output: result,
      model: process.env.LLM_MODEL || "google/gemini-2.5-flash",
      duration_ms: duration,
    });
  } catch (error) {
    console.error("Test enhance error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "处理失败",
      },
      { status: 500 }
    );
  }
}
