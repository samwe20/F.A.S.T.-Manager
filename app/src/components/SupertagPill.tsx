import { useTranslation } from 'react-i18next';
import { SUPERTAG_MAP } from '../data/supertags';
import type { SupertagDef } from '../types';

interface SupertagPillProps {
  tagId: string;
  onRemove?: () => void;
  onClick?: () => void;
}

export function SupertagPill({ tagId, onRemove, onClick }: SupertagPillProps) {
  const { t } = useTranslation();
  const tag = SUPERTAG_MAP[tagId];
  if (!tag) return null;

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[10px] font-medium transition hover:opacity-90"
      style={{ background: `${tag.color}22`, color: tag.color }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      #{t(`supertags.${tagId}`, tag.name)}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 opacity-70 hover:opacity-100"
          aria-label={t('panel.removeSupertag')}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function getSupertagDef(tagId: string): SupertagDef | undefined {
  return SUPERTAG_MAP[tagId];
}
