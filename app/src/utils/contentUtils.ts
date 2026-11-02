const recurrenceOptions = ['none', 'daily', 'weekly', 'monthly'] as const;
export type Recurrence = (typeof recurrenceOptions)[number];

export function nextDueDate(current: string, recurrence: string): string {
  const base = current ? new Date(current) : new Date();
  if (Number.isNaN(base.getTime())) return new Date().toISOString().slice(0, 10);

  switch (recurrence) {
    case 'daily':
      base.setDate(base.getDate() + 1);
      break;
    case 'weekly':
      base.setDate(base.getDate() + 7);
      break;
    case 'monthly':
      base.setMonth(base.getMonth() + 1);
      break;
    default:
      return '';
  }
  return base.toISOString().slice(0, 10);
}

export function shouldSpawnRecurrence(recurrence: string): boolean {
  return recurrence !== 'none' && recurrence !== '';
}

export function parseChecklistLines(content: string): { lines: string[]; hasChecklist: boolean } {
  const lines = content.split('\n');
  const hasChecklist = lines.some((l) => /^-\s*\[[ xX]\]/.test(l.trim()));
  return { lines, hasChecklist };
}

export function toggleChecklistLine(content: string, lineIndex: number): string {
  const lines = content.split('\n');
  const line = lines[lineIndex];
  if (!line) return content;

  const checked = /^-\s*\[[xX]\]/.test(line.trim());
  lines[lineIndex] = line.replace(/^(-\s*)\[[ xX]\]/, checked ? '$1[ ]' : '$1[x]');
  return lines.join('\n');
}

export function formatNodeContentHtml(content: string): string {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .split('\n')
    .map((line) => {
      const checklist = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
      if (checklist) {
        const checked = checklist[2].toLowerCase() === 'x';
        return `<div class="checklist-line" data-checked="${checked}"><span class="checklist-box">${checked ? '☑' : '☐'}</span> ${checklist[3]}</div>`;
      }
      return `<div>${line || '&nbsp;'}</div>`;
    })
    .join('');
}
