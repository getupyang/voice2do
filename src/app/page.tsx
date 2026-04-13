import { Memo } from "@/types";
import MemoList from "@/components/MemoList";

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
        {memos.length === 0 ? (
          <EmptyState />
        ) : (
          <MemoList memos={memos} />
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
