import type { NodeRecord } from '../types';
import { resolveNodeTitle } from '../utils/nodeUtils';

const firedReminders = new Set<string>();

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function startReminderChecker(
  getNodes: () => NodeRecord[],
  getLanguage: () => string,
): () => void {
  const tick = () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = Date.now();
    const nodes = getNodes();

    for (const node of nodes) {
      for (const tagId of node.supertagIds) {
        const reminder = node.fieldValues[tagId]?.reminderTime;
        if (typeof reminder !== 'string' || !reminder) continue;

        const reminderMs = new Date(reminder).getTime();
        if (Number.isNaN(reminderMs)) continue;

        const key = `${node.id}:${reminder}`;
        if (reminderMs <= now && !firedReminders.has(key)) {
          firedReminders.add(key);
          const title = node.content.trim() || 'F.A.S.T Manager';
          new Notification('F.A.S.T Manager', {
            body: title,
            tag: key,
            lang: getLanguage(),
          });
        }
      }
    }
  };

  tick();
  const id = window.setInterval(tick, 30_000);
  return () => window.clearInterval(id);
}

export function getUpcomingReminders(nodes: NodeRecord[]): NodeRecord[] {
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;

  return nodes.filter((node) => {
    for (const tagId of node.supertagIds) {
      const reminder = node.fieldValues[tagId]?.reminderTime;
      if (typeof reminder !== 'string' || !reminder) continue;
      const ms = new Date(reminder).getTime();
      if (!Number.isNaN(ms) && ms >= now && ms <= in24h) return true;
    }
    return false;
  });
}

export function formatReminderLabel(nodes: NodeRecord[], node: NodeRecord): string {
  return resolveNodeTitle(nodes, node.id);
}
