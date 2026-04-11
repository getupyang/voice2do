"use client";

import { useState, useRef } from "react";
import { Memo } from "@/types";
import { formatTime } from "@/lib/utils";

export function MemoCard({ memo }: { memo: Memo }) {
  if (memo.status === "pending") {
    return <PendingCard memo={memo} />;
  }

  if (memo.status === "error") {
    return <ErrorCard memo={memo} />;
  }

  return (
    <article className="memo-card">
      <p className="text-lg leading-relaxed">{memo.cleaned_text}</p>
      {memo.audio_url && <AudioPlayer url={memo.audio_url} />}
      <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
        <time>{formatTime(memo.created_at)}</time>
        {memo.intent !== "memo" && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-xs">
            {memo.intent}
          </span>
        )}
      </div>
    </article>
  );
}

function PendingCard({ memo }: { memo: Memo }) {
  return (
    <article className="memo-card opacity-60">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        <p className="text-lg text-[var(--muted)]">转写中...</p>
      </div>
      {memo.audio_url && <AudioPlayer url={memo.audio_url} />}
      <div className="mt-4 text-sm text-[var(--muted)]">
        <time>{formatTime(memo.created_at)}</time>
      </div>
    </article>
  );
}

function ErrorCard({ memo }: { memo: Memo }) {
  return (
    <article className="memo-card border-red-200 bg-red-50/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-red-400 text-sm">转写失败</span>
      </div>
      {memo.audio_url ? (
        <>
          <p className="text-sm text-[var(--muted)] mb-2">原始录音仍可播放：</p>
          <AudioPlayer url={memo.audio_url} />
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]">音频未保存</p>
      )}
      <div className="mt-4 text-sm text-[var(--muted)]">
        <time>{formatTime(memo.created_at)}</time>
      </div>
    </article>
  );
}

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      await audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mt-3 flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--accent-light)]/50">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Play/Pause 按钮 */}
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--accent)] text-white flex-shrink-0 hover:opacity-80 transition-opacity"
        aria-label={isPlaying ? "暂停" : "播放"}
      >
        {isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="2" y="1" width="3" height="10" rx="0.5" />
            <rect x="7" y="1" width="3" height="10" rx="0.5" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 1.5v9l7.5-4.5L3 1.5z" />
          </svg>
        )}
      </button>

      {/* 进度条 */}
      <div
        className="flex-1 h-1.5 bg-[var(--card-border)] rounded-full cursor-pointer"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 时长 */}
      <span className="text-xs text-[var(--muted)] flex-shrink-0 tabular-nums">
        {duration > 0
          ? `${formatDuration(currentTime)} / ${formatDuration(duration)}`
          : "--:--"}
      </span>
    </div>
  );
}
