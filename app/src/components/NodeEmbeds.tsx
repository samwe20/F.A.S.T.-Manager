import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILTIN_SUPERTAGS, SUPERTAG_MAP } from '../data/supertags';
import { useAppStore } from '../store/appStore';
import type { NodeEmbed, NodeRecord, QueryExpression } from '../types';
import { SupertagPill } from './SupertagPill';

interface NodeEmbedsProps {
  node: NodeRecord;
  compact?: boolean;
}

export function NodeEmbeds({ node, compact = false }: NodeEmbedsProps) {
  const { t } = useTranslation();
  const addEmbed = useAppStore((s) => s.addEmbed);
  const removeEmbed = useAppStore((s) => s.removeEmbed);
  const getEmbedResults = useAppStore((s) => s.getEmbedResults);
  const selectNode = useAppStore((s) => s.selectNode);
  const [adding, setAdding] = useState(false);
  const [tagId, setTagId] = useState('task');
  const [statusFilter, setStatusFilter] = useState('');

  const embeds = node.embeds ?? [];

  const submitEmbed = () => {
    if (!tagId) return;
    const expression: QueryExpression = {
      supertagId: tagId,
      filters: [],
    };
    const tag = SUPERTAG_MAP[tagId];
    const statusField = tag?.fields.find((f) => f.key === 'status');
    if (statusFilter && statusField) {
      expression.filters.push({ field: 'status', op: 'eq', value: statusFilter });
    }
    const title = `#${t(`supertags.${tagId}`, tag?.name ?? tagId)}`;
    void addEmbed(node.id, expression, title);
    setAdding(false);
    setStatusFilter('');
  };

  return (
    <div className={compact ? 'mt-1 space-y-1' : 'mt-3 space-y-2 border-t border-[var(--border)] pt-2'}>
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <span className="ui-label mb-0">{t('embeds.title')}</span>
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            + {t('embeds.add')}
          </button>
        </div>
      )}

      {adding && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2 space-y-2">
          <div>
            <label className="ui-label">{t('embeds.filterByTag')}</label>
            <select value={tagId} onChange={(e) => { setTagId(e.target.value); setStatusFilter(''); }} className="ui-input">
              {BUILTIN_SUPERTAGS.filter((tg) => tg.id !== 'folder').map((tg) => (
                <option key={tg.id} value={tg.id}>
                  #{t(`supertags.${tg.id}`, tg.name)}
                </option>
              ))}
            </select>
          </div>
          {SUPERTAG_MAP[tagId]?.fields.some((f) => f.key === 'status') && (
            <div>
              <label className="ui-label">{t('fields.status')}</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ui-input">
                <option value="">{t('embeds.anyStatus')}</option>
                {(SUPERTAG_MAP[tagId]?.fields.find((f) => f.key === 'status')?.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`status.${opt}`, opt)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-1">
            <button type="button" onClick={() => setAdding(false)} className="rounded-md px-2 py-1 text-[10px] text-[var(--muted)]">
              {t('capture.cancel')}
            </button>
            <button type="button" onClick={submitEmbed} className="rounded-md bg-[var(--accent)] px-2 py-1 text-[10px] text-[var(--on-accent)]">
              {t('embeds.insert')}
            </button>
          </div>
        </div>
      )}

      {embeds.map((embed) => (
        <EmbedBlock
          key={embed.id}
          embed={embed}
          results={getEmbedResults(embed)}
          onSelect={selectNode}
          onRemove={() => void removeEmbed(node.id, embed.id)}
          compact={compact}
        />
      ))}

      {embeds.length === 0 && !adding && !compact && (
        <p className="text-[11px] text-[var(--muted)]">{t('embeds.empty')}</p>
      )}
    </div>
  );
}

function EmbedBlock({
  embed,
  results,
  onSelect,
  onRemove,
  compact,
}: {
  embed: NodeEmbed;
  results: NodeRecord[];
  onSelect: (id: string) => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const tagId = embed.expression.supertagId;

  return (
    <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] ${compact ? 'p-1.5' : 'p-2'}`}>
      <div className="mb-1 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          {tagId && <SupertagPill tagId={tagId} />}
          <span className="truncate text-[10px] text-[var(--muted)]">
            {embed.title || t('embeds.untitled')} · {results.length}
          </span>
        </div>
        {!compact && (
          <button type="button" onClick={onRemove} className="shrink-0 text-[10px] text-[var(--muted)] hover:text-red-400">
            ×
          </button>
        )}
      </div>
      {results.length === 0 ? (
        <p className="text-[10px] text-[var(--muted)]">{t('queries.noResults')}</p>
      ) : (
        <ul className="space-y-0.5">
          {results.slice(0, compact ? 5 : 20).map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                className="w-full truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-[var(--surface-2)]"
              >
                {n.content.trim() || '—'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
