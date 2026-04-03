import { Memo, TimelineGroup, TodoIntentData } from "@/types";
import { groupMemosByTime, formatTime } from "@/lib/utils";

async function getMemos(): Promise<Memo[]> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/memos`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch memos:", res.status);
      return [];
    }

    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error("Error fetching memos:", error);
    return [];
  }
}

export default async function Home() {
  const memos = await getMemos();
  const groups = groupMemosByTime(memos);

  return (
    <div className="min-h-screen">
      {/* 页头 */}
      <header className="sticky top-0 z-10 bg-[var(--background)] border-b border-[var(--card-border)] px-6 py-4">
        <h1 className="text-xl font-semibold text-center">Voice2Do</h1>
        <p className="text-sm text-[var(--muted)] text-center mt-1">
          用声音记录每一个灵感
        </p>
      </header>

      {/* 主内容 */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          <Timeline groups={groups} />
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-6">🎙️</div>
      <h2 className="text-xl font-medium mb-2">还没有任何记录</h2>
      <p className="text-[var(--muted)] max-w-sm">
        使用 iOS 捷径录制一段语音，你的想法就会出现在这里
      </p>
    </div>
  );
}

function Timeline({ groups }: { groups: TimelineGroup[] }) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.label}>
          {/* 时间分组标签 */}
          <div className="timeline-group-label mb-4 pl-4 border-l-2 border-[var(--accent)]">
            {group.label}
          </div>

          {/* 该分组下的备忘 */}
          <div className="space-y-4">
            {group.memos.map((memo) => (
              <MemoCard key={memo.id} memo={memo} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MemoCard({ memo }: { memo: Memo }) {
  const todoData = memo.intent === "todo"
    ? (memo.intent_data as TodoIntentData | null)
    : null;

  // todo + datetime → 日历型；todo + 无 datetime → 提醒型
  const isCalendarEvent = !!todoData?.datetime;
  const isReminder = memo.intent === "todo" && !isCalendarEvent;

  return (
    <article className="memo-card">
      {/* Voice2Do 标签 */}
      {(isCalendarEvent || isReminder) && (
        <div className="flex items-center gap-2 mb-3">
          {isCalendarEvent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <span>📅</span> Voice2Do 日历
            </span>
          )}
          {isReminder && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <span>✓</span> Voice2Do 提醒
            </span>
          )}
        </div>
      )}

      {/* 主文本 */}
      <p className="text-lg leading-relaxed">{memo.cleaned_text}</p>

      {/* 日历事件详情 */}
      {isCalendarEvent && todoData && (
        <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span className="text-base">🕐</span>
            <span>
              {todoData.is_all_day
                ? new Date(todoData.datetime!).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Shanghai" })
                : new Date(todoData.datetime!).toLocaleString("zh-CN", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" })
              }
            </span>
            {todoData.end_datetime && !todoData.is_all_day && (
              <span>— {new Date(todoData.end_datetime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" })}</span>
            )}
          </div>
          {todoData.location && (
            <div className="flex items-center gap-2">
              <span className="text-base">📍</span>
              <span>{todoData.location}</span>
            </div>
          )}
          {todoData.notes && (
            <div className="flex items-center gap-2">
              <span className="text-base">📝</span>
              <span>{todoData.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* 提醒型代办详情 */}
      {isReminder && todoData?.deadline && (
        <div className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="text-base">📆</span>
          <span>截止：{new Date(todoData.deadline).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</span>
        </div>
      )}

      {/* 底部时间戳 */}
      <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
        <time>{formatTime(memo.created_at)}</time>
        {memo.intent === "movie" && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-xs">电影</span>
        )}
        {memo.intent === "place" && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-xs">地点</span>
        )}
      </div>
    </article>
  );
}
