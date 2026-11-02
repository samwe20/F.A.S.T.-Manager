import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { NodeRecord, ObjectTypeRecord } from '../types';
import { useInkPaper } from '../hooks/useInkPaper';
import { useMediaSrc } from '../hooks/useMediaSrc';
import { labelInk } from '../utils/color';
import { dayPreviewNodes, displayTitle, previewSnippet } from '../utils/nodeUtils';

export function DayPreviews({
  nodes,
  objectTypes,
  dayKey,
  excludeIds,
  onOpen,
}: {
  nodes: NodeRecord[];
  objectTypes: ObjectTypeRecord[];
  dayKey: string;
  excludeIds: string[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const previews = useMemo(
    () => dayPreviewNodes(nodes, dayKey, excludeIds),
    [nodes, dayKey, excludeIds],
  );
  if (!dayKey || previews.length === 0) return null;
  return (
    <section className="day-previews" aria-label={t('daily.previews')}>
      <h2>{t('daily.previews')}</h2>
      <div>
        {previews.map((item) => (
          <DayPreview key={item.id} node={item} nodes={nodes} objectTypes={objectTypes} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export function DayPreview({
  node,
  nodes,
  objectTypes,
  onOpen,
}: {
  node: NodeRecord;
  nodes: NodeRecord[];
  objectTypes: ObjectTypeRecord[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const paper = useInkPaper();
  const type = objectTypes.find((item) => item.id === node.typeId);
  const fields = node.typeId ? node.fieldValues[node.typeId] ?? {} : {};
  const src = node.typeId === 'image' && typeof fields.src === 'string' ? fields.src : undefined;
  const mediaSrc = useMediaSrc(src);
  const title = displayTitle(nodes, node) || t('object.untitled');
  const snippet = previewSnippet(node, nodes, title);
  const url = node.typeId === 'weblink' && typeof fields.url === 'string' ? fields.url : '';

  return (
    <button type="button" className={`preview-card${src ? ' is-media' : ''}`} onClick={() => onOpen(node.id)}>
      <small style={type ? { color: labelInk(type.color, paper) } : undefined}>{type ? t(`supertags.${type.id}`, type.name) : ''}</small>
      <strong>{title}</strong>
      {snippet && <p>{snippet}</p>}
      {url && <em>{url}</em>}
      {mediaSrc && <img src={mediaSrc} alt="" />}
    </button>
  );
}
