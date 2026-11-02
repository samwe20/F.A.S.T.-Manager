import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';

const LIGHT_PAPER = '#ffffff';
const DARK_PAPER = '#242426';

export function useInkPaper(): string {
  const theme = useAppStore((s) => s.settings?.theme ?? 'light');
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return theme === 'dark' || (theme === 'system' && systemDark) ? DARK_PAPER : LIGHT_PAPER;
}
