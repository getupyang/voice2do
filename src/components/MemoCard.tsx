'use client';

import { useRef, useState } from 'react';
import { Memo } from '@/types';
import { formatTime } from '@/lib/utils';

interface CompletionData {
  completion_note?: string;
  completion_image_url?: string;
  completed_at?: string;
}

function getCompletionData(memo: Memo): CompletionData {
  const d = memo.intent_data as CompletionData | null;
  return {
    completion_note: d?.completion_note,
    completion_image_url: d?.completion_image_url,
    completed_at: d?.completed_at,
  };
}

export function MemoCard({ memo: initialMemo }: { memo: Memo }) {
  const [memo, setMemo] = useState(initialMemo);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [completionImage, setCompletionImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDone = memo.status === 'done';
  const cd = getCompletionData(memo);

  const handleFlipToBack = () => setIsFlipped(true);

  const handleFlipToFront = () => {
    setIsFlipped(false);
    // reset form state after flip animation ends
    setTimeout(() => setIsCompleting(false), 400);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompletionImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (completionNote.trim()) {
        formData.append('completion_note', completionNote.trim());
      }
      if (completionImage) {
        formData.append('completion_image', completionImage);
      }

      const res = await fetch(`/api/memos/${memo.id}`, {
        method: 'PATCH',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to complete memo');

      const json = await res.json();
      setMemo(json.data);
      setIsCompleting(false);
      // Brief pause so user sees the "done" back face, then flip to front
      setTimeout(() => setIsFlipped(false), 350);
    } catch {
      // keep form visible on error; user can retry
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flip-container">
      <div className={`flip-inner${isFlipped ? ' flipped' : ''}`}>
        {/* ─── Front Face ─── */}
        <article
          className={`flip-front memo-card${isDone ? ' memo-card-done' : ''}`}
          onClick={handleFlipToBack}
          style={{ cursor: 'pointer' }}
        >
          {isDone && (
            <div className="done-badge">
              <span>✓</span>
              <span>已完成</span>
            </div>
          )}

          <p className={`text-lg leading-relaxed${isDone ? ' memo-text-done' : ''}`}>
            {memo.cleaned_text}
          </p>

          <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
            <time>{formatTime(memo.created_at)}</time>
            <div className="flex items-center gap-2">
              {memo.intent !== 'memo' && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-xs">
                  {memo.intent}
                </span>
              )}
              <span className="flip-hint">轻触翻转</span>
            </div>
          </div>
        </article>

        {/* ─── Back Face ─── */}
        <div className="flip-back memo-card">
          {isDone ? (
            <BackDone cd={cd} onReturn={handleFlipToFront} />
          ) : isCompleting ? (
            <BackForm
              completionNote={completionNote}
              imagePreview={imagePreview}
              isSubmitting={isSubmitting}
              fileInputRef={fileInputRef}
              onNoteChange={setCompletionNote}
              onImageChange={handleImageChange}
              onImageRemove={() => {
                setCompletionImage(null);
                setImagePreview(null);
              }}
              onCancel={() => setIsCompleting(false)}
              onSubmit={handleComplete}
            />
          ) : (
            <BackAction
              onComplete={() => setIsCompleting(true)}
              onReturn={handleFlipToFront}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function BackAction({
  onComplete,
  onReturn,
}: {
  onComplete: () => void;
  onReturn: () => void;
}) {
  return (
    <div className="back-action">
      <button onClick={onComplete} className="complete-button">
        ✓&nbsp;标记完成
      </button>
      <button onClick={onReturn} className="return-button">
        ← 返回
      </button>
    </div>
  );
}

function BackForm({
  completionNote,
  imagePreview,
  isSubmitting,
  fileInputRef,
  onNoteChange,
  onImageChange,
  onImageRemove,
  onCancel,
  onSubmit,
}: {
  completionNote: string;
  imagePreview: string | null;
  isSubmitting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onNoteChange: (v: string) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <h3 className="font-medium mb-3 text-base">记录完成情况</h3>

      <textarea
        value={completionNote}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="写点什么吧（可选）"
        className="completion-textarea"
        rows={3}
        autoFocus
      />

      <div className="mt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onImageChange}
          className="hidden"
        />
        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full object-cover max-h-32"
            />
            <button
              onClick={onImageRemove}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="image-upload-button"
          >
            + 添加图片（可选）
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={onCancel} className="form-cancel-button">
          取消
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="form-submit-button"
        >
          {isSubmitting ? '保存中…' : '✓ 完成'}
        </button>
      </div>
    </div>
  );
}

function BackDone({
  cd,
  onReturn,
}: {
  cd: CompletionData;
  onReturn: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--done-text)] text-xl leading-none">✓</span>
        <span className="font-medium text-[var(--done-text)]">已完成</span>
        {cd.completed_at && (
          <span className="ml-auto text-xs text-[var(--muted)]">
            {new Date(cd.completed_at).toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {cd.completion_note && (
        <p className="text-base leading-relaxed mb-4">{cd.completion_note}</p>
      )}

      {cd.completion_image_url && (
        <img
          src={cd.completion_image_url}
          alt="完成记录"
          className="w-full rounded-xl object-cover max-h-48 mb-4"
        />
      )}

      {!cd.completion_note && !cd.completion_image_url && (
        <p className="text-[var(--muted)] text-sm mb-4">已标记完成，未留下记录。</p>
      )}

      <button onClick={onReturn} className="return-button" style={{ marginTop: '0.5rem' }}>
        ← 返回
      </button>
    </div>
  );
}
