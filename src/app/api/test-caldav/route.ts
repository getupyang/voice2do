import { NextResponse } from "next/server";

/**
 * 诊断端点：测试 CalDAV 连接和写入
 * GET /api/test-caldav
 */
export async function GET() {
  const steps: string[] = [];

  try {
    // Step 1: 检查环境变量
    const email = process.env.ICLOUD_EMAIL;
    const password = process.env.ICLOUD_APP_PASSWORD;

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: "Missing ICLOUD_EMAIL or ICLOUD_APP_PASSWORD",
        has_email: !!email,
        has_password: !!password,
      });
    }
    steps.push("env vars OK");

    // Step 2: 连接 CalDAV
    const { createDAVClient } = await import("tsdav");
    steps.push("tsdav imported");

    const client = await createDAVClient({
      serverUrl: "https://caldav.icloud.com/",
      credentials: { username: email, password },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
    steps.push("CalDAV client created");

    // Step 3: 获取日历
    const calendars = await client.fetchCalendars();
    steps.push(`found ${calendars.length} calendars`);

    const calNames = calendars.map((c) =>
      typeof c.displayName === "string" ? c.displayName : "unknown"
    );
    steps.push(`calendars: ${calNames.join(", ")}`);

    const voice2do = calendars.find((c) => c.displayName === "Voice2Do");
    if (voice2do) {
      steps.push("Voice2Do calendar found");
    } else {
      steps.push("Voice2Do calendar NOT found, would use: " + calNames[0]);
    }

    return NextResponse.json({ success: true, steps });
  } catch (error) {
    return NextResponse.json({
      success: false,
      steps,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
