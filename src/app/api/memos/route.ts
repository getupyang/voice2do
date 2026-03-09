import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const intent = searchParams.get("intent");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // 构建查询
    let query = supabase
      .from("memos")
      .select("id, created_at, cleaned_text, intent, intent_data, status, completed_at, completion_note, completion_image_url")
      .in("status", ["active", "done"])
      .order("created_at", { ascending: false })
      .limit(limit);

    // 可选：按意图类型筛选
    if (intent) {
      query = query.eq("intent", intent);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { success: false, error: "查询失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("Memos API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "查询失败",
      },
      { status: 500 }
    );
  }
}
