"use client";

import { useState } from "react";
import { Memo, IntentType, INTENT_LABELS } from "@/types";
import { groupMemosByTime, formatTime } from "@/lib/utils";
import { TimelineGroup } from "@/types";

const FILTER_OPTIONS: { value: "all" | IntentType; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "movie", label: "电影" },
  { value: "place", label: "目的地" },
];

export default function MemoList({ memos }: { memos: Memo[] }) {
  const [activeFilter, setActiveFilter] = useState<"all" | IntentType>("all");

  // 统计各分类数量
  const intentCounts = memos.reduce(
    (acc, m) => {
      acc[m.intent] = (acc[m.intent] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // 只在有非 memo 分类时显示筛选栏
  const hasNonMemoIntents = Object.keys(intentCounts).some((k) => k !== "memo");

  const filteredMemos =
    activeFilter === "all"
      ? memos
      : memos.filter((m) => m.intent === activeFilter);

  const groups = groupMemosByTime(filteredMemos);

  return (
    <>
      {hasNonMemoIntents && (
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          intentCounts={intentCounts}
        />
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[var(--muted)]">
            {activeFilter === "all"
              ? "还没有任何记录"
              : `还没有「${INTENT_LABELS[activeFilter]}」的记录`}
          </p>
        </div>
      ) : (
        <Timeline groups={groups} />
      )}
    </>
  );
}

function FilterBar({
  activeFilter,
  onFilterChange,
  intentCounts,
}: {
  activeFilter: "all" | IntentType;
  onFilterChange: (filter: "all" | IntentType) => void;
  intentCounts: Record<string, number>;
}) {
  return (
    <div className="flex gap-2 mb-8 flex-wrap">
      {FILTER_OPTIONS.map(({ value, label }) => {
        // 隐藏没有数据的分类（"全部"始终显示）
        if (value !== "all" && !intentCounts[value]) return null;

        const isActive = activeFilter === value;
        const count = value === "all" ? null : intentCounts[value];

        return (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={`category-tab ${isActive ? "active" : ""}`}
          >
            {label}
            {count != null && (
              <span className="ml-1 opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Timeline({ groups }: { groups: TimelineGroup[] }) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.label}>
          <div className="timeline-group-label mb-4 pl-4 border-l-2 border-[var(--accent)]">
            {group.label}
          </div>
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
  const intentLabel = INTENT_LABELS[memo.intent];

  return (
    <article className="memo-card">
      <p className="text-lg leading-relaxed">{memo.cleaned_text}</p>
      <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          {formatTime(memo.created_at)}
          {memo.device_id && <span> · {memo.device_id}</span>}
        </span>
        {memo.intent !== "memo" && (
          <span className="intent-tag">
            {intentLabel}
          </span>
        )}
      </div>
    </article>
  );
}
