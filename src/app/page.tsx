import MemoListLoader from "@/components/MemoListLoader";

export default function Home() {
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
        <MemoListLoader />
      </main>
    </div>
  );
}
