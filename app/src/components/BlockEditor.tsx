import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Block, BlockType, NodeRecord, ObjectTypeRecord } from '../types';
import { adjustIndent, clampIndent, embedIdFromText, emptyBlock, isEmbedText, moveBlock, slashPick, slashQuery, slashChoices } from '../utils/blocks';
import { getIcon } from '../utils/icons';
import { objectTitle } from '../utils/nodeUtils';
import { isStandaloneUrl } from '../utils/weblink';
import { ObjectCard } from './ObjectCard';

interface BlockEditorProps {
  blocks: Block[];
  nodes: NodeRecord[];
  objectTypes?: ObjectTypeRecord[];
  onChange: (blocks: Block[]) => void;
  onOpen: (id: string) => void;
  onEnsureTag?: (name: string) => Promise<string | undefined>;
  onCreateWeblink?: (url: string) => Promise<string | undefined>;
  onCreateObject?: (typeId: string, title: string) => Promise<string | undefined>;
}

const BLOCK_SLASH: { id: string; type: BlockType; level?: 1 | 2 | 3; labelKey: string }[] = [
  { id: 'paragraph', type: 'paragraph', labelKey: 'blocks.paragraph' },
  { id: 'heading1', type: 'heading', level: 1, labelKey: 'blocks.heading1' },
  { id: 'heading2', type: 'heading', level: 2, labelKey: 'blocks.heading2' },
  { id: 'bullet', type: 'bullet', labelKey: 'blocks.bullet' },
  { id: 'check', type: 'todo', labelKey: 'blocks.check' },
  { id: 'quote', type: 'quote', labelKey: 'blocks.quote' },
];

export function BlockEditor({
  blocks,
  nodes,
  objectTypes = [],
  onChange,
  onOpen,
  onEnsureTag,
  onCreateWeblink,
  onCreateObject,
}: BlockEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(blocks);
  const [slash, setSlash] = useState<number | null>(null);
  const [linkAt, setLinkAt] = useState<{ index: number; query: string } | null>(null);
  const [tagAt, setTagAt] = useState<number | null>(null);
  const [tagQuery, setTagQuery] = useState('');
  const [dropId, setDropId] = useState<string | null>(null);
  const focusId = useRef<string | null>(null);
  const draftRef = useRef(blocks);
  const pendingRef = useRef(false);
  const pendingText = useRef<string | null>(null);
  const Hash = getIcon('hash');
  const Grip = getIcon('grip');
  const Up = getIcon('arrow-up');
  const Down = getIcon('arrow-down');
  const Indent = getIcon('chevron-right');
  const Outdent = getIcon('chevron-left');

  useEffect(() => {
    if (pendingRef.current) {
      if (pendingText.current && blocks.some((block) => block.text.includes(pendingText.current!))) {
        pendingRef.current = false;
        pendingText.current = null;
      } else {
        return;
      }
    }
    draftRef.current = blocks;
    setDraft(blocks);
  }, [blocks]);

  useEffect(() => {
    if (!focusId.current) return;
    document.getElementById(`block-${focusId.current}`)?.focus();
    focusId.current = null;
  }, [draft]);

  useLayoutEffect(() => {
    document.querySelectorAll<HTMLTextAreaElement>('textarea.block-input').forEach((el) => {
      el.style.height = '0px';
      el.style.height = `${el.scrollHeight}px`;
    });
  }, [draft]);

  const tagHits = useMemo(() => {
    if (tagAt === null) return [];
    const q = tagQuery.trim().toLowerCase();
    return nodes
      .filter((node) => node.typeId === 'tag' && !node.deleted)
      .filter((node) => !q || objectTitle(node).toLowerCase().includes(q))
      .slice(0, 8);
  }, [nodes, tagAt, tagQuery]);

  const objectCandidates = useMemo(
    () =>
      objectTypes
        .filter((type) => type.id !== 'tag' && type.id !== 'folder' && type.id !== 'dailyNote')
        .map((type) => ({ id: type.id, names: [type.name, t(`supertags.${type.id}`, type.name)] })),
    [objectTypes, t],
  );

  const blockCandidates = useMemo(
    () => BLOCK_SLASH.map((item) => ({ id: item.id, names: [t(item.labelKey)] })),
    [t],
  );

  const linkHits = useMemo(() => {
    if (!linkAt) return [];
    const q = linkAt.query.toLowerCase();
    return nodes
      .filter((node) => {
        const title = objectTitle(node).toLowerCase();
        const alias = (node.aliases ?? []).some((item) => item.toLowerCase().includes(q));
        return !q || title.includes(q) || alias;
      })
      .slice(0, 8);
  }, [linkAt, nodes]);

  const commit = (next: Block[]) => {
    draftRef.current = next;
    setDraft(next);
    onChange(next);
  };

  const updateText = (index: number, text: string) => {
    const next = draftRef.current.map((block, i) => (i === index ? { ...block, text } : block));
    draftRef.current = next;
    setDraft(next);
    if (text.startsWith('/')) setSlash(index);
    else if (slash === index) setSlash(null);
    const mention = text.match(/(?:@|\[\[)([^\]\n]*)$/);
    if (mention) setLinkAt({ index, query: mention[1] ?? '' });
    else setLinkAt(null);
  };

  const applySlash = (index: number, type: BlockType, level?: 1 | 2 | 3) => {
    const next = draftRef.current.map((block, i) =>
      i === index
        ? { ...block, type, level: type === 'heading' ? level ?? block.level ?? 2 : undefined, checked: type === 'todo' ? false : undefined, text: '' }
        : block,
    );
    setSlash(null);
    commit(next);
  };

  const insertLink = (index: number, node: NodeRecord) => {
    const current = draftRef.current[index];
    if (!current) return;
    const text = current.text.replace(/(?:@|\[\[)([^\]\n]*)$/, `[[${node.id}]] `);
    setLinkAt(null);
    commit(draftRef.current.map((block, i) => (i === index ? { ...block, text } : block)));
  };

  const turnIntoObject = async (index: number, typeId: string, title: string) => {
    if (!onCreateObject) return false;
    pendingRef.current = true;
    setSlash(null);
    const id = await onCreateObject(typeId, title);
    if (!id) {
      pendingRef.current = false;
      return false;
    }
    pendingText.current = `[[${id}]]`;
    commit(draftRef.current.map((block, i) => (i === index ? { ...block, text: `[[${id}]]` } : block)));
    return true;
  };

  const turnIntoWeblink = async (index: number, url: string) => {
    if (!onCreateWeblink) return false;
    pendingRef.current = true;
    const id = await onCreateWeblink(url.trim());
    if (!id) {
      pendingRef.current = false;
      return false;
    }
    pendingText.current = `[[${id}]]`;
    const next = draftRef.current.map((block, i) => (i === index ? { ...block, text: `[[${id}]]` } : block));
    commit(next);
    return true;
  };

  const addBlockTag = async (index: number, name: string) => {
    const trimmed = name.trim().replace(/^#/, '');
    if (!trimmed || !onEnsureTag) return;
    const id = await onEnsureTag(trimmed);
    if (!id) return;
    const current = draftRef.current[index];
    if (!current) return;
    const tagIds = current.tagIds ?? [];
    setTagAt(null);
    setTagQuery('');
    if (tagIds.includes(id)) return;
    commit(draftRef.current.map((block, i) => (i === index ? { ...block, tagIds: [...tagIds, id] } : block)));
  };

  const removeBlockTag = (index: number, tagId: string) => {
    commit(
      draftRef.current.map((block, i) =>
        i === index ? { ...block, tagIds: (block.tagIds ?? []).filter((id) => id !== tagId) } : block,
      ),
    );
  };

  const indentBy = (index: number, delta: number) => {
    commit(draftRef.current.map((block, i) => (i === index ? adjustIndent(block, delta) : block)));
  };

  const nudge = (index: number, delta: number) => {
    const current = draftRef.current;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= current.length) return;
    focusId.current = current[index]?.id ?? null;
    commit(moveBlock(current, index, nextIndex));
  };

  const insertAfter = (index: number, block: Block) => {
    const created = emptyBlock(block.type === 'todo' || block.type === 'bullet' ? block.type : 'paragraph');
    created.indent = clampIndent(block.indent);
    const next = [...draftRef.current];
    next.splice(index + 1, 0, created);
    focusId.current = created.id;
    setSlash(null);
    commit(next);
  };

  const removeAt = (index: number) => {
    const current = draftRef.current;
    if (current.length === 1) {
      focusId.current = current[0]?.id ?? null;
      commit(current.map((block, i) => (i === index ? { ...block, text: '' } : block)));
      return;
    }
    const next = current.filter((_, i) => i !== index);
    focusId.current = next[Math.max(0, index - 1)]?.id ?? null;
    commit(next);
  };

  const onStructuralKey = (event: KeyboardEvent, index: number, block: Block, mode: 'input' | 'card') => {
    if (slash !== null || linkAt !== null) return false;
    if (event.key === 'Tab') {
      event.preventDefault();
      indentBy(index, event.shiftKey ? -1 : 1);
      return true;
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      nudge(index, event.key === 'ArrowUp' ? -1 : 1);
      return true;
    }
    if (mode === 'card' && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      insertAfter(index, block);
      return true;
    }
    if (mode === 'card' && (event.key === 'Backspace' || event.key === 'Delete')) {
      event.preventDefault();
      removeAt(index);
      return true;
    }
    return false;
  };

  const onDrop = (targetId: string, event: DragEvent) => {
    event.preventDefault();
    const fromId = event.dataTransfer.getData('text/plain');
    setDropId(null);
    const current = draftRef.current;
    const from = current.findIndex((block) => block.id === fromId);
    const to = current.findIndex((block) => block.id === targetId);
    if (from < 0 || to < 0) return;
    focusId.current = fromId;
    commit(moveBlock(current, from, to));
  };

  return (
    <div className="mt-6 space-y-1">
      {draft.map((block, index) => {
        const embedTarget = embedIdFromText(block.text);
        const embedded = embedTarget !== null && isEmbedText(block.text);
        return (
          <div
            key={block.id}
            className="group relative"
            data-indent={clampIndent(block.indent)}
            style={{ paddingLeft: `${clampIndent(block.indent) * 1.25}rem` }}
            onDragOver={(event) => {
              event.preventDefault();
              setDropId(block.id);
            }}
            onDragLeave={() => setDropId((current) => (current === block.id ? null : current))}
            onDrop={(event) => onDrop(block.id, event)}
          >
            <div className={`flex items-start gap-1 ${dropId === block.id ? 'bg-[var(--surface-2)]' : ''}`}>
              <div className="mt-1 flex w-4 shrink-0 flex-col">
                <button
                  type="button"
                  draggable
                  className="block-tool cursor-grab"
                  aria-label={t('blocks.reorder')}
                  onMouseDown={(event) => event.preventDefault()}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', block.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <Grip size={12} />
                </button>
                <button type="button" className="block-tool" aria-label={t('blocks.up')} onMouseDown={(event) => event.preventDefault()} onClick={() => nudge(index, -1)}>
                  <Up size={12} />
                </button>
                <button type="button" className="block-tool" aria-label={t('blocks.down')} onMouseDown={(event) => event.preventDefault()} onClick={() => nudge(index, 1)}>
                  <Down size={12} />
                </button>
                <button type="button" className="block-tool" aria-label={t('blocks.indent')} onMouseDown={(event) => event.preventDefault()} onClick={() => indentBy(index, 1)}>
                  <Indent size={12} />
                </button>
                <button type="button" className="block-tool" aria-label={t('blocks.outdent')} onMouseDown={(event) => event.preventDefault()} onClick={() => indentBy(index, -1)}>
                  <Outdent size={12} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={[
                    'flex items-start gap-2',
                    block.type === 'quote' ? 'border-l-2 border-[var(--border)] pl-3' : '',
                    block.type === 'bullet' ? 'pl-1' : '',
                  ].join(' ')}
                >
                  {block.type === 'todo' && (
                    <input
                      type="checkbox"
                      checked={!!block.checked}
                      className="mt-1.5 accent-[var(--accent)]"
                      onChange={(event) => {
                        commit(draftRef.current.map((item, i) => (i === index ? { ...item, checked: event.target.checked } : item)));
                      }}
                    />
                  )}
                  {block.type === 'bullet' && <span className="mt-1.5 text-[var(--muted)]">•</span>}
                  {embedded && embedTarget ? (
                    <div className="min-w-0 flex-1">
                      <ObjectCard
                        blockId={block.id}
                        targetId={embedTarget}
                        node={nodes.find((node) => node.id === embedTarget)}
                        objectTypes={objectTypes}
                        nodes={nodes}
                        linkView={block.linkView}
                        onOpen={onOpen}
                        onLinkView={(linkView) => {
                          commit(draftRef.current.map((item, i) => (i === index ? { ...item, linkView } : item)));
                        }}
                        onKeyDown={(event) => onStructuralKey(event, index, block, 'card')}
                      />
                      <button
                        type="button"
                        className="block-tool mt-1 text-[10px]"
                        aria-label={t('blocks.removeEmbed')}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => removeAt(index)}
                      >
                        {t('blocks.removeEmbed')}
                      </button>
                    </div>
                  ) : (
                    <textarea
                      id={`block-${block.id}`}
                      rows={1}
                      value={block.text}
                      placeholder={index === draft.length - 1 ? t('blocks.placeholder') : ''}
                      onChange={(event) => updateText(index, event.target.value)}
                      onPaste={(event) => {
                        const pasted = event.clipboardData.getData('text');
                        const replacingEmpty = block.text.trim() === '' || isStandaloneUrl(block.text);
                        if (!onCreateWeblink || !isStandaloneUrl(pasted) || !replacingEmpty) return;
                        event.preventDefault();
                        void turnIntoWeblink(index, pasted);
                      }}
                      onBlur={() => {
                        if (pendingRef.current || slash !== null || linkAt !== null) return;
                        onChange(draftRef.current);
                      }}
                      onKeyDown={(event) => {
                        if (onStructuralKey(event, index, block, 'input')) return;
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          const text = draftRef.current[index]?.text ?? block.text;
                          const parsed = slashQuery(text);
                          if (parsed?.command && onCreateObject) {
                            const objectPick = slashPick(parsed.command, objectCandidates);
                            if (objectPick) {
                              void turnIntoObject(index, objectPick.id, parsed.title);
                              return;
                            }
                          }
                          if (parsed?.command && !parsed.title) {
                            const blockPick = slashPick(parsed.command, blockCandidates);
                            const item = BLOCK_SLASH.find((entry) => entry.id === blockPick?.id);
                            if (item) {
                              applySlash(index, item.type, item.level);
                              return;
                            }
                          }
                          if (isStandaloneUrl(text) && onCreateWeblink) {
                            void turnIntoWeblink(index, text);
                            return;
                          }
                          insertAfter(index, block);
                        }
                        if (event.key === 'Backspace' && block.text === '') {
                          if (clampIndent(block.indent) > 0) {
                            event.preventDefault();
                            indentBy(index, -1);
                            return;
                          }
                          if (draftRef.current.length > 1) {
                            event.preventDefault();
                            removeAt(index);
                          }
                        }
                      }}
                      className={`block-input ${block.type === 'heading' ? 'font-[var(--font-title)] text-xl' : ''} ${block.checked ? 'text-[var(--muted)] line-through' : ''}`}
                    />
                  )}
                </div>
                {!embedded && block.text.includes('[[') && (
                  <div className="pb-1 pl-6 text-sm text-[var(--muted)]">{renderLinkedText(block.text, nodes, onOpen)}</div>
                )}
                {((block.tagIds ?? []).length > 0 || onEnsureTag) && (
                  <div className="flex flex-wrap items-center gap-1 pb-1 pl-6">
                    {(block.tagIds ?? []).map((tagId) => {
                      const tag = nodes.find((node) => node.id === tagId);
                      return (
                        <span key={tagId} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs">
                          <button type="button" className="hover:underline" onClick={() => onOpen(tagId)}>
                            #{objectTitle(tag) || t('blocks.tag')}
                          </button>
                          <button type="button" className="text-[var(--muted)]" aria-label={t('actions.delete')} onClick={() => removeBlockTag(index, tagId)}>
                            ×
                          </button>
                        </span>
                      );
                    })}
                    {onEnsureTag && tagAt !== index && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                        onClick={() => {
                          setTagAt(index);
                          setTagQuery('');
                        }}
                      >
                        <Hash size={12} />
                        {t('blocks.tag')}
                      </button>
                    )}
                    {onEnsureTag && tagAt === index && (
                      <form
                        className="relative"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void addBlockTag(index, tagQuery);
                        }}
                      >
                        <input
                          autoFocus
                          value={tagQuery}
                          onChange={(event) => setTagQuery(event.target.value)}
                          onBlur={() => {
                            if (!tagQuery.trim()) setTagAt(null);
                          }}
                          placeholder={t('blocks.tag')}
                          className="w-28 bg-transparent text-xs outline-none"
                        />
                        {(tagHits.length > 0 || tagQuery.trim()) && (
                          <div className="absolute z-20 mt-1 w-48 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--paper)] shadow-lg">
                            {tagHits.map((node) => (
                              <button
                                key={node.id}
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-2)]"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  void addBlockTag(index, objectTitle(node));
                                }}
                              >
                                #{objectTitle(node)}
                              </button>
                            ))}
                          </div>
                        )}
                      </form>
                    )}
                  </div>
                )}
                {slash === index && (() => {
                  const parsed = slashQuery(block.text);
                  const command = parsed?.command ?? '';
                  const objectHits = slashChoices(command, objectCandidates);
                  const blockHits = slashChoices(command, blockCandidates);
                  if (objectHits.length === 0 && blockHits.length === 0) return null;
                  return (
                    <div className="absolute z-20 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--paper)] shadow-lg">
                      {objectHits.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-2)]"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            void turnIntoObject(index, item.id, parsed?.title ?? '');
                          }}
                        >
                          {t(`supertags.${item.id}`, item.names[0])}
                        </button>
                      ))}
                      {blockHits.map((item) => {
                        const entry = BLOCK_SLASH.find((candidate) => candidate.id === item.id);
                        if (!entry) return null;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-sm text-[var(--muted)] hover:bg-[var(--surface-2)]"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              applySlash(index, entry.type, entry.level);
                            }}
                          >
                            {t(entry.labelKey)}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                {linkAt?.index === index && linkHits.length > 0 && (
                  <div className="absolute z-20 mt-1 w-64 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--paper)] shadow-lg">
                    {linkHits.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-2)]"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          insertLink(index, node);
                        }}
                      >
                        {objectTitle(node) || node.id.slice(0, 8)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function renderLinkedText(text: string, nodes: NodeRecord[], onOpen: (id: string) => void) {
  const parts = text.split(/(\[\[[0-9a-fA-F-]{8,}\]\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[\[([0-9a-fA-F-]{8,})\]\]$/);
    if (!match) return <span key={index}>{part}</span>;
    const node = nodes.find((item) => item.id === match[1]);
    const label = objectTitle(node) || match[1].slice(0, 8);
    return (
      <button
        key={index}
        type="button"
        className="mx-0.5 text-[var(--accent)] underline decoration-[var(--border)] underline-offset-2"
        onClick={() => onOpen(match[1])}
      >
        {label}
      </button>
    );
  });
}
