import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type PatchBody = {
  action: "complete" | "uncomplete";
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ success: false, error: "无效的 id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体必须是 JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.action === "complete") {
    updates.status = "done";
    updates.completed_at = new Date().toISOString();
  } else if (body.action === "uncomplete") {
    updates.status = "active";
    updates.completed_at = null;
  } else {
    return NextResponse.json({ success: false, error: "未知 action" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("memos")
    .update(updates)
    .eq("id", id)
    .select("id, status, completed_at")
    .single();

  if (error) {
    console.error("PATCH /api/memos/[id] db error:", error);
    return NextResponse.json({ success: false, error: "更新失败" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "记录不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}
