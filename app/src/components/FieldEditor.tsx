import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { useMediaSrc } from '../hooks/useMediaSrc';
import { parseContentField, serializeContentField, joinIds, splitIds } from '../utils/blocks';
import { getReferenceCandidates, objectTitle } from '../utils/nodeUtils';
import type { FieldDef, NodeRecord, ObjectTypeRecord } from '../types';
import { BlockEditor } from './BlockEditor';

interface FieldEditorProps {
  field: FieldDef;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  hideLabel?: boolean;
  nodes?: NodeRecord[];
  objectTypes?: ObjectTypeRecord[];
  onOpen?: (id: string) => void;
  onUpload?: (file: File) => void;
}

export function FieldEditor({ field, value, onChange, hideLabel = false, nodes: linkNodes, objectTypes, onOpen, onUpload }: FieldEditorProps) {
  const { t } = useTranslation();
  const nodes = useAppStore((s) => s.nodes);
  const resolveNodeTitle = useAppStore((s) => s.resolveNodeTitle);
  const [pickerOpen, setPickerOpen] = useState(false);
  const label = field.label || t(`fields.${field.key}`, field.key);

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        {hideLabel ? null : label}
      </label>
    );
  }

  if (field.type === 'reference') {
    const candidates = getReferenceCandidates(nodes, field.referenceSupertag);
    const selectedId = String(value ?? '');

    return (
      <div className="relative">
        {hideLabel ? null : <label className="ui-label">{label}</label>}
        <button
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          className="ui-input flex items-center justify-between text-left"
        >
          <span className={selectedId ? '' : 'text-[var(--muted)]'}>
            {selectedId ? resolveNodeTitle(selectedId) : t('reference.pick')}
          </span>
          <span className="text-[var(--muted)]">▾</span>
        </button>
        {pickerOpen && (
          <div className="absolute z-20 mt-0.5 max-h-40 w-full overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg">
            <button
              type="button"
              className="block w-full px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]"
              onClick={() => {
                onChange('');
                setPickerOpen(false);
              }}
            >
              —
            </button>
            {candidates.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`block w-full px-2 py-1.5 text-left text-xs hover:bg-[var(--surface-2)] ${selectedId === node.id ? 'bg-[var(--accent-soft)]' : ''}`}
                onClick={() => {
                  onChange(node.id);
                  setPickerOpen(false);
                }}
              >
                {objectTitle(node) || node.id.slice(0, 8)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (field.type === 'select' && field.multiple) {
    const selected = splitIds(value);
    return (
      <div className="flex flex-wrap gap-1">
        {(field.options ?? []).map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(joinIds(on ? selected.filter((item) => item !== option) : [...selected, option]))}
              className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface-2)]'}`}
            >
              {t(`status.${option}`, option)}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        {hideLabel ? null : <label className="ui-label">{label}</label>}
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="ui-input">
          <option value="">—</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {t(`status.${opt}`, opt)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'content' && linkNodes && onOpen) {
    return (
      <BlockEditor
        blocks={parseContentField(value)}
        nodes={linkNodes}
        objectTypes={objectTypes}
        onOpen={onOpen}
        onChange={(blocks) => onChange(serializeContentField(blocks))}
      />
    );
  }

  if (field.type === 'cover') {
    return <CoverField value={value} onUpload={onUpload} />;
  }

  if (field.type === 'datetime') {
    return (
      <div>
        {hideLabel ? null : <label className="ui-label">{label}</label>}
        <input
          type="datetime-local"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="ui-input"
        />
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div>
        {hideLabel ? null : <label className="ui-label">{label}</label>}
        <input type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="ui-input" />
      </div>
    );
  }

  return (
    <div>
      {hideLabel ? null : <label className="ui-label">{label}</label>}
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={String(value ?? '')}
        onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="ui-input"
      />
    </div>
  );
}

function CoverField({
  value,
  onUpload,
}: {
  value: string | number | boolean | undefined;
  onUpload?: (file: File) => void;
}) {
  const src = useMediaSrc(typeof value === 'string' ? value : undefined);
  return (
    <div>
      {src && <img src={src} alt="" className="mb-2 max-h-40 w-full object-cover" />}
      <input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload?.(file);
        }}
      />
    </div>
  );
}
