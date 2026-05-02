import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { processUploadedVoice } from "@/lib/voicePipeline";

type ProcessBody = {
  memo_id?: string;
  path?: string;
};

function isUuid(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  let body: ProcessBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体必须是 JSON" }, { status: 400 });
  }

  if (!isUuid(body.memo_id)) {
    return NextResponse.json({ success: false, error: "无效的 memo_id" }, { status: 400 });
  }
  if (!body.path || !body.path.startsWith("incoming/")) {
    return NextResponse.json({ success: false, error: "无效的 path" }, { status: 400 });
  }

  const { data: exists, error: existsError } = await supabase
    .storage
    .from("audio")
    .exists(body.path);

  if (existsError || !exists) {
    return NextResponse.json(
      { success: false, error: "未找到已上传音频，请确认上传步骤成功" },
      { status: 404 }
    );
  }

  await supabase
    .from("memos")
    .update({
      raw_text: "[转写中...]",
      cleaned_text: "[转写中...]",
      status: "pending",
    })
    .eq("id", body.memo_id);

  after(async () => {
    await processUploadedVoice(body.memo_id!, body.path!);
  });

  return NextResponse.json({
    success: true,
    message: "录音已上传，正在后台转写",
    data: {
      memo_id: body.memo_id,
      status: "pending",
    },
  });
}
