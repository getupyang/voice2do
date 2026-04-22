"use client";

import { useState } from "react";
import { Memo, IntentType, INTENT_LABELS } from "@/types";
import { groupMemosByTime } from "@/lib/utils";
import { TimelineGroup } from "@/types";
import { MemoCard } from "./MemoCard";

type Filter = "all" | IntentType | "done";

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "movie", label: "电影" },
  { value: "place", label: "目的地" },
  { value: "todo", label: "要做的事" },
  { value: "done", label: "已完成" },
];

export default function MemoList({ memos }: { memos: Memo[] }) {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  // 统计各分类数量
  const intentCounts = memos.reduce(
    (acc, m) => {
      acc[m.intent] = (acc[m.intent] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const doneCount = memos.filter((m) => m.status === "done").length;

  const hasNonMemoIntents = Object.keys(intentCounts).some((k) => k !== "memo");
  const showFilterBar = hasNonMemoIntents || doneCount > 0;

  const filteredMemos =
    activeFilter === "all"
      ? memos
      : activeFilter === "done"
      ? memos.filter((m) => m.status === "done")
      : memos.filter((m) => m.intent === activeFilter);

  const groups = groupMemosByTime(filteredMemos);

  // 找最新一条可翻转的卡片，给它 showHint
  const firstFlippableId = filteredMemos.find(
    (m) => m.status === "active" || m.status === "done"
  )?.id;

  return (
    <>
      {showFilterBar && (
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          intentCounts={intentCounts}
          doneCount={doneCount}
        />
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[var(--muted)]">
            {activeFilter === "all"
              ? "还没有任何记录"
              : activeFilter === "done"
              ? "还没有已完成的记录"
              : `还没有「${INTENT_LABELS[activeFilter as IntentType]}」的记录`}
          </p>
        </div>
      ) : (
        <Timeline groups={groups} hintTargetId={firstFlippableId} />
      )}
    </>
  );
}

function FilterBar({
  activeFilter,
  onFilterChange,
  intentCounts,
  doneCount,
}: {
  activeFilter: Filter;
  onFilterChange: (filter: Filter) => void;
  intentCounts: Record<string, number>;
  doneCount: number;
}) {
  return (
    <div className="flex gap-2 mb-8 flex-wrap">
      {FILTER_OPTIONS.map(({ value, label }) => {
        // 隐藏没有数据的分类（"全部"始终显示）
        if (value === "done") {
          if (doneCount === 0) return null;
        } else if (value !== "all" && !intentCounts[value]) {
          return null;
        }

        const isActive = activeFilter === value;
        const count =
          value === "all" ? null : value === "done" ? doneCount : intentCounts[value];

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

function Timeline({
  groups,
  hintTargetId,
}: {
  groups: TimelineGroup[];
  hintTargetId?: string;
}) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.label}>
          <div className="timeline-group-label mb-4 pl-4 border-l-2 border-[var(--accent)]">
            {group.label}
          </div>
          <div className="space-y-4">
            {group.memos.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                showHint={memo.id === hintTargetId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
