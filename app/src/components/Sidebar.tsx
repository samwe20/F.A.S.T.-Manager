import { useTranslation } from 'react-i18next';
import { useInkPaper } from '../hooks/useInkPaper';
import { useAppStore } from '../store/appStore';
import { labelInk } from '../utils/color';
import { localToday } from '../utils/dateUtils';
import { getIcon } from '../utils/icons';

export function Sidebar() {
  const { t } = useTranslation();
  const activeView = useAppStore((s) => s.activeView);
  const activeTypeId = useAppStore((s) => s.activeTypeId);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const objectTypes = useAppStore((s) => s.objectTypes);
  const nodes = useAppStore((s) => s.nodes);
  const openType = useAppStore((s) => s.openType);
  const openDaily = useAppStore((s) => s.openDaily);
  const setView = useAppStore((s) => s.setView);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const syncNow = useAppStore((s) => s.syncNow);
  const language = useAppStore((s) => s.settings?.language ?? 'cs');
  const updateSettings = useAppStore((s) => s.updateSettings);
  const paper = useInkPaper();

  const today = localToday();
  const selected = nodes.find((node) => node.id === selectedNodeId);
  const onToday =
    activeView === 'object' &&
    selected?.typeId === 'dailyNote' &&
    String(selected.fieldValues.dailyNote?.date ?? '') === today;
  const types = objectTypes.filter((type) => type.id !== 'tag' && type.id !== 'folder' && type.id !== 'dailyNote');

  const CalendarIcon = getIcon('calendar');
  const TodayIcon = getIcon('calendar-days');
  const SettingsIcon = getIcon('settings');

  return (
    <aside className="app-rail flex h-full w-56 shrink-0 flex-col px-5 py-7">
      <div className="brand">Fast</div>

      <div className="mt-8 flex-1 space-y-7 overflow-auto">
        <div>
          <button type="button" onClick={() => setView('calendar')} className={`ui-nav ${activeView === 'calendar' ? 'is-active' : ''}`}>
            <CalendarIcon size={15} strokeWidth={1.5} />
            {t('nav.calendar')}
          </button>
          <button type="button" onClick={() => void openDaily(today)} className={`ui-nav ${onToday ? 'is-active' : ''}`}>
            <TodayIcon size={15} strokeWidth={1.5} />
            {t('nav.today')}
          </button>
        </div>

        <div>
          <div className="ui-section-title">{t('nav.types')}</div>
          <div className="mt-1">
            {types.map((type) => {
              const count = nodes.filter((node) => node.typeId === type.id).length;
              const active = activeView === 'type' && activeTypeId === type.id;
              const Icon = getIcon(type.icon);
              const ink = labelInk(type.color, paper);
              return (
                <button key={type.id} type="button" onClick={() => openType(type.id)} className={`ui-nav ${active ? 'is-active' : ''}`}>
                  <Icon size={14} strokeWidth={1.5} color={ink} />
                  <span className="min-w-0 flex-1 truncate" style={{ color: ink }}>{t(`supertags.${type.id}`, type.name)}</span>
                  <span className="text-[12px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-1 pt-4">
        {syncStatus.enabled && (
          <button type="button" onClick={() => void syncNow()} className="ui-nav">
            {syncStatus.connected ? t('settings.connected') : t('settings.disconnected')}
          </button>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setView('settings')} className={`ui-nav min-w-0 flex-1 ${activeView === 'settings' ? 'is-active' : ''}`}>
            <SettingsIcon size={15} strokeWidth={1.5} />
            {t('nav.settings')}
          </button>
          <div className="flex shrink-0 gap-1 text-[11px] tracking-wide text-[var(--muted)]">
            {(['cs', 'en'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                title={t('settings.language')}
                onClick={() => void updateSettings({ language: lang })}
                className={language === lang ? 'text-[var(--rail-text)]' : 'text-[var(--rail-muted)]'}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
