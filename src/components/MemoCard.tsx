"use client";

import { useEffect, useRef, useState } from "react";
import { Memo, CalendarEvent } from "@/types";
import { formatTime } from "@/lib/utils";
import { CardBack } from "./CardBack";
import { isUnfinishedVoiceUpload } from "@/lib/pendingUpload";

const HINT_SEEN_KEY = "voice2do.flipHintSeen";

function shouldShowHintInitially(showHint: boolean) {
  if (!showHint) return false;
  if (typeof window === "undefined") return false;
  // ?resetHint 强制重放（测试用）
  if (window.location.search.includes("resetHint")) {
    localStorage.removeItem(HINT_SEEN_KEY);
    return true;
  }
  return !localStorage.getItem(HINT_SEEN_KEY);
}

export function MemoCard({
  memo: initialMemo,
  showHint = false,
}: {
  memo: Memo;
  showHint?: boolean;
}) {
  const [memo, setMemo] = useState(initialMemo);
  const [flipped, setFlipped] = useState(false);
  const [playHint, setPlayHint] = useState(() => shouldShowHintInitially(showHint));
  // 正面右上角的绿勾：完成后翻回到一半时才淡入，避免用户看到"勾在翻转的卡片上穿帮"
  const [showDoneDot, setShowDoneDot] = useState(initialMemo.status === "done");

  useEffect(() => {
    if (!playHint) return;
    try {
      localStorage.setItem(HINT_SEEN_KEY, "1");
    } catch {}
    // 半翻转动画 1200ms + 500ms 缓冲，避免用户误以为还在动
    const timer = setTimeout(() => setPlayHint(false), 1700);
    return () => clearTimeout(timer);
  }, [playHint]);

  if (memo.status === "pending") {
    return <PendingCard memo={memo} />;
  }
  if (memo.status === "error") {
    return <ErrorCard memo={memo} />;
  }

  const isDone = memo.status === "done";

  function handleCardClick(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) {
      const interactive = (e.target as HTMLElement).closest(
        "button, a, input, textarea, audio, [data-no-flip]"
      );
      if (interactive) return;
    }
    setFlipped((f) => !f);
  }

  function handleCompleted(patch: Partial<Memo>) {
    const nowDone = patch.status === "done";
    setMemo((m) => ({ ...m, ...patch }));
    // 翻回时隐藏勾，等翻到一半才显示
    setShowDoneDot(false);
    setFlipped(false);
    if (nowDone) {
      setTimeout(() => setShowDoneDot(true), 350);
    }
  }

  return (
    <div className="flip-scene">
      <div
        className={`flip-card ${flipped ? "is-flipped" : ""} ${
          playHint && !flipped ? "hint-peek" : ""
        }`}
        onClick={handleCardClick}
      >
        {/* 正面 */}
        <article
          className={`flip-face memo-card relative cursor-pointer ${
            isDone ? "is-done" : ""
          }`}
        >
          <p className={`text-lg leading-relaxed ${isDone ? "opacity-60" : ""}`}>
            {memo.cleaned_text}
          </p>

          {memo.audio_url && <AudioPlayer url={memo.audio_url} />}

          <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
            <div className="flex items-center gap-2">
              <time>{formatTime(memo.created_at)}</time>
              {memo.calendar_event && (
                <CalendarMark event={memo.calendar_event} />
              )}
            </div>
            {memo.intent !== "memo" && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-xs">
                {memo.intent}
              </span>
            )}
          </div>

          {isDone && showDoneDot && (
            <span className="done-dot">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5l2 2 4-5"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          )}
        </article>

        {/* 背面：与正面等高（用透明占位撑开），内容 absolute 居中 */}
        <article className="flip-face flip-back memo-card relative cursor-pointer">
          <p className="text-lg leading-relaxed invisible" aria-hidden>
            {memo.cleaned_text}
          </p>
          {memo.audio_url && (
            <div className="mt-3 h-12 invisible" aria-hidden />
          )}
          <div
            className="mt-4 flex items-center justify-between text-sm invisible"
            aria-hidden
          >
            <time>{formatTime(memo.created_at)}</time>
          </div>

          {flipped && (
            <CardBack
              memo={memo}
              onCompleted={handleCompleted}
              onClose={() => setFlipped(false)}
            />
          )}
        </article>
      </div>
    </div>
  );
}

function PendingCard({ memo }: { memo: Memo }) {
  if (isUnfinishedVoiceUpload(memo)) {
    return (
      <article className="memo-card border-red-200 bg-red-50/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-400 text-sm">上传未完成</span>
        </div>
        <p className="text-sm text-[var(--muted)]">
          没有收到音频文件，无法继续转写。
        </p>
        <div className="mt-4 text-sm text-[var(--muted)]">
          <time>{formatTime(memo.created_at)}</time>
        </div>
      </article>
    );
  }

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

export function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaybackError(null);
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        setIsPlaying(false);
        setPlaybackError(error instanceof Error ? error.message : "音频播放失败");
      }
    }
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
    <div className="mt-3 rounded-lg bg-[var(--accent-light)]/50" data-no-flip>
      <div className="flex items-center gap-3 px-3 py-2">
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setIsPlaying(false);
            setPlaybackError("音频加载失败");
          }}
        />

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

        <div
          className="flex-1 h-1.5 bg-[var(--card-border)] rounded-full cursor-pointer"
          onClick={handleProgressClick}
          data-no-flip
        >
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="text-xs text-[var(--muted)] flex-shrink-0 tabular-nums">
          {duration > 0
            ? `${formatDuration(currentTime)} / ${formatDuration(duration)}`
            : "--:--"}
        </span>
      </div>

      {playbackError && (
        <div className="px-3 pb-2 text-xs text-red-500">
          {playbackError}，
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            打开录音
          </a>
        </div>
      )}
    </div>
  );
}

function CalendarMark({ event }: { event: CalendarEvent }) {
  const date = new Date(event.start_time);
  const dateStr = event.all_day
    ? date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
    : date.toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <span
      className="inline-flex items-center text-blue-500"
      title={`已加入日历：${event.title} · ${dateStr}`}
      aria-label="已加入日历"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
