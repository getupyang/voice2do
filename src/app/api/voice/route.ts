import { NextRequest, NextResponse } from "next/server";
import { transcribeAndClean } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    // 获取音频数据
    const contentType = request.headers.get("content-type") || "";
    let audioBuffer: Buffer;
    let mimeType: string;

    if (contentType.includes("multipart/form-data")) {
      // 处理 form-data 格式
      const formData = await request.formData();
      const file = formData.get("audio") as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: "缺少音频文件" },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      mimeType = file.type || "audio/m4a";
    } else {
      // 处理原始音频数据
      const arrayBuffer = await request.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);

      // 从 content-type 推断 mime type
      if (contentType.includes("audio/")) {
        mimeType = contentType.split(";")[0].trim();
      } else {
        mimeType = "audio/m4a"; // 默认 m4a
      }
    }

    if (audioBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "音频文件为空" },
        { status: 400 }
      );
    }

    // 调用 Gemini 转写和清理
    const { rawText, cleanedText } = await transcribeAndClean(
      audioBuffer,
      mimeType
    );

    // 存储到数据库
    const { data, error } = await supabase
      .from("memos")
      .insert({
        raw_text: rawText,
        cleaned_text: cleanedText,
        intent: "memo",
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { success: false, error: "数据库存储失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        raw_text: data.raw_text,
        cleaned_text: data.cleaned_text,
        created_at: data.created_at,
      },
    });
  } catch (error) {
    console.error("Voice API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "处理失败",
      },
      { status: 500 }
    );
  }
}
