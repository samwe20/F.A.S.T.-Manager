import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { localToday } from '../utils/dateUtils';

export function useKeyboardShortcuts() {
  const openDaily = useAppStore((s) => s.openDaily);
  const openCommandPalette = useAppStore((s) => s.openCommandPalette);
  const closeQuickCapture = useAppStore((s) => s.closeQuickCapture);
  const closeCommandPalette = useAppStore((s) => s.closeCommandPalette);
  const quickCaptureOpen = useAppStore((s) => s.quickCaptureOpen);
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const completeTask = useAppStore((s) => s.completeTask);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setView = useAppStore((s) => s.setView);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        if (quickCaptureOpen) closeQuickCapture();
        else void openDaily(localToday());
        return;
      }

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (commandPaletteOpen) closeCommandPalette();
        else openCommandPalette();
        return;
      }

      if (quickCaptureOpen || commandPaletteOpen) return;

      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        void openDaily(localToday());
      }
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        void undo();
      }
      if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        void redo();
      }
      if (mod && e.key === 'Enter' && selectedNodeId) {
        e.preventDefault();
        void completeTask(selectedNodeId);
      }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setView('search');
        const el = document.querySelector<HTMLInputElement>('header input[type="text"], header input:not([type])');
        el?.focus();
      }
      if (e.key === 'Escape') {
        setSearchQuery('');
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    openDaily,
    closeQuickCapture,
    openCommandPalette,
    closeCommandPalette,
    quickCaptureOpen,
    commandPaletteOpen,
    undo,
    redo,
    completeTask,
    selectedNodeId,
    setSearchQuery,
    setView,
  ]);
}
