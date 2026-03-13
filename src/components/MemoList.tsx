'use client';

import { useState } from 'react';
import { Memo, IntentType, INTENT_LABELS, TimelineGroup } from '@/types';
import { groupMemosByTime } from '@/lib/utils';
import { MemoCard } from '@/components/MemoCard';

const FILTER_OPTIONS: { value: 'all' | IntentType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'movie', label: '电影' },
  { value: 'place', label: '目的地' },
  { value: 'todo', label: '要做的事' },
];

export default function MemoList({ memos }: { memos: Memo[] }) {
  const [activeFilter, setActiveFilter] = useState<'all' | IntentType>('all');

  const intentCounts = memos.reduce((acc, m) => {
    acc[m.intent] = (acc[m.intent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasNonMemoIntents = Object.keys(intentCounts).some((k) => k !== 'memo');

  const filteredMemos =
    activeFilter === 'all' ? memos : memos.filter((m) => m.intent === activeFilter);

  const groups = groupMemosByTime(filteredMemos);

  return (
    <div className="min-h-screen">
      {/* 顶部导航：标题 + 筛选栏，整体 sticky */}
      <header className="sticky top-0 z-30 bg-[var(--background)] border-b border-[var(--card-border)]">
        <div className="px-6 pt-4 pb-3 text-center">
          <h1 className="text-xl font-semibold">Voice2Do</h1>
          <p className="text-sm text-[var(--muted)] mt-1">用声音记录每一个灵感</p>
        </div>

        {hasNonMemoIntents && (
          <div className="max-w-2xl mx-auto px-6 pb-3">
            <div className="flex gap-2 flex-wrap">
              {FILTER_OPTIONS.map(({ value, label }) => {
                if (value !== 'all' && !intentCounts[value]) return null;
                const isActive = activeFilter === value;
                const count = value === 'all' ? null : intentCounts[value];
                return (
                  <button
                    key={value}
                    onClick={() => setActiveFilter(value)}
                    className={`category-tab${isActive ? ' active' : ''}`}
                  >
                    {label}
                    {count != null && <span className="ml-1 opacity-60">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* 主内容 */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {memos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-6">🎙️</div>
            <h2 className="text-xl font-medium mb-2">还没有任何记录</h2>
            <p className="text-[var(--muted)] max-w-sm">
              使用 iOS 捷径录制一段语音，你的想法就会出现在这里
            </p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[var(--muted)]">
              还没有「{activeFilter !== 'all' ? INTENT_LABELS[activeFilter] : ''}」的记录
            </p>
          </div>
        ) : (
          <Timeline groups={groups} />
        )}
      </main>
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
