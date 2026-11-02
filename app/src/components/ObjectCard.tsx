import { useTranslation } from 'react-i18next';
import type { KeyboardEvent } from 'react';
import type { LinkView, NodeRecord, ObjectTypeRecord } from '../types';
import { useInkPaper } from '../hooks/useInkPaper';
import { useMediaSrc } from '../hooks/useMediaSrc';
import { labelInk } from '../utils/color';
import { getIcon } from '../utils/icons';
import { displayTitle, previewSnippet } from '../utils/nodeUtils';

const LINK_VIEWS: LinkView[] = ['glyph', 'card', 'wide'];

interface ObjectCardProps {
  blockId: string;
  node: NodeRecord | undefined;
  targetId: string;
  objectTypes: ObjectTypeRecord[];
  nodes: NodeRecord[];
  linkView?: LinkView;
  onOpen: (id: string) => void;
  onLinkView?: (view: LinkView) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function ObjectCard({
  blockId,
  node,
  targetId,
  objectTypes,
  nodes,
  linkView = 'card',
  onOpen,
  onLinkView,
  onKeyDown,
}: ObjectCardProps) {
  const { t } = useTranslation();
  const paper = useInkPaper();
  const type = objectTypes.find((item) => item.id === node?.typeId);
  const fields = node?.typeId ? node.fieldValues[node.typeId] ?? {} : {};
  const src = typeof fields.src === 'string' ? fields.src : undefined;
  const mediaSrc = useMediaSrc(node && (node.typeId === 'image' || node.typeId === 'file') ? src : undefined);
  const Icon = getIcon(type?.icon ?? 'file-text');
  const ink = type ? labelInk(type.color, paper) : undefined;
  const title = node ? displayTitle(nodes, node) || t('object.untitled') : t('blocks.unknown');
  const url = node?.typeId === 'weblink' && typeof fields.url === 'string' ? fields.url : '';
  const fileName = typeof fields.fileName === 'string' && fields.fileName ? fields.fileName : title;
  const snippet = node ? previewSnippet(node, nodes, title) : '';
  const typeLabel = node ? t(`supertags.${node.typeId}`, type?.name ?? node.typeId ?? '') : t('blocks.unknown');

  const open = () => {
    if (node && !node.deleted) onOpen(node.id);
  };

  return (
    <div
      id={`block-${blockId}`}
      className={`embed-card is-${linkView}`}
      tabIndex={0}
      data-embed={targetId}
      onKeyDown={onKeyDown}
    >
      {onLinkView && (
        <div className="embed-view-switch">
          {LINK_VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              title={t(`views.${view}`)}
              className={view === linkView ? 'is-on' : ''}
              onClick={(event) => {
                event.stopPropagation();
                onLinkView(view);
              }}
            >
              {t(`views.${view}`)}
            </button>
          ))}
        </div>
      )}
      <button type="button" className={`embed-body is-${linkView}`} onClick={open}>
        <span className="embed-kind" style={ink ? { color: ink } : undefined}>
          <Icon size={13} strokeWidth={1.5} color={ink} />
          {linkView !== 'glyph' && typeLabel}
        </span>
        <span className="embed-title">{node ? title : targetId.slice(0, 8)}</span>
        {linkView === 'wide' && snippet && <span className="embed-snippet">{snippet}</span>}
        {node?.typeId === 'image' && mediaSrc && <img src={mediaSrc} alt={title} />}
        {node?.typeId === 'image' && !mediaSrc && <span className="embed-image-empty" />}
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate text-xs text-[var(--muted)] underline decoration-[var(--border)]"
          onClick={(event) => event.stopPropagation()}
        >
          {url}
        </a>
      )}
      {node?.typeId === 'file' && (
        <span className="mt-1 block text-xs text-[var(--muted)]">
          {mediaSrc ? (
            <a href={mediaSrc} download={fileName} onClick={(event) => event.stopPropagation()}>
              {fileName}
            </a>
          ) : (
            fileName
          )}
        </span>
      )}
    </div>
  );
}
