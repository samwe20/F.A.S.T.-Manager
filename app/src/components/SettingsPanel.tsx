import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestNotificationPermission } from '../services/reminderService';
import { useAppStore } from '../store/appStore';
import type { Language, Theme } from '../types';
import { getIcon } from '../utils/icons';
import { FolderActions, FolderTree } from './FolderTree';

export function SettingsPanel() {
  const { t, i18n } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const syncNow = useAppStore((s) => s.syncNow);
  const chooseVault = useAppStore((s) => s.chooseVault);
  const loadVault = useAppStore((s) => s.loadVault);
  const disconnectVault = useAppStore((s) => s.disconnectVault);
  const vaultError = useAppStore((s) => s.vaultError);
  const vaultSavedAt = useAppStore((s) => s.vaultSavedAt);
  const vaultLabel = settings?.vaultLabel || settings?.vaultPath;
  const setView = useAppStore((s) => s.setView);
  const queries = useAppStore((s) => s.queries);
  const collections = useAppStore((s) => s.collections);
  const activeTypeId = useAppStore((s) => s.activeTypeId);
  const openCollection = useAppStore((s) => s.openCollection);
  const addCollection = useAppStore((s) => s.addCollection);
  const [collectionName, setCollectionName] = useState('');

  if (!settings) return null;

  return (
    <div className="settings-sheet">
      <div>
        <h1 className="text-4xl">{t('settings.title')}</h1>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{t('settings.openSource')}</p>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <h2 className="mb-3 text-xs font-semibold">{t('settings.theme')}</h2>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!settings.wideLayout}
            onChange={(event) => void updateSettings({ wideLayout: event.target.checked })}
          />
          {t('settings.wide')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(['light', 'dark', 'system'] as Theme[]).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => void updateSettings({ theme })}
              className={`rounded-md px-3 py-1.5 text-xs ${
                settings.theme === theme
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {t(`settings.theme${theme[0].toUpperCase()}${theme.slice(1)}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <h2 className="mb-3 text-xs font-semibold">{t('settings.language')}</h2>
        <div className="flex gap-1.5">
          {(['cs', 'en'] as Language[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => void updateSettings({ language: lang })}
              className={`rounded-md px-3 py-1.5 text-xs ${
                settings.language === lang
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {lang === 'cs' ? 'Čeština' : 'English'}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">i18n: {i18n.language}</p>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <h2 className="mb-1.5 text-xs font-semibold">{t('settings.organize')}</h2>
        <p className="mb-3 text-[11px] text-[var(--muted)]">{t('settings.organizeHint')}</p>
        <button
          type="button"
          onClick={() => setView('studio')}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-[var(--on-accent)]"
        >
          {t('settings.studio')}
        </button>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-[var(--muted)]">{t('settings.organizeMore')}</summary>
          <div className="mt-3 space-y-3">
            <div>
              <div className="ui-section-title">{t('nav.queries')}</div>
              <div className="space-y-0.5">
                {queries.map((query) => {
                  const Icon = getIcon(query.icon);
                  const queryLabels: Record<string, string> = {
                    'q-tasks': t('queries.myTasks'),
                    'q-questions': t('queries.openQuestions'),
                    'q-overdue': t('queries.overdue'),
                  };
                  return (
                    <button
                      key={query.id}
                      type="button"
                      onClick={() => setView('query', query.id)}
                      className="ui-nav text-[var(--muted)] hover:bg-[var(--surface-2)]"
                    >
                      <Icon size={14} strokeWidth={2} />
                      {queryLabels[query.id] ?? query.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="ui-section-title">{t('nav.collections')}</div>
              <div className="space-y-0.5">
                {collections.map((collection) => (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => openCollection(collection.id)}
                    className="ui-nav text-[var(--muted)] hover:bg-[var(--surface-2)]"
                  >
                    {collection.name}
                  </button>
                ))}
              </div>
              <form
                className="mt-1 flex gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!collectionName.trim()) return;
                  void addCollection(collectionName.trim(), activeTypeId || 'note');
                  setCollectionName('');
                }}
              >
                <input
                  value={collectionName}
                  onChange={(event) => setCollectionName(event.target.value)}
                  placeholder={t('collection.new')}
                  className="ui-input"
                />
              </form>
            </div>
            <div>
              <div className="ui-section-title">{t('nav.folders')}</div>
              <FolderTree parentId={null} />
              <div className="mt-1.5">
                <FolderActions />
              </div>
            </div>
          </div>
        </details>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <h2 className="mb-1.5 text-xs font-semibold">{t('vault.title')}</h2>
        <p className="mb-3 text-[11px] text-[var(--muted)]">{t('vault.hint')}</p>
        <p className="mb-3 break-all text-xs">{vaultLabel || t('vault.none')}</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => void chooseVault()}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-[var(--on-accent)]"
          >
            {t('vault.choose')}
          </button>
          {vaultLabel && (
            <button type="button" onClick={() => void loadVault()} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs">
              {t('vault.load')}
            </button>
          )}
          {vaultLabel && (
            <button type="button" onClick={() => void disconnectVault()} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs">
              {t('vault.disconnect')}
            </button>
          )}
        </div>
        {vaultSavedAt && !vaultError && <p className="mt-2 text-[11px] text-[var(--muted)]">{t('vault.saved')}</p>}
        {vaultError && <p className="mt-2 text-xs text-red-400">{vaultError}</p>}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <h2 className="mb-1.5 text-xs font-semibold">{t('settings.syncSection')}</h2>
        <p className="mb-3 text-[11px] text-[var(--muted)]">{t('settings.localModeHint')}</p>

        <label className="mb-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={settings.syncEnabled}
            onChange={(e) => void updateSettings({ syncEnabled: e.target.checked })}
            className="accent-[var(--accent)]"
          />
          {t('settings.syncEnabled')}
        </label>

        {!settings.syncEnabled ? (
          <div className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)]">
            {t('settings.localMode')}
          </div>
        ) : (
          <>
            <label className="ui-label">{t('settings.syncUrl')}</label>
            <input
              type="url"
              value={settings.syncUrl}
              onChange={(e) => void updateSettings({ syncUrl: e.target.value })}
              placeholder="http://localhost:3847"
              className="ui-input mb-2"
            />
            <p className="mb-2 text-[11px] text-[var(--muted)]">{t('settings.syncUrlHint')}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-[var(--surface-2)] p-2">
                <div className="text-[10px] uppercase text-[var(--muted)]">{t('settings.syncStatus')}</div>
                <div className={syncStatus.connected ? 'text-green-500' : 'text-amber-500'}>
                  {syncStatus.connected ? t('settings.connected') : t('settings.disconnected')}
                  {syncStatus.syncing && ` · ${t('settings.syncing')}`}
                </div>
              </div>
              <div className="rounded-md bg-[var(--surface-2)] p-2">
                <div className="text-[10px] uppercase text-[var(--muted)]">{t('settings.pending')}</div>
                <div>{syncStatus.pendingCount}</div>
              </div>
            </div>
            {syncStatus.error && (
              <p className="mt-2 text-xs text-red-400">
                {t('sync.error')}: {syncStatus.error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void syncNow()}
              className="mt-3 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-[var(--on-accent)]"
            >
              {t('actions.sync')}
            </button>
          </>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <h2 className="mb-1.5 text-xs font-semibold">{t('reminders.title')}</h2>
        <p className="mb-2 text-[11px] text-[var(--muted)]">{t('reminders.hint')}</p>
        <button
          type="button"
          onClick={() => void requestNotificationPermission()}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]"
        >
          {t('reminders.enable')}
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-2 text-sm font-semibold">{t('reminders.title')}</h2>
        <p className="mb-3 text-xs text-[var(--muted)]">{t('reminders.hint')}</p>
        <button
          type="button"
          onClick={() => void requestNotificationPermission()}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)]"
        >
          {t('reminders.enable')}
        </button>
      </section>
    </div>
  );
}
