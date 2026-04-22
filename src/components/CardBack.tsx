"use client";

import { useState } from "react";
import { Memo } from "@/types";

type Props = {
  memo: Memo;
  onCompleted: (patch: Partial<Memo>) => void;
  onClose: () => void;
};

export function CardBack({ memo, onCompleted, onClose }: Props) {
  const isDone = memo.status === "done";
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 点背面任何地方都返回（除非点在按钮上）
  function handleBackgroundClick(e: React.MouseEvent) {
    const interactive = (e.target as HTMLElement).closest("button, a");
    if (interactive) return;
    onClose();
  }

  async function handleComplete() {
    if (submitting || completing) return;
    setError(null);
    setCompleting(true);
    // 画勾动画 700ms，完整播完再提交 + 翻回
    try {
      const res = await fetch(`/api/memos/${memo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "提交失败");
      // 等动画放完再通知父组件翻回
      setTimeout(() => {
        onCompleted({
          status: "done",
          completed_at: json.data.completed_at,
        });
      }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "标记失败，请重试");
      setCompleting(false);
    }
  }

  async function handleUncomplete() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/memos/${memo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "uncomplete" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "操作失败");
      onCompleted({
        status: "active",
        completed_at: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      onClick={handleBackgroundClick}
    >
      {isDone ? (
        <button
          onClick={handleUncomplete}
          disabled={submitting}
          className="text-sm text-[var(--muted)] underline underline-offset-4 decoration-[1px] disabled:opacity-50"
        >
          撤销完成
        </button>
      ) : (
        <button
          onClick={handleComplete}
          disabled={completing}
          className={`complete-btn ${completing ? "is-completing" : ""}`}
          aria-label="标记为已完成"
        >
          {completing ? (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                className="check-stroke"
                d="M7 14l5 5 9-11"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <span>✓ 完成</span>
          )}
        </button>
      )}

      {error && (
        <p className="absolute bottom-4 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
