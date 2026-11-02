/** Lokální datum ve formátu YYYY-MM-DD (ne UTC — to by u nás zlobilo kolem půlnoci). */
export function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Pondělí až neděle kolem daného data. */
export function weekDates(iso: string): string[] {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const mondayOffset = (date.getDay() + 6) % 7;
  const start = addDaysIso(iso, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDaysIso(start, index));
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export type DueTone = 'overdue' | 'today' | 'future' | 'none';

export function dueTone(iso: string | undefined, todayIso: string): DueTone {
  if (!iso) return 'none';
  if (iso < todayIso) return 'overdue';
  if (iso === todayIso) return 'today';
  return 'future';
}

/** Lidský popisek termínu: dnes / zítra / včera, jinak lokalizované datum. */
export function formatDueDate(iso: string, lang: string, t: (key: string) => string): string {
  const today = localToday();
  if (iso === today) return t('dates.today');
  if (iso === addDaysIso(today, 1)) return t('dates.tomorrow');
  if (iso === addDaysIso(today, -1)) return t('dates.yesterday');
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  if (lang === 'cs') return `${d}. ${m}. ${y}`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}
