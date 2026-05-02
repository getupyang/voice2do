import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type InitBody = {
  device_name?: string;
  file_ext?: string;
};

function safeExt(ext: string | undefined): string {
  const normalized = (ext || "aiff").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "wav" || normalized === "aif" || normalized === "aiff") {
    return normalized;
  }
  return "aiff";
}

export async function POST(request: NextRequest) {
  let body: InitBody = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const deviceName = typeof body.device_name === "string" ? body.device_name : null;
  const ext = safeExt(body.file_ext);

  const { data: memoData, error: insertError } = await supabase
    .from("memos")
    .insert({
      raw_text: "[等待上传...]",
      cleaned_text: "[等待上传...]",
      intent: "memo",
      status: "pending",
      device_id: deviceName,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Voice init insert failed:", insertError);
    return NextResponse.json(
      { success: false, error: "数据库创建失败: " + insertError.message },
      { status: 500 }
    );
  }

  const path = `incoming/${Date.now()}_${memoData.id}.${ext}`;
  const { data: signedData, error: signError } = await supabase
    .storage
    .from("audio")
    .createSignedUploadUrl(path, { upsert: false });

  if (signError || !signedData) {
    console.error("Signed upload URL failed:", signError);
    await supabase.from("memos").update({ status: "error" }).eq("id", memoData.id);
    return NextResponse.json(
      { success: false, error: "创建上传地址失败: " + (signError?.message || "未知错误") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      memo_id: memoData.id,
      path,
      signed_url: signedData.signedUrl,
      token: signedData.token,
    },
  });
}
