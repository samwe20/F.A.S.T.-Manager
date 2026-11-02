import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILTIN_SUPERTAGS, useAppStore } from '../store/appStore';

export function QuickCapture() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.quickCaptureOpen);
  const closeQuickCapture = useAppStore((s) => s.closeQuickCapture);
  const quickCapture = useAppStore((s) => s.quickCapture);
  const inputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [tagId, setTagId] = useState('task');
  const [dueDate, setDueDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  useEffect(() => {
    if (open) {
      setContent('');
      setDueDate('');
      setReminderTime('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    void quickCapture({ content, supertagId: tagId, dueDate: dueDate || undefined, reminderTime: reminderTime || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm" onClick={closeQuickCapture}>
      <div
        className="w-full max-w-md animate-[fadeIn_0.15s_ease] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-0.5 text-sm font-semibold">{t('capture.title')}</h2>
        <p className="mb-3 text-[11px] text-[var(--muted)]">{t('capture.hint')}</p>

        <input
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') closeQuickCapture();
          }}
          placeholder={t('capture.placeholder')}
          className="ui-input mb-3 text-sm"
        />

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="ui-label">{t('capture.supertag')}</label>
            <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="ui-input">
              {BUILTIN_SUPERTAGS.slice(0, 6).map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{t(`supertags.${tag.id}`, tag.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ui-label">{t('fields.dueDate')}</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="ui-input" />
          </div>
        </div>

        <div className="mb-3">
          <label className="ui-label">{t('fields.reminderTime')}</label>
          <input
            type="datetime-local"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            className="ui-input"
          />
        </div>

        <div className="flex justify-end gap-1.5">
          <button type="button" onClick={closeQuickCapture} className="rounded-md px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]">
            {t('capture.cancel')}
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--on-accent)] hover:opacity-90">
            {t('capture.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
