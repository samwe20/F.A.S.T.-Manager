import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import type { QueryFilter } from '../types';

export function QueryBuilder({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const objectTypes = useAppStore((s) => s.objectTypes);
  const saveNewQuery = useAppStore((s) => s.saveNewQuery);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState(objectTypes.find((type) => type.id === 'task')?.id ?? objectTypes[0]?.id ?? 'task');
  const type = objectTypes.find((item) => item.id === typeId);
  const [field, setField] = useState(type?.fields[0]?.key ?? 'status');
  const [op, setOp] = useState<QueryFilter['op']>('neq');
  const [value, setValue] = useState('done');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        className="w-full max-w-md rounded-2xl bg-[var(--paper)] p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void saveNewQuery({
            name: name || t('queryBuilder.new'),
            expression: {
              supertagId: typeId,
              filters: value ? [{ field, op, value }] : [{ field, op: 'exists' }],
              sortBy: field,
              sortDir: 'asc',
            },
          }).then(onClose);
        }}
      >
        <h2 className="font-[var(--font-title)] text-2xl">{t('queryBuilder.new')}</h2>
        <label className="mt-4 block text-sm">
          {t('queryBuilder.name')}
          <input className="ui-input mt-1" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm">
          {t('queryBuilder.type')}
          <select
            className="ui-input mt-1"
            value={typeId}
            onChange={(event) => {
              setTypeId(event.target.value);
              const next = objectTypes.find((item) => item.id === event.target.value);
              setField(next?.fields[0]?.key ?? 'status');
            }}
          >
            {objectTypes
              .filter((item) => item.id !== 'tag')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {t(`supertags.${item.id}`, item.name)}
                </option>
              ))}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <select className="ui-input" value={field} onChange={(event) => setField(event.target.value)}>
            {(type?.fields ?? []).map((item) => (
              <option key={item.key} value={item.key}>
                {item.label || t(`fields.${item.key}`, item.key)}
              </option>
            ))}
          </select>
          <select className="ui-input" value={op} onChange={(event) => setOp(event.target.value as QueryFilter['op'])}>
            {(['eq', 'neq', 'lt', 'gt', 'contains', 'exists'] as const).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input className="ui-input" value={value} onChange={(event) => setValue(event.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="px-3 py-1.5 text-sm" onClick={onClose}>
            {t('capture.cancel')}
          </button>
          <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--on-accent)]">
            {t('actions.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
