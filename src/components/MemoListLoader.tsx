"use client";

import { useEffect, useState } from "react";
import { Memo } from "@/types";
import MemoList from "./MemoList";

export default function MemoListLoader() {
  const [memos, setMemos] = useState<Memo[] | null>(null);

  useEffect(() => {
    fetch("/api/memos")
      .then((res) => res.json())
      .then((json) => setMemos(json.data || []))
      .catch(() => setMemos([]));
  }, []);

  if (memos === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--muted)] mt-4">加载中...</p>
      </div>
    );
  }

  if (memos.length === 0) {
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

  return <MemoList memos={memos} />;
}
