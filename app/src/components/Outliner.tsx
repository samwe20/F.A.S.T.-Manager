import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { SUPERTAG_MAP } from '../data/supertags';
import { BUILTIN_SUPERTAGS, useAppStore } from '../store/appStore';
import { isFolderNode } from '../utils/folderUtils';
import { dueTone, formatDueDate, localToday } from '../utils/dateUtils';
import { FieldEditor } from './FieldEditor';
import { NodeContent } from './NodeContent';
import { NodeEmbeds } from './NodeEmbeds';
import { SupertagPill } from './SupertagPill';

export function Outliner() {
  const { t } = useTranslation();
  const nodes = useAppStore(useShallow((s) => s.getVisibleNodes()));
  const allNodes = useAppStore((s) => s.nodes);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const activeView = useAppStore((s) => s.activeView);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const selectNode = useAppStore((s) => s.selectNode);
  const editNodeContent = useAppStore((s) => s.editNodeContent);
  const addChildNode = useAppStore((s) => s.addChildNode);
  const removeNode = useAppStore((s) => s.removeNode);
  const attachTag = useAppStore((s) => s.attachTag);
  const completeTask = useAppStore((s) => s.completeTask);
  const moveNodeTo = useAppStore((s) => s.moveNodeTo);
  const openFolder = useAppStore((s) => s.openFolder);
  const activeFolderId = useAppStore((s) => s.activeFolderId);
  const resolveFolderTitle = useAppStore((s) => s.resolveFolderTitle);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragNodeId = useRef<string | null>(null);

  const handleDrop = (targetId: string, position: 'before' | 'inside') => {
    const draggedId = dragNodeId.current;
    if (!draggedId || draggedId === targetId) return;
    const target = allNodes.find((n) => n.id === targetId);
    if (!target) return;

    const parentId = position === 'inside' ? targetId : target.parentId;
    const siblings = allNodes.filter((n) => n.parentId === parentId && n.id !== draggedId).sort((a, b) => a.order - b.order);
    const targetIndex = siblings.findIndex((n) => n.id === targetId);
    const insertIndex = position === 'inside' ? 0 : targetIndex + (position === 'before' ? 0 : 1);

    void moveNodeTo(draggedId, parentId, insertIndex);
    dragNodeId.current = null;
    setDragOverId(null);
  };

  const renderNode = (node: (typeof nodes)[0], depth = 0) => {
    const children = allNodes.filter((n) => n.parentId === node.id).sort((a, b) => a.order - b.order);
    const isSelected = selectedNodeId === node.id;
    const isTask = node.supertagIds.includes('task');
    const isDone = node.fieldValues.task?.status === 'done';

    return (
      <div key={node.id}>
        <div
          draggable
          onDragStart={() => {
            dragNodeId.current = node.id;
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(node.id);
          }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(node.id, e.shiftKey ? 'inside' : 'before');
          }}
          className={`group flex items-start gap-1.5 rounded-lg border border-transparent px-1.5 py-1 transition ${isSelected ? 'border-[var(--accent)]/30 bg-[var(--accent-soft)]' : 'hover:border-[var(--border)] hover:bg-[var(--surface-2)]'} ${dragOverId === node.id ? 'ring-1 ring-[var(--accent)]' : ''} ${isDone ? 'opacity-60' : ''}`}
          style={{ marginLeft: `${depth * 12}px` }}
          onClick={() => selectNode(node.id)}
          onDoubleClick={() => {
            if (isFolderNode(node)) openFolder(node.id);
          }}
        >
          {isTask ? (
            <button
              type="button"
              className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface)] text-[10px]"
              onClick={(e) => {
                e.stopPropagation();
                void completeTask(node.id);
              }}
            >
              {isDone ? '✓' : ''}
            </button>
          ) : (
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]" />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap gap-0.5">
              {node.supertagIds.map((tagId) => (
                <SupertagPill key={tagId} tagId={tagId} />
              ))}
            </div>
            <NodeContent
              value={node.content}
              selected={isSelected}
              onChange={(v) => editNodeContent(node.id, v)}
              onTagTrigger={(tagNames, newText) => {
                const norm = (s: string) =>
                  s
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/\s+/g, '');
                const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const resolveTag = (tagName: string) => {
                  const parts = tagName.split(/\s+/);
                  for (let len = parts.length; len >= 1; len--) {
                    const sub = parts.slice(0, len).join(' ');
                    const needle = norm(sub);
                    const tag = BUILTIN_SUPERTAGS.find(
                      (tg) =>
                        tg.id.toLowerCase() === sub.toLowerCase() ||
                        norm(tg.name) === needle ||
                        norm(t(`supertags.${tg.id}`, tg.name)) === needle,
                    );
                    if (tag) return { tag, matchedText: sub };
                  }
                  return undefined;
                };
                void (async () => {
                  let stripped = newText;
                  let attached = false;
                  for (const tagName of tagNames) {
                    const resolved = resolveTag(tagName);
                    if (!resolved) continue;
                    await attachTag(node.id, resolved.tag.id);
                    attached = true;
                    stripped = stripped.replace(
                      new RegExp(`#${escapeRegExp(resolved.matchedText)}(?=[\\s.,;:!?]|$)`, 'gu'),
                      '',
                    );
                  }
                  stripped = stripped.replace(/\s{2,}/g, ' ').trim();
                  if (attached || stripped !== node.content || newText !== node.content) {
                    await editNodeContent(node.id, stripped);
                  }
                })();
              }}
            />
            {(node.embeds?.length ?? 0) > 0 && (
              <NodeEmbeds node={node} compact />
            )}
            {isTask && typeof node.fieldValues.task?.dueDate === 'string' && node.fieldValues.task.dueDate !== '' && (
              <DueChip iso={node.fieldValues.task.dueDate as string} dimmed={isDone} />
            )}
          </div>
          {isSelected && (
            <div className="flex shrink-0 gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--surface)]"
                onClick={(e) => {
                  e.stopPropagation();
                  void addChildNode(node.id);
                }}
              >
                +
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-[var(--surface)]"
                onClick={(e) => {
                  e.stopPropagation();
                  void removeNode(node.id);
                }}
              >
                {t('actions.delete')}
              </button>
            </div>
          )}
        </div>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (activeView === 'query') return <QueryResults />;

  const folderTitle = activeView === 'folder' && activeFolderId ? resolveFolderTitle(activeFolderId) : null;

  return (
    <div className="space-y-0.5 p-2.5">
      {activeView === 'folder' && folderTitle && (
        <p className="mb-2 text-[11px] text-[var(--muted)]">{t('folders.viewing', { name: folderTitle })}</p>
      )}
      {activeView === 'search' && searchQuery && (
        <p className="mb-2 text-[11px] text-[var(--muted)]">
          {t('search.results', { count: nodes.length, query: searchQuery })}
        </p>
      )}
      {nodes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-5 text-center">
          <p className="text-xs text-[var(--muted)]">{t('queries.noResults')}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">{t('capture.hint')}</p>
        </div>
      ) : (
        nodes.map((node) => renderNode(node))
      )}
    </div>
  );
}

function QueryResults() {
  const { t, i18n } = useTranslation();
  const results = useAppStore(useShallow((s) => s.getQueryResults()));
  const selectNode = useAppStore((s) => s.selectNode);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const completeTask = useAppStore((s) => s.completeTask);

  if (results.length === 0) {
    return (
      <div className="p-5 text-center">
        <p className="text-xs text-[var(--muted)]">{t('queries.noResults')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto p-2.5">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-wide text-[var(--muted)]">
            <th className="px-2 py-1.5">#</th>
            <th className="px-2 py-1.5">{t('fields.status')}</th>
            <th className="px-2 py-1.5">{t('fields.dueDate')}</th>
            <th className="px-2 py-1.5">{t('fields.priority')}</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {results.map((node) => {
            const primaryTag = node.supertagIds[0];
            const fields = primaryTag ? node.fieldValues[primaryTag] ?? {} : {};
            return (
              <tr
                key={node.id}
                className={`border-b border-[var(--border)] transition hover:bg-[var(--surface-2)] ${selectedNodeId === node.id ? 'bg-[var(--accent-soft)]' : ''}`}
              >
                <td className="cursor-pointer px-2 py-1.5" onClick={() => selectNode(node.id)}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {node.supertagIds.map((id) => (
                      <SupertagPill key={id} tagId={id} />
                    ))}
                    <span>{node.content}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5">{t(`status.${fields.status}`, String(fields.status ?? ''))}</td>
                <td className="px-2 py-1.5">
                  {typeof (fields.dueDate ?? fields.date) === 'string' && (fields.dueDate ?? fields.date)
                    ? formatDueDate(String(fields.dueDate ?? fields.date), i18n.language, t)
                    : ''}
                </td>
                <td className="px-2 py-1.5">{t(`status.${fields.priority}`, String(fields.priority ?? ''))}</td>
                <td className="px-2 py-1.5">
                  {node.supertagIds.includes('task') && fields.status !== 'done' && (
                    <button
                      type="button"
                      onClick={() => void completeTask(node.id)}
                      className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--accent)]"
                    >
                      ✓
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DueChip({ iso, dimmed }: { iso: string; dimmed?: boolean }) {
  const { t, i18n } = useTranslation();
  const tone = dueTone(iso, localToday());
  const label = formatDueDate(iso, i18n.language, t);
  const toneClass =
    dimmed || tone === 'future'
      ? 'border border-[var(--border)] text-[var(--muted)]'
      : tone === 'overdue'
        ? 'bg-red-500/15 text-red-400'
        : 'bg-[var(--accent-soft)] text-[var(--accent)]';
  return (
    <span className={`mt-0.5 inline-flex w-fit items-center gap-0.5 rounded px-1 py-px text-[10px] ${toneClass}`}>
      <span aria-hidden>📅</span>
      {tone === 'overdue' && !dimmed ? `${label} · ${t('queries.overdue')}` : label}
    </span>
  );
}

export function FieldPanel() {  const { t } = useTranslation();
  const nodes = useAppStore((s) => s.nodes);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setField = useAppStore((s) => s.setField);
  const attachTag = useAppStore((s) => s.attachTag);
  const detachTag = useAppStore((s) => s.detachTag);
  const selectNode = useAppStore((s) => s.selectNode);
  const getNodeBacklinks = useAppStore((s) => s.getNodeBacklinks);
  const resolveNodeTitle = useAppStore((s) => s.resolveNodeTitle);

  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-[var(--muted)]">
        {t('panel.noSelection')}
      </div>
    );
  }

  const backlinks = getNodeBacklinks(node.id);

  return (
    <div className="flex h-full flex-col overflow-auto p-2.5">
      <h2 className="mb-0.5 line-clamp-2 text-sm font-medium leading-snug">{node.content.trim() || '—'}</h2>
      <p className="mb-2 text-[10px] text-[var(--muted)]">{t('panel.fields')}</p>

      <div className="mb-2 flex flex-wrap gap-1">
        {node.supertagIds.map((tagId) => (
          <SupertagPill key={tagId} tagId={tagId} onRemove={() => void detachTag(node.id, tagId)} />
        ))}
      </div>

      <div className="mb-2">
        <label className="ui-label">{t('panel.addSupertag')}</label>
        <div className="flex flex-wrap gap-1">
          {BUILTIN_SUPERTAGS.filter((tag) => !node.supertagIds.includes(tag.id)).map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => void attachTag(node.id, tag.id)}
              className="rounded px-1.5 py-px text-[10px] font-medium transition hover:opacity-80"
              style={{ background: `${tag.color}22`, color: tag.color }}
            >
              + #{t(`supertags.${tag.id}`, tag.name)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {node.supertagIds.map((tagId) => {
          const tag = SUPERTAG_MAP[tagId];
          if (!tag) return null;
          return (
            <div key={tagId} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2">
              <div className="mb-2 text-[11px] font-medium" style={{ color: tag.color }}>
                #{t(`supertags.${tagId}`, tag.name)}
              </div>
              <div className="space-y-2">
                {tag.fields.map((field) => (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    value={node.fieldValues[tagId]?.[field.key]}
                    onChange={(v) => void setField(node.id, tagId, field.key, v)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <NodeEmbeds node={node} />

      {backlinks.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <h3 className="ui-label">{t('reference.backlinks')}</h3>
          <ul className="space-y-0.5">
            {backlinks.map((bl) => (
              <li key={bl.id}>
                <button
                  type="button"
                  onClick={() => selectNode(bl.id)}
                  className="w-full rounded-md px-1.5 py-1 text-left text-xs hover:bg-[var(--surface-2)]"
                >
                  {resolveNodeTitle(bl.id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
