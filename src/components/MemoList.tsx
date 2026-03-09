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
    <>
      {hasNonMemoIntents && (
        <div className="flex gap-2 mb-8 flex-wrap">
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
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[var(--muted)]">
            {activeFilter === 'all'
              ? '还没有任何记录'
              : `还没有「${INTENT_LABELS[activeFilter]}」的记录`}
          </p>
        </div>
      ) : (
        <Timeline groups={groups} />
      )}
    </>
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
