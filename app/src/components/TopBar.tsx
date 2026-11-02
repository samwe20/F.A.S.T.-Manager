import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { getIcon } from '../utils/icons';

export function TopBar() {
  const { t } = useTranslation();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setView = useAppStore((s) => s.setView);
  const openCommandPalette = useAppStore((s) => s.openCommandPalette);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndoAction = useAppStore((s) => s.canUndoAction);
  const canRedoAction = useAppStore((s) => s.canRedoAction);
  const historyTick = useAppStore((s) => s.historyTick);
  const wideLayout = useAppStore((s) => !!s.settings?.wideLayout);
  const updateSettings = useAppStore((s) => s.updateSettings);
  void historyTick;

  const SearchIcon = getIcon('search');

  return (
    <header className="topbar shrink-0 bg-[var(--desk)]">
      <div className="topbar-search">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value) setView('search');
          }}
          onFocus={() => {
            if (searchQuery) setView('search');
          }}
          placeholder={t('actions.search')}
          aria-label={t('actions.search')}
          className="ui-input"
        />
      </div>

      <div className="flex items-center gap-0.5">
        <ToolbarButton
          icon="undo"
          label={t('commands.undo')}
          disabled={!canUndoAction()}
          onClick={() => void undo()}
        />
        <ToolbarButton
          icon="redo"
          label={t('commands.redo')}
          disabled={!canRedoAction()}
          onClick={() => void redo()}
        />
        <ToolbarButton icon="command" label={t('commands.title')} onClick={openCommandPalette} />
        <ToolbarButton
          icon="wide"
          label={t('settings.wide')}
          accent={wideLayout}
          onClick={() => void updateSettings({ wideLayout: !wideLayout })}
        />
      </div>
    </header>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  accent,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  const Icon = getIcon(icon);
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-1.5 transition ${accent ? 'bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90' : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'} disabled:opacity-30`}
    >
      <Icon size={14} strokeWidth={2} />
    </button>
  );
}
