/**
 * iCloud CalDAV 日历写入模块
 * 通过 CalDAV 协议将事件写入 iCloud 日历
 */

import { createDAVClient, DAVClient } from "tsdav";
import ical, { ICalAlarmType } from "ical-generator";
import { randomUUID } from "crypto";

// 缓存 DAV client，避免每次都重新认证
let cachedClient: DAVClient | null = null;
let cachedCalendarUrl: string | null = null;

/**
 * 获取或创建 DAV client
 */
async function getClient() {
  const email = process.env.ICLOUD_EMAIL;
  const password = process.env.ICLOUD_APP_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing ICLOUD_EMAIL or ICLOUD_APP_PASSWORD environment variables");
  }

  if (cachedClient && cachedCalendarUrl) {
    return { client: cachedClient, calendarUrl: cachedCalendarUrl };
  }

  console.log("[caldav] Connecting to iCloud CalDAV...");

  const client = await createDAVClient({
    serverUrl: "https://caldav.icloud.com/",
    credentials: {
      username: email,
      password: password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  // 获取日历列表，选第一个（通常是默认日历）
  const calendars = await client.fetchCalendars();

  if (!calendars || calendars.length === 0) {
    throw new Error("No calendars found in iCloud account");
  }

  // 优先找名为 "Voice2Do" 的日历，否则用第一个
  const targetCalendar =
    calendars.find((c) => {
      const name = typeof c.displayName === "string" ? c.displayName : "";
      return name === "Voice2Do";
    }) || calendars[0];

  const calendarName =
    typeof targetCalendar.displayName === "string"
      ? targetCalendar.displayName
      : "default";

  console.log(
    `[caldav] Using calendar: "${calendarName}" (${calendars.length} calendars found)`
  );

  cachedClient = client as unknown as DAVClient;
  cachedCalendarUrl = targetCalendar.url;

  return { client, calendarUrl: targetCalendar.url };
}

interface CalendarEventInput {
  title: string;
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  location?: string;
  notes?: string;
}

/**
 * 创建日历事件并写入 iCloud
 */
export async function createCalendarEvent(
  event: CalendarEventInput,
  memoId: string
): Promise<void> {
  const { client, calendarUrl } = await getClient();

  const eventId = randomUUID();

  // 构造 ICS
  const calendar = ical({ name: "Voice2Do" });

  const startDate = new Date(event.start_time);
  let endDate: Date;

  if (event.end_time) {
    endDate = new Date(event.end_time);
  } else if (event.all_day) {
    // 全天事件：结束日期 = 开始日期 + 1 天
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
  } else {
    // 非全天事件默认 1 小时
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  const icalEvent = calendar.createEvent({
    id: eventId,
    start: startDate,
    end: endDate,
    summary: event.title,
    allDay: event.all_day || false,
    timezone: "Asia/Shanghai",
  });

  if (event.location) {
    icalEvent.location(event.location);
  }

  if (event.notes) {
    icalEvent.description(event.notes);
  }

  // 提前 1 天提醒
  icalEvent.createAlarm({
    type: ICalAlarmType.display,
    triggerBefore: 24 * 60 * 60, // 1 day before in seconds
  });

  // 当天提前 2 小时提醒
  icalEvent.createAlarm({
    type: ICalAlarmType.display,
    triggerBefore: 2 * 60 * 60, // 2 hours before in seconds
  });

  const icsString = calendar.toString();

  console.log(`[caldav] Creating event: "${event.title}" at ${event.start_time}`);

  // 写入 iCloud
  const response = await client.createCalendarObject({
    calendar: { url: calendarUrl } as Parameters<typeof client.createCalendarObject>[0]["calendar"],
    iCalString: icsString,
    filename: `voice2do-${memoId}-${eventId}.ics`,
  });

  // tsdav 返回的是 Response[] 数组
  const results = Array.isArray(response) ? response : [response];
  for (const res of results) {
    if (res && typeof res === "object" && "ok" in res && !res.ok) {
      const status = "status" in res ? res.status : "unknown";
      const statusText = "statusText" in res ? res.statusText : "";
      throw new Error(`CalDAV PUT failed: ${status} ${statusText}`);
    }
  }

  console.log(`[caldav] Event created successfully: "${event.title}"`);
}
