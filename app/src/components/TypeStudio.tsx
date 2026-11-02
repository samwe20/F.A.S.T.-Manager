import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import type { FieldDef, FieldType, ObjectTypeRecord } from '../types';
import { exportSpace, slugifyKey } from '../services/objectModel';
import { emptyBlock } from '../utils/blocks';

const FIELD_TYPES: FieldType[] = ['text', 'number', 'checkbox', 'date', 'datetime', 'select', 'reference', 'content', 'cover'];

export function TypeStudio() {
  const { t } = useTranslation();
  const objectTypes = useAppStore((s) => s.objectTypes);
  const templates = useAppStore((s) => s.templates);
  const nodes = useAppStore((s) => s.nodes);
  const collections = useAppStore((s) => s.collections);
  const saveType = useAppStore((s) => s.saveType);
  const addType = useAppStore((s) => s.addType);
  const saveTypeTemplate = useAppStore((s) => s.saveTypeTemplate);
  const [selectedId, setSelectedId] = useState(objectTypes[0]?.id ?? '');
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const selected = objectTypes.find((type) => type.id === selectedId) ?? objectTypes[0];

  const patch = (next: ObjectTypeRecord) => {
    void saveType(next);
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-8 md:grid-cols-[16rem_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-[var(--font-title)] text-2xl">{t('studio.title')}</h1>
          <button type="button" className="text-sm" onClick={() => void addType(t('studio.newType')).then((type) => type && setSelectedId(type.id))}>
            +
          </button>
        </div>
        <div className="space-y-1">
          {objectTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setSelectedId(type.id)}
              className={`block w-full rounded-md px-2 py-1 text-left text-sm ${selected?.id === type.id ? 'bg-[var(--accent-soft)]' : ''}`}
            >
              <span style={{ color: type.color }}>{t(`supertags.${type.id}`, type.name)}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-6 text-xs text-[var(--muted)] underline"
          onClick={() => {
            const blob = new Blob(
              [exportSpace({ nodes, objectTypes, collections, templates })],
              { type: 'application/json' },
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'fast-space.json';
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t('object.exportJson')}
        </button>
      </div>
      {selected && (
        <div>
          <label className="block text-sm">
            {t('studio.name')}
            <input
              className="ui-input mt-1"
              value={selected.name}
              onChange={(event) => patch({ ...selected, name: event.target.value })}
            />
          </label>
          <label className="mt-3 block text-sm">
            {t('studio.color')}
            <input
              type="color"
              className="mt-1 block h-8 w-16"
              value={selected.color}
              onChange={(event) => patch({ ...selected, color: event.target.value })}
            />
          </label>
          <h2 className="mt-6 text-sm font-medium">{t('studio.properties')}</h2>
          <div className="mt-2 space-y-2">
            {selected.fields.map((field, index) => (
              <div key={field.key} className="grid grid-cols-[1fr_8rem_auto] gap-2">
                <input
                  className="ui-input"
                  value={field.label || field.key}
                  onChange={(event) => {
                    const fields = selected.fields.map((item, i) => (i === index ? { ...item, label: event.target.value } : item));
                    patch({ ...selected, fields });
                  }}
                />
                <select
                  className="ui-input"
                  value={field.type}
                  onChange={(event) => {
                    const fields = selected.fields.map((item, i) =>
                      i === index ? { ...item, type: event.target.value as FieldType } : item,
                    );
                    patch({ ...selected, fields });
                  }}
                >
                  {FIELD_TYPES.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-xs text-[var(--muted)]"
                  onClick={() => patch({ ...selected, fields: selected.fields.filter((_, i) => i !== index) })}
                >
                  ×
                </button>
                {field.type === 'select' && (
                  <input
                    className="ui-input col-span-3"
                    placeholder={t('studio.options')}
                    value={(field.options ?? []).join(', ')}
                    onChange={(event) => {
                      const options = event.target.value.split(',').map((item) => item.trim()).filter(Boolean);
                      const fields = selected.fields.map((item, i) => (i === index ? { ...item, options } : item));
                      patch({ ...selected, fields });
                    }}
                  />
                )}
                {field.type === 'reference' && (
                  <div className="col-span-3 grid grid-cols-2 gap-2">
                    <select
                      className="ui-input"
                      value={field.referenceSupertag ?? ''}
                      onChange={(event) => {
                        const fields = selected.fields.map((item, i) =>
                          i === index ? { ...item, referenceSupertag: event.target.value } : item,
                        );
                        patch({ ...selected, fields });
                      }}
                    >
                      <option value="">{t('queryBuilder.type')}</option>
                      {objectTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={!!field.multiple}
                        onChange={(event) => {
                          const fields = selected.fields.map((item, i) =>
                            i === index ? { ...item, multiple: event.target.checked } : item,
                          );
                          patch({ ...selected, fields });
                        }}
                      />
                      {t('studio.multiple')}
                    </label>
                    <input
                      className="ui-input col-span-2"
                      placeholder={t('studio.reverseKey')}
                      value={field.bidirectionalKey ?? ''}
                      onChange={(event) => {
                        const fields = selected.fields.map((item, i) =>
                          i === index ? { ...item, bidirectionalKey: event.target.value || undefined } : item,
                        );
                        patch({ ...selected, fields });
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 text-sm"
            onClick={() => {
              const label = t('studio.property');
              const field: FieldDef = { key: slugifyKey(label, selected.fields.map((item) => item.key)), type: 'text', label };
              patch({ ...selected, fields: [...selected.fields, field] });
            }}
          >
            + {t('studio.addProperty')}
          </button>
          {!selected.builtin && (
            <button
              type="button"
              className="mt-6 block text-xs text-red-700"
              onClick={() => void saveType({ ...selected, deleted: true })}
            >
              {t('studio.deleteType')}
            </button>
          )}
          <h2 className="mt-8 text-sm font-medium">{t('studio.template')}</h2>
          <input
            className="ui-input mt-2"
            placeholder={t('object.title')}
            value={templateTitle}
            onChange={(event) => setTemplateTitle(event.target.value)}
          />
          <textarea
            className="ui-input mt-2 min-h-24"
            placeholder={t('studio.templateBody')}
            value={templateBody}
            onChange={(event) => setTemplateBody(event.target.value)}
          />
          <button
            type="button"
            className="mt-2 text-sm underline"
            onClick={() =>
              void saveTypeTemplate({
                typeId: selected.id,
                name: selected.name,
                title: templateTitle,
                fieldValues: {},
                blocks: templateBody
                  ? templateBody.split('\n').map((line) => ({ ...emptyBlock(), text: line }))
                  : [emptyBlock()],
              })
            }
          >
            {t('studio.saveTemplate')}
          </button>
          {templates.filter((item) => item.typeId === selected.id).length > 0 && (
            <p className="mt-2 text-xs text-[var(--muted)]">{t('studio.templateReady')}</p>
          )}
        </div>
      )}
    </div>
  );
}
