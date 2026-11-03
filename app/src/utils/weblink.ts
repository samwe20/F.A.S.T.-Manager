export function isStandaloneUrl(text: string): boolean {
  const value = text.trim();
  if (!/^https?:\/\/\S+$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const URL_IN_TEXT = /https?:\/\/[^\s<>\]]+/gi;

export interface TextUrl {
  url: string;
  start: number;
  end: number;
}

/** Addresses written in ordinary text. Existing [[id]] links are left alone. */
export function urlsInText(text: string): TextUrl[] {
  const masked = text.replace(/\[\[[^\]]*\]\]/g, (chunk) => ' '.repeat(chunk.length));
  const found: TextUrl[] = [];
  for (const match of masked.matchAll(URL_IN_TEXT)) {
    const raw = match[0].replace(/[),.;:!?]+$/g, '');
    if (!raw || match.index === undefined) continue;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    } catch {
      continue;
    }
    found.push({ url: raw, start: match.index, end: match.index + raw.length });
  }
  return found;
}

export function weblinkTitle(url: string): string {
  const parsed = new URL(url.trim());
  const host = parsed.hostname.replace(/^www\./, '');
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
  return `${host}${path}` || host;
}
