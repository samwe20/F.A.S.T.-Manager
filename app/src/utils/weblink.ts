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

export function weblinkTitle(url: string): string {
  const parsed = new URL(url.trim());
  const host = parsed.hostname.replace(/^www\./, '');
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
  return `${host}${path}` || host;
}
