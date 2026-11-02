import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { useInkPaper } from '../hooks/useInkPaper';
import { useMediaSrc } from '../hooks/useMediaSrc';
import { objectToMarkdown } from '../services/objectModel';
import type { FieldDef } from '../types';
import { splitIds, joinIds } from '../utils/blocks';
import { labelInk } from '../utils/color';
import { getIcon } from '../utils/icons';
import { blocksWithTag, dayTodoBlocks, displayTitle, getReferenceCandidates, getUnlinkedMentions, objectTitle, resolveLinks } from '../utils/nodeUtils';
import { BlockEditor } from './BlockEditor';
import { DayPreviews } from './DayPreview';
import { FieldEditor } from './FieldEditor';

function sentence(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDay(isoDate: string, language: string): { year: string; label: string } {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { year: '', label: isoDate };
  return {
    year: String(date.getFullYear()),
    label: sentence(new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)),
  };
}

export function ObjectPage() {
  const { t, i18n } = useTranslation();
  const nodeId = useAppStore((s) => s.selectedNodeId);
  const nodes = useAppStore((s) => s.nodes);
  const objectTypes = useAppStore((s) => s.objectTypes);
  const collections = useAppStore((s) => s.collections);
  const back = useAppStore((s) => s.backToIndex);
  const openObject = useAppStore((s) => s.openObject);
  const saveObjectBody = useAppStore((s) => s.saveObjectBody);
  const changeObjectType = useAppStore((s) => s.changeObjectType);
  const setObjectField = useAppStore((s) => s.setObjectField);
  const addTagToObject = useAppStore((s) => s.addTagToObject);
  const removeTagFromObject = useAppStore((s) => s.removeTagFromObject);
  const createAndAddTag = useAppStore((s) => s.createAndAddTag);
  const setAliases = useAppStore((s) => s.setAliases);
  const setReviewed = useAppStore((s) => s.setReviewed);
  const toggleInCollection = useAppStore((s) => s.toggleInCollection);
  const removeNode = useAppStore((s) => s.removeNode);
  const getNodeBacklinks = useAppStore((s) => s.getNodeBacklinks);
  const ensureTag = useAppStore((s) => s.ensureTag);
  const createWeblink = useAppStore((s) => s.createWeblink);
  const createObjectFromLine = useAppStore((s) => s.createObjectFromLine);
  const attachMedia = useAppStore((s) => s.attachMedia);
  const setMediaProperty = useAppStore((s) => s.setMediaProperty);
  const paper = useInkPaper();

  const node = nodes.find((item) => item.id === nodeId);
  const [typeOpen, setTypeOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [aliasDraft, setAliasDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  const type = objectTypes.find((item) => item.id === node?.typeId);
  const fields = node?.typeId ? node.fieldValues[node.typeId] ?? {} : {};
  const mediaSrc = useMediaSrc(typeof fields.src === 'string' ? fields.src : undefined);
  const tags = useMemo(
    () => nodes.filter((item) => item.typeId === 'tag'),
    [nodes],
  );

  if (!node) {
    return <div className="object-page text-[var(--muted)]">{t('panel.noSelection')}</div>;
  }

  const title = node.title ?? objectTitle(node);
  const dayKey = node.typeId === 'dailyNote' ? String(node.fieldValues.dailyNote?.date ?? '') : '';
  const dayTasks =
    node.typeId === 'dailyNote'
      ? nodes.filter(
          (item) =>
            item.typeId === 'task' &&
            !item.deleted &&
            String(item.fieldValues.task?.dueDate ?? '') === dayKey &&
            item.fieldValues.task?.status !== 'done',
        )
      : [];
  const dayChecks = node.typeId === 'dailyNote' && dayKey ? dayTodoBlocks(nodes, dayKey, [node.id]) : [];
  const backlinks = getNodeBacklinks(node.id);
  const taggedBlocks = node.typeId === 'tag' ? blocksWithTag(nodes, node.id) : [];
  const mentions = getUnlinkedMentions(nodes, node);
  const Back = getIcon('arrow-left');

  const download = (filename: string, contents: string, mime: string) => {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onFile = (file: File | undefined) => {
    if (!file || !node.typeId) return;
    void attachMedia(node.id, node.typeId, file);
  };

  return (
    <article className="object-page">
      <button type="button" onClick={back} className="mb-8 flex items-center gap-1 text-[13px] text-[var(--muted)] hover:text-[var(--text)]">
        <Back size={13} strokeWidth={1.5} />
        {t('object.back')}
      </button>

      {node.typeId === 'dailyNote' && dayKey && (
        <div className="day-year" style={type ? { color: labelInk(type.color, paper) } : undefined}>{formatDay(dayKey, i18n.language).year}</div>
      )}

      {type && node.typeId !== 'dailyNote' && (
        <div className="type-chip" style={{ color: labelInk(type.color, paper) }}>
          {t(`supertags.${type.id}`, type.name)}
        </div>
      )}

      {node.typeId === 'dailyNote' && title === dayKey ? (
        <h1 className="day-title">{formatDay(dayKey, i18n.language).label}</h1>
      ) : (
      <input
        className="object-title"
        value={titleDraft ?? title}
        placeholder={t('object.untitled')}
        aria-label={t('object.title')}
        onChange={(event) => setTitleDraft(event.target.value)}
        onBlur={() => {
          if (titleDraft !== null && titleDraft !== title) {
            void saveObjectBody(node.id, titleDraft, node.blocks ?? []);
          }
          setTitleDraft(null);
        }}
      />
      )}

      <div className="meta-line">
        <div className="relative">
        <button
          type="button"
          className="font-[var(--font-title)] text-[1.05rem] italic"
          style={type ? { color: labelInk(type.color, paper) } : undefined}
          onClick={() => setTypeOpen((open) => !open)}
        >
          {type ? t(`supertags.${type.id}`, type.name) : t('object.type')}
        </button>
        {typeOpen && (
          <div className="absolute z-20 mt-1 max-h-64 w-56 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--paper)] shadow-lg">
            {objectTypes
              .filter((item) => item.id !== 'tag')
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-2)]"
                  style={{ color: labelInk(item.color, paper) }}
                  onClick={() => {
                    setTypeOpen(false);
                    void changeObjectType(node.id, item.id);
                  }}
                >
                  {t(`supertags.${item.id}`, item.name)}
                </button>
              ))}
          </div>
        )}
        </div>
        {node.typeId === 'dailyNote' && (
          <button type="button" className={node.reviewed ? 'text-[var(--text)]' : ''} onClick={() => void setReviewed(node.id, !node.reviewed)}>
            {t('object.reviewed')}
          </button>
        )}
      </div>

      {node.typeId === 'dailyNote' && (dayTasks.length > 0 || dayChecks.length > 0) && (
        <ul className="day-tasks">
          {dayTasks.map((task) => (
            <li key={task.id}>
              <button type="button" className="day-task" onClick={() => openObject(task.id)}>
                <i style={{ background: objectTypes.find((item) => item.id === task.typeId)?.color }} />
                {displayTitle(nodes, task) || t('object.untitled')}
              </button>
            </li>
          ))}
          {dayChecks.map((hit) => (
            <li key={hit.blockId}>
              <button type="button" className="day-task" onClick={() => openObject(hit.nodeId)}>
                <i style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--border)' }} />
                {resolveLinks(hit.text, nodes)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {node.typeId === 'dailyNote' && (
        <DayPreviews
          nodes={nodes}
          objectTypes={objectTypes}
          dayKey={dayKey}
          excludeIds={[node.id, ...dayTasks.map((task) => task.id)]}
          onOpen={openObject}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {(node.tagIds ?? []).map((tagId) => {
          const tag = nodes.find((item) => item.id === tagId);
          return (
            <button
              key={tagId}
              type="button"
              className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text)]"
              onClick={() => openObject(tagId)}
              onContextMenu={(event) => {
                event.preventDefault();
                void removeTagFromObject(node.id, tagId);
              }}
            >
              #{objectTitle(tag) || t('object.tag')}
            </button>
          );
        })}
        <form
          className="inline"
          onSubmit={(event) => {
            event.preventDefault();
            const name = tagDraft.trim();
            if (!name) return;
            const existing = tags.find((tag) => objectTitle(tag).toLowerCase() === name.toLowerCase());
            if (existing) void addTagToObject(node.id, existing.id);
            else void createAndAddTag(node.id, name);
            setTagDraft('');
          }}
        >
          <input
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            placeholder={t('object.addTag')}
            className="w-28 bg-transparent text-xs text-[var(--muted)] outline-none placeholder:text-[var(--muted)]"
          />
        </form>
      </div>

      {node.typeId === 'weblink' && typeof fields.url === 'string' && fields.url && (
        <a
          href={fields.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block text-sm text-[var(--accent)] underline"
        >
          {fields.url}
        </a>
      )}

      {(node.typeId === 'image' || node.typeId === 'file') && (
        <div className="mt-4">
          {node.typeId === 'image' && mediaSrc && (
            <img src={mediaSrc} alt={title} className="mb-3 max-h-80 rounded-lg" />
          )}
          <input
            type="file"
            accept={node.typeId === 'image' ? 'image/*' : undefined}
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          {node.typeId === 'file' && mediaSrc && (
            <a className="mt-2 block text-sm underline" href={mediaSrc} download={String(fields.fileName || 'file')}>
              {String(fields.fileName || t('object.download'))}
            </a>
          )}
        </div>
      )}

      {type && type.fields.filter((field) => field.key !== 'src' && !(node.typeId === 'dailyNote' && field.key === 'date')).length > 0 && (
        <div className="mt-8">
          {type.fields
            .filter((field) => field.key !== 'src' && !(node.typeId === 'dailyNote' && field.key === 'date'))
            .map((field) => (
              <div key={field.key} className="prop-row">
                <div className="pt-1 text-sm text-[var(--muted)]">{field.label || t(`fields.${field.key}`, field.key)}</div>
                <div>
                  {field.type === 'reference' && field.multiple ? (
                    <MultiReference
                      field={field}
                      value={fields[field.key]}
                      onChange={(value) => void setObjectField(node.id, node.typeId!, field.key, value)}
                    />
                  ) : (
                    <FieldEditor
                      field={field}
                      hideLabel
                      value={fields[field.key]}
                      nodes={nodes}
                      objectTypes={objectTypes}
                      onOpen={openObject}
                      onUpload={(file) => void setMediaProperty(node.id, node.typeId!, field.key, file)}
                      onChange={(value) => void setObjectField(node.id, node.typeId!, field.key, value)}
                    />
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      <BlockEditor
        blocks={node.blocks?.length ? node.blocks : [{ id: `${node.id}-empty`, type: 'paragraph', text: '' }]}
        nodes={nodes}
        onOpen={openObject}
        objectTypes={objectTypes}
        onEnsureTag={ensureTag}
        onCreateWeblink={createWeblink}
        onCreateObject={(typeId, lineTitle) => createObjectFromLine(typeId, lineTitle, dayKey || undefined)}
        onChange={(blocks) => void saveObjectBody(node.id, title, blocks)}
      />

      {taggedBlocks.length > 0 && (
        <section className="mt-8">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{t('blocks.taggedIn')}</div>
          <div className="mt-2 space-y-1">
            {taggedBlocks.map((hit) => {
              const parent = nodes.find((item) => item.id === hit.nodeId);
              const parentLabel = displayTitle(nodes, parent) || t('object.untitled');
              const preview = resolveLinks(hit.text, nodes);
              return (
                <button
                  key={`${hit.nodeId}-${hit.blockId}`}
                  type="button"
                  className="block text-left text-sm hover:underline"
                  onClick={() => openObject(hit.nodeId)}
                >
                  {preview && preview !== parentLabel ? `${parentLabel} — ${preview}` : parentLabel}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <details className="quiet-fold">
        <summary>{t('object.more')}</summary>
      <section className="mt-6">
        <div className="quiet-label">{t('object.aliases')}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(node.aliases ?? []).map((alias) => (
            <button
              key={alias}
              type="button"
              className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs"
              onClick={() => void setAliases(node.id, (node.aliases ?? []).filter((item) => item !== alias))}
            >
              {alias} ×
            </button>
          ))}
        </div>
        <form
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            const alias = aliasDraft.trim();
            if (!alias) return;
            void setAliases(node.id, [...(node.aliases ?? []), alias]);
            setAliasDraft('');
          }}
        >
          <input
            value={aliasDraft}
            onChange={(event) => setAliasDraft(event.target.value)}
            placeholder={t('object.aliasesHint')}
            className="ui-input max-w-xs"
          />
        </form>
      </section>

      {collections.filter((collection) => collection.typeId === node.typeId).length > 0 && (
        <section className="mt-8">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{t('nav.collections')}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {collections
              .filter((collection) => collection.typeId === node.typeId)
              .map((collection) => {
                const on = collection.objectIds.includes(node.id);
                return (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => void toggleInCollection(collection.id, node.id)}
                    className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface-2)]'}`}
                  >
                    {collection.name}
                  </button>
                );
              })}
          </div>
        </section>
      )}

      <LinkSection title={t('object.backlinks')} rows={backlinks} onOpen={openObject} />
      <LinkSection title={t('object.mentions')} rows={mentions} onOpen={openObject} />

      <div className="mt-6 flex gap-4">
        <button
          type="button"
          className="text-xs text-[var(--muted)] underline"
          onClick={() =>
            download(
              `${objectTitle(node) || 'object'}.md`,
              objectToMarkdown(
                node,
                type?.name ?? node.typeId ?? 'object',
                (node.tagIds ?? []).map((id) => objectTitle(nodes.find((item) => item.id === id)) || id),
              ),
              'text/markdown',
            )
          }
        >
          {t('object.exportMd')}
        </button>
        <button type="button" className="text-xs text-[var(--muted)]" onClick={() => void removeNode(node.id).then(back)}>
          {t('actions.delete')}
        </button>
      </div>
      </details>
    </article>
  );
}

function LinkSection({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: { id: string }[];
  onOpen: (id: string) => void;
}) {
  const nodes = useAppStore((s) => s.nodes);
  if (!rows.length) return null;
  return (
    <section className="mt-8">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{title}</div>
      <div className="mt-2 space-y-1">
        {rows.map((row) => {
          const node = nodes.find((item) => item.id === row.id);
          return (
            <button key={row.id} type="button" className="block text-sm hover:underline" onClick={() => onOpen(row.id)}>
              {displayTitle(nodes, node) || row.id.slice(0, 8)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MultiReference({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | number | boolean | undefined;
  onChange: (value: string) => void;
}) {
  const nodes = useAppStore((s) => s.nodes);
  const selected = splitIds(value);
  const candidates = getReferenceCandidates(nodes, field.referenceSupertag);
  return (
    <div className="flex flex-wrap gap-1">
      {candidates.map((node) => {
        const on = selected.includes(node.id);
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onChange(joinIds(on ? selected.filter((id) => id !== node.id) : [...selected, node.id]))}
            className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface-2)]'}`}
          >
            {objectTitle(node)}
          </button>
        );
      })}
    </div>
  );
}
