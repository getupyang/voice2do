'use client';

import { useRef, useState } from 'react';
import { Memo } from '@/types';
import { formatTime } from '@/lib/utils';

export function MemoCard({ memo: initialMemo }: { memo: Memo }) {
  const [memo, setMemo] = useState(initialMemo);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [completionImage, setCompletionImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDone = memo.status === 'done';

  const handleFlipToFront = () => {
    setIsFlipped(false);
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
    setSubmitError(null);
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
      if (!res.ok) throw new Error('保存失败，请重试');

      const json = await res.json();
      setMemo(json.data);
      // 有图片但 URL 为空说明上传失败（DB 更新仍成功）
      if (completionImage && !json.data.completion_image_url) {
        setSubmitError('图片上传失败，已保存文字记录');
      }
      setIsCompleting(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Back face: click blank area to flip back, EXCEPT when filling in the form
  const handleBackClick = () => {
    if (!isCompleting) handleFlipToFront();
  };

  return (
    <>
      <div className="flip-container">
        <div className={`flip-inner${isFlipped ? ' flipped' : ''}`}>
          {/* ─── Front Face ─── */}
          <article
            className={`flip-front memo-card${isDone ? ' memo-card-done' : ''}`}
            onClick={() => setIsFlipped(true)}
            style={{ cursor: 'pointer' }}
          >
            {/* ① 已完成角标：绝对定位小圆圈，不占布局空间 */}
            {isDone && <span className="done-dot">✓</span>}

            <p className={`text-lg leading-relaxed${isDone ? ' memo-text-done' : ''}`}>
              {memo.cleaned_text}
            </p>

            <div className="mt-2 flex items-center justify-between text-sm text-[var(--muted)]">
              <time>{formatTime(memo.created_at)}</time>
              {memo.intent !== 'memo' && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-xs">
                  {memo.intent}
                </span>
              )}
            </div>
          </article>

          {/* ─── Back Face ─── ③ 点击空白处翻回正面 */}
          <div className="flip-back memo-card" onClick={handleBackClick} style={{ cursor: 'pointer' }}>
            {isDone ? (
              <BackDone memo={memo} onOpenModal={() => setModalOpen(true)} />
            ) : isCompleting ? (
              <BackForm
                completionNote={completionNote}
                imagePreview={imagePreview}
                isSubmitting={isSubmitting}
                submitError={submitError}
                fileInputRef={fileInputRef}
                onNoteChange={setCompletionNote}
                onImageChange={handleImageChange}
                onImageRemove={() => { setCompletionImage(null); setImagePreview(null); }}
                onCancel={() => setIsCompleting(false)}
                onSubmit={handleComplete}
              />
            ) : (
              <BackAction onComplete={(e) => { e.stopPropagation(); setIsCompleting(true); }} />
            )}
          </div>
        </div>
      </div>

      {/* ⑤ 完成记录弹窗 */}
      {modalOpen && (
        <CompletionModal memo={memo} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function BackAction({ onComplete }: { onComplete: (e: React.MouseEvent) => void }) {
  return (
    <div className="back-action">
      <button onClick={onComplete} className="complete-button">
        ✓&nbsp;标记完成
      </button>
      <p className="back-action-hint">点击空白处返回</p>
    </div>
  );
}

function BackForm({
  completionNote,
  imagePreview,
  isSubmitting,
  submitError,
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
  submitError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onNoteChange: (v: string) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  // Stop propagation so tapping anywhere inside form doesn't flip back
  return (
    <div onClick={(e) => e.stopPropagation()}>
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
            <img src={imagePreview} alt="Preview" className="w-full object-cover max-h-32" />
            <button
              onClick={onImageRemove}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()} className="image-upload-button">
            + 添加图片（可选）
          </button>
        )}
      </div>

      {submitError && (
        <p className="mt-2 text-xs text-red-500">{submitError}</p>
      )}

      <div className="mt-3 flex gap-3">
        <button onClick={onCancel} className="form-cancel-button">取消</button>
        <button onClick={onSubmit} disabled={isSubmitting} className="form-submit-button">
          {isSubmitting ? '保存中…' : '✓ 完成'}
        </button>
      </div>
    </div>
  );
}

function BackDone({ memo, onOpenModal }: { memo: Memo; onOpenModal: () => void }) {
  const hasRecord = !!(memo.completion_note || memo.completion_image_url);

  return (
    <div className="back-done-wrapper">
      {/* 完成时间行 */}
      <div className="back-done-header">
        <span className="back-done-check">✓</span>
        <span className="back-done-label">已完成</span>
        {memo.completed_at && (
          <span className="back-done-time">
            {new Date(memo.completed_at).toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* 记录预览区（点击打开弹窗） */}
      {hasRecord ? (
        <div
          className="back-done-preview"
          onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
        >
          {memo.completion_image_url && (
            <img
              src={memo.completion_image_url}
              alt="完成记录"
              className="back-done-preview-img"
            />
          )}
          {memo.completion_note && (
            <p className="back-done-preview-note">{memo.completion_note}</p>
          )}
          <span className="back-done-preview-hint">点击查看完整记录</span>
        </div>
      ) : (
        <p className="back-done-empty">仅标记完成，未留下记录。</p>
      )}

      <p className="back-done-return-hint">点击空白处返回</p>
    </div>
  );
}

function CompletionModal({ memo, onClose }: { memo: Memo; onClose: () => void }) {
  const dateStr = memo.completed_at
    ? new Date(memo.completed_at).toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {memo.completion_image_url && (
          <img
            src={memo.completion_image_url}
            alt="完成记录"
            className="modal-image"
          />
        )}

        {memo.completion_note && (
          <p className="modal-note">{memo.completion_note}</p>
        )}

        {dateStr && <p className="modal-time">完成于 {dateStr}</p>}
      </div>
    </div>
  );
}
