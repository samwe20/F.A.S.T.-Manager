import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { addDaysIso, localToday, weekDates } from '../utils/dateUtils';
import { displayTitle } from '../utils/nodeUtils';

function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  const weekday = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - weekday);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function CalendarView() {
  const { t, i18n } = useTranslation();
  const nodes = useAppStore((s) => s.nodes);
  const openDaily = useAppStore((s) => s.openDaily);
  const openObject = useAppStore((s) => s.openObject);
  const today = localToday();
  const initial = new Date();
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [selected, setSelected] = useState(today);
  const [mode, setMode] = useState<'month' | 'week'>('week');
  const week = weekDates(selected);

  const days = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const label = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
    new Date(cursor.year, cursor.month, 1),
  );

  const move = (delta: number) => {
    if (mode === 'week') {
      const next = addDaysIso(selected, delta * 7);
      const [year, month] = next.split('-').map(Number);
      setSelected(next);
      setCursor({ year, month: month - 1 });
      return;
    }
    setCursor((current) => shift(current, delta));
  };

  const dated = nodes.filter((node) => node.typeId !== 'dailyNote' && nodeTouchesDay(node, selected));
  const created = nodes.filter((node) => node.createdAt.slice(0, 10) === selected && !dated.includes(node));

  const selectedDate = new Date(`${selected}T12:00:00`);
  const selectedLabel = Number.isNaN(selectedDate.getTime())
    ? selected
    : new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate);

  return (
    <div className="calendar-sheet">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-4xl capitalize">{label}</h1>
        <div className="flex items-center gap-3 text-[13px] text-[var(--muted)]">
          <button type="button" onClick={() => move(-1)} aria-label={t('calendar.previous')}>←</button>
          <button
            type="button"
            className="text-[var(--text)]"
            onClick={() => {
              const now = new Date();
              setCursor({ year: now.getFullYear(), month: now.getMonth() });
              setSelected(today);
            }}
          >
            {t('calendar.today')}
          </button>
          <button type="button" onClick={() => move(1)} aria-label={t('calendar.next')}>→</button>
          <button type="button" className={mode === 'week' ? 'text-[var(--text)]' : ''} onClick={() => setMode('week')}>
            {t('calendar.week')}
          </button>
          <button type="button" className={mode === 'month' ? 'text-[var(--text)]' : ''} onClick={() => setMode('month')}>
            {t('calendar.month')}
          </button>
        </div>
      </div>
      {mode === 'week' && (
        <div className="week-row">
          {week.map((key) => {
            const day = new Date(`${key}T12:00:00`);
            const count = nodes.filter((node) => nodeTouchesDay(node, key)).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => void openDaily(key)}
                className={`week-day ${key === today ? 'is-today' : ''}`}
              >
                <small>{new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(day)}</small>
                <strong>{day.getDate()}</strong>
                {count > 0 && <small>{count}</small>}
              </button>
            );
          })}
        </div>
      )}
      {mode === 'month' && (
        <div className="mt-8">
          <div className="grid grid-cols-7 gap-1 text-[12px] text-[var(--muted)]">
            {Array.from({ length: 7 }, (_, index) =>
              new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(new Date(2024, 0, 1 + index)),
            ).map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = iso(day);
              const note = nodes.find((node) => node.typeId === 'dailyNote' && node.fieldValues.dailyNote?.date === key);
              const inMonth = day.getMonth() === cursor.month;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void openDaily(key)}
                  className={`month-day h-12 text-left text-sm ${key === today ? 'is-today text-[var(--text)]' : 'text-[var(--muted)]'} ${inMonth ? '' : 'opacity-40'}`}
                >
                  <span className="block">{day.getDate()}</span>
                  {note && <span className="mt-1 block h-px w-3 bg-[var(--muted)]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <section className="mt-10">
        <h2 className="font-[var(--font-title)] text-2xl capitalize">{selectedLabel}</h2>
        <button type="button" className="mt-3 text-[13px] text-[var(--muted)] hover:text-[var(--text)]" onClick={() => void openDaily(selected)}>
          {t('calendar.openNote')}
        </button>
        {dated.length > 0 && <h3 className="quiet-label mt-8">{t('calendar.dated')}</h3>}
        <div className="mt-2 space-y-1">
          {dated.map((node) => (
            <button key={node.id} type="button" className="block text-[15px]" onClick={() => openObject(node.id)}>
              {presentTitle(nodes, node, i18n.language)}
            </button>
          ))}
        </div>
        {created.length > 0 && <h3 className="quiet-label mt-8">{t('calendar.created')}</h3>}
        <div className="mt-2 space-y-1">
          {created.map((node) => (
            <button key={node.id} type="button" className="block text-[15px]" onClick={() => openObject(node.id)}>
              {presentTitle(nodes, node, i18n.language)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function presentTitle(nodes: Parameters<typeof displayTitle>[0], node: Parameters<typeof displayTitle>[1], language: string): string {
  const title = displayTitle(nodes, node);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(title)) return title;
  const date = new Date(`${title}T12:00:00`);
  const label = new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function nodeTouchesDay(node: { typeId?: string; fieldValues: Record<string, Record<string, string | number | boolean>> }, day: string): boolean {
  const bag = node.typeId ? node.fieldValues[node.typeId] ?? {} : {};
  return Object.values(bag).some((value) => typeof value === 'string' && value.slice(0, 10) === day);
}

function shift(cursor: { year: number; month: number }, delta: number) {
  const date = new Date(cursor.year, cursor.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}
