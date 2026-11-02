import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { localToday } from '../utils/dateUtils';
import { getIcon } from '../utils/icons';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.commandPaletteOpen);
  const close = useAppStore((s) => s.closeCommandPalette);
  const openDaily = useAppStore((s) => s.openDaily);
  const setView = useAppStore((s) => s.setView);
  const syncNow = useAppStore((s) => s.syncNow);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const completeTask = useAppStore((s) => s.completeTask);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const [filter, setFilter] = useState('');
  const [index, setIndex] = useState(0);

  const commands: Command[] = useMemo(
    () => [
      { id: 'today', label: t('nav.today'), shortcut: 'Ctrl+Shift+Space', action: () => { close(); void openDaily(localToday()); } },
      { id: 'search', label: t('commands.search'), shortcut: 'Ctrl+F', action: () => { close(); setView('search'); } },
      { id: 'planned', label: t('nav.planned'), action: () => { close(); void openDaily(localToday()); } },
      { id: 'inbox', label: t('nav.inbox'), action: () => { close(); void openDaily(localToday()); } },
      { id: 'sync', label: t('actions.sync'), action: () => { close(); void syncNow(); } },
      { id: 'undo', label: t('commands.undo'), shortcut: 'Ctrl+Z', action: () => { close(); void undo(); } },
      { id: 'redo', label: t('commands.redo'), shortcut: 'Ctrl+Y', action: () => { close(); void redo(); } },
      {
        id: 'done',
        label: t('commands.completeTask'),
        shortcut: 'Ctrl+Enter',
        action: () => {
          close();
          if (selectedNodeId) void completeTask(selectedNodeId);
        },
      },
      { id: 'settings', label: t('nav.settings'), action: () => { close(); setView('settings'); } },
    ],
    [t, close, openDaily, setView, syncNow, undo, redo, completeTask, selectedNodeId],
  );

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(filter.toLowerCase()));

  useEffect(() => {
    if (open) {
      setFilter('');
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [filter]);

  if (!open) return null;

  const run = (cmd: Command) => {
    cmd.action();
    if (cmd.id === 'search') setSearchQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh] backdrop-blur-sm" onClick={close}>
      <div className="w-full max-w-lg animate-[fadeIn_0.15s_ease] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          {(() => {
            const Icon = getIcon('search');
            return <Icon size={14} className="text-[var(--muted)]" />;
          })()}
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('commands.placeholder')}
            className="flex-1 bg-transparent text-xs outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, filtered.length - 1));
              if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
              if (e.key === 'Enter' && filtered[index]) run(filtered[index]);
            }}
          />
          <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">Esc</kbd>
        </div>
        <ul className="max-h-64 overflow-auto py-1">
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs ${i === index ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-[var(--surface-2)]'}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(cmd)}
              >
                <span>{cmd.label}</span>
                {cmd.shortcut && <span className="text-[10px] text-[var(--muted)]">{cmd.shortcut}</span>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-center text-xs text-[var(--muted)]">{t('queries.noResults')}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
