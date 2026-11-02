import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import type { DataView, NodeRecord } from '../types';
import { localToday } from '../utils/dateUtils';
import { displayTitle, resolveLinks } from '../utils/nodeUtils';
import { getIcon } from '../utils/icons';
import { QueryBuilder } from './QueryBuilder';

export function ObjectIndex() {
  const { t } = useTranslation();
  const activeView = useAppStore((s) => s.activeView);
  const nodes = useAppStore((s) => s.nodes);
  const objectTypes = useAppStore((s) => s.objectTypes);
  const queries = useAppStore((s) => s.queries);
  const collections = useAppStore((s) => s.collections);
  const activeTypeId = useAppStore((s) => s.activeTypeId);
  const activeCollectionId = useAppStore((s) => s.activeCollectionId);
  const dataView = useAppStore((s) => s.dataView);
  const setDataView = useAppStore((s) => s.setDataView);
  const openObject = useAppStore((s) => s.openObject);
  const getVisibleNodes = useAppStore((s) => s.getVisibleNodes);
  const getQueryResults = useAppStore((s) => s.getQueryResults);
  const getSearchResults = useAppStore((s) => s.getSearchResults);
  const [builder, setBuilder] = useState(false);

  const type = objectTypes.find((item) => item.id === activeTypeId);
  const collection = collections.find((item) => item.id === activeCollectionId);

  const rows = useMemo(() => {
    if (activeView === 'type' && activeTypeId) {
      return nodes.filter((node) => node.typeId === activeTypeId || node.supertagIds.includes(activeTypeId));
    }
    if (activeView === 'collection' && collection) {
      return collection.objectIds
        .map((id) => nodes.find((node) => node.id === id))
        .filter((node): node is NodeRecord => !!node);
    }
    if (activeView === 'query') return getQueryResults();
    if (activeView === 'search') return getSearchResults();
    return getVisibleNodes();
  }, [activeView, activeTypeId, collection, nodes, getQueryResults, getSearchResults, getVisibleNodes]);

  const showViews = activeView === 'type' || activeView === 'query' || activeView === 'collection';
  const selectField = type?.fields.find((field) => field.type === 'select');
  const view = showViews ? dataView : 'list';

  return (
    <div className="index-sheet">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-title)] text-3xl text-[var(--text)]">
            {activeView === 'type' && type
              ? t(`supertags.${type.id}`, type.name)
              : activeView === 'today'
                ? t('nav.today')
                : activeView === 'planned'
                  ? t('nav.planned')
                  : activeView === 'search'
                    ? t('search.title')
                    : activeView === 'query'
                      ? t('nav.queries')
                      : activeView === 'folder'
                        ? t('nav.folders')
                        : activeView === 'collection'
                          ? collection?.name || t('nav.collections')
                          : t('nav.inbox')}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('views.count', { count: rows.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showViews &&
            (['list', 'table', 'cards', 'kanban'] as DataView[]).map((mode) => {
              const Icon = getIcon(mode === 'cards' ? 'grid' : mode === 'table' ? 'table' : mode === 'kanban' ? 'kanban' : 'list');
              return (
                <button
                  key={mode}
                  type="button"
                  title={t(`views.${mode}`)}
                  onClick={() => setDataView(mode)}
                  className={`rounded-md p-1.5 ${view === mode ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--muted)]'}`}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          {activeView === 'query' && (
            <button type="button" className="text-sm text-[var(--muted)]" onClick={() => setBuilder(true)}>
              + {t('queryBuilder.new')}
            </button>
          )}
        </div>
      </div>

      {queries.length === 0 && activeView === 'query' && (
        <p className="text-sm text-[var(--muted)]">{t('views.empty')}</p>
      )}

      {view === 'table' && <TableView rows={rows} typeId={type?.id} onOpen={openObject} />}
      {view === 'cards' && <CardView rows={rows} onOpen={openObject} />}
      {view === 'kanban' && (
        <KanbanView rows={rows} typeId={type?.id} fieldKey={selectField?.key} options={selectField?.options ?? []} onOpen={openObject} />
      )}
      {view === 'list' && <ListView rows={rows} today={localToday()} onOpen={openObject} />}
      {rows.length === 0 && <p className="mt-8 text-sm text-[var(--muted)]">{t('views.empty')}</p>}
      {builder && <QueryBuilder onClose={() => setBuilder(false)} />}
    </div>
  );
}

function ListView({ rows, onOpen, today }: { rows: NodeRecord[]; onOpen: (id: string) => void; today: string }) {
  const objectTypes = useAppStore((s) => s.objectTypes);
  const nodes = useAppStore((s) => s.nodes);
  const { t } = useTranslation();
  return (
    <div className="divide-y divide-[var(--border)]">
      {rows.map((node) => {
        const type = objectTypes.find((item) => item.id === (node.typeId ?? node.supertagIds[0]));
        const openTodo = (node.blocks ?? []).find((block) => block.type === 'todo' && !block.checked);
        const due = node.typeId ? node.fieldValues[node.typeId]?.dueDate : undefined;
        return (
          <button key={node.id} type="button" onClick={() => onOpen(node.id)} className="flex w-full items-baseline gap-3 py-3 text-left">
            <span className="w-24 shrink-0 text-xs font-medium" style={{ color: type?.color }}>
              {type ? t(`supertags.${type.id}`, type.name) : ''}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base">{displayTitle(nodes, node) || t('object.untitled')}</span>
              {openTodo && <span className="block truncate text-xs text-[var(--muted)]">☐ {resolveLinks(openTodo.text, nodes)}</span>}
            </span>
            {typeof due === 'string' && due && (
              <span className={`text-xs ${due < today ? 'text-red-700' : 'text-[var(--muted)]'}`}>{due}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CardView({ rows, onOpen }: { rows: NodeRecord[]; onOpen: (id: string) => void }) {
  const nodes = useAppStore((s) => s.nodes);
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => onOpen(node.id)}
          className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 text-left shadow-sm"
        >
          <div className="font-[var(--font-title)] text-xl">{displayTitle(nodes, node) || t('object.untitled')}</div>
          <p className="mt-2 line-clamp-3 text-sm text-[var(--muted)]">
            {(node.blocks ?? []).map((block) => resolveLinks(block.text, nodes)).filter(Boolean).slice(0, 3).join(' · ')}
          </p>
        </button>
      ))}
    </div>
  );
}

function TableView({
  rows,
  typeId,
  onOpen,
}: {
  rows: NodeRecord[];
  typeId?: string;
  onOpen: (id: string) => void;
}) {
  const objectTypes = useAppStore((s) => s.objectTypes);
  const nodes = useAppStore((s) => s.nodes);
  const { t } = useTranslation();
  const type = objectTypes.find((item) => item.id === typeId);
  const fields = type?.fields ?? [];
  return (
    <div className="overflow-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2">{t('object.title')}</th>
            {fields.map((field) => (
              <th key={field.key} className="px-3 py-2">
                {field.label || t(`fields.${field.key}`, field.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((node) => {
            const bag = (typeId && node.fieldValues[typeId]) || {};
            return (
              <tr key={node.id} className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-2)]" onClick={() => onOpen(node.id)}>
                <td className="px-3 py-2">{displayTitle(nodes, node)}</td>
                {fields.map((field) => (
                  <td key={field.key} className="px-3 py-2 text-[var(--muted)]">
                    {String(bag[field.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({
  rows,
  typeId,
  fieldKey,
  options,
  onOpen,
}: {
  rows: NodeRecord[];
  typeId?: string;
  fieldKey?: string;
  options: string[];
  onOpen: (id: string) => void;
}) {
  const nodes = useAppStore((s) => s.nodes);
  const { t } = useTranslation();
  if (!fieldKey || !typeId) return <p className="text-sm text-[var(--muted)]">{t('views.kanbanNeedsLabel')}</p>;
  const columns = options.length ? options : ['—'];
  return (
    <div className="flex gap-3 overflow-auto pb-4">
      {columns.map((option) => (
        <div key={option} className="w-64 shrink-0 rounded-xl bg-[var(--surface-2)] p-2">
          <div className="px-2 py-1 text-xs font-semibold uppercase text-[var(--muted)]">{t(`status.${option}`, option)}</div>
          <div className="space-y-2">
            {rows
              .filter((node) => String(node.fieldValues[typeId]?.[fieldKey] ?? '') === option)
              .map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onOpen(node.id)}
                  className="block w-full rounded-lg bg-[var(--paper)] px-3 py-2 text-left text-sm shadow-sm"
                >
                  {displayTitle(nodes, node)}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
