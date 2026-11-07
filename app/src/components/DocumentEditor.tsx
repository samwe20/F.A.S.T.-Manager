import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Block, NodeRecord, ObjectTypeRecord } from '../types';
import { readMedia, mediaObjectUrl } from '../services/mediaStore';
import { emptyBlock, newBlockId } from '../utils/blocks';
import { CAPTURE_SHORTCUTS, captureChoices, lineCaptures, openShortcut, type LinePiece } from '../utils/capture';
import { isDataUrl, parseBlobRef } from '../utils/media';
import { canonicalName, displayTitle, nameSuggestions, objectTitle } from '../utils/nodeUtils';
import { isStandaloneUrl, urlsInText } from '../utils/weblink';

interface DocumentEditorProps {
  blocks: Block[];
  nodes: NodeRecord[];
  objectTypes: ObjectTypeRecord[];
  onChange: (blocks: Block[]) => void;
  onOpen: (id: string) => void;
  onCreateObject?: (typeId: string, title: string) => Promise<string | undefined>;
  onCreateWeblink?: (url: string) => Promise<string | undefined>;
  onCreateImage?: (file: File) => Promise<string | undefined>;
  placeholder?: string;
}

export function DocumentEditor({
  blocks,
  nodes,
  objectTypes,
  onChange,
  onOpen,
  onCreateObject,
  onCreateWeblink,
  onCreateImage,
  placeholder,
}: DocumentEditorProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes);
  const typesRef = useRef(objectTypes);
  const saveTimer = useRef<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; command: string } | null>(null);
  const [suggest, setSuggest] = useState<{ x: number; y: number; query: string; active: number } | null>(null);
  const suggestRef = useRef(suggest);
  suggestRef.current = suggest;
  nodesRef.current = nodes;
  typesRef.current = objectTypes;

  const labelFor = (id: string) => {
    const node = nodesRef.current.find((item) => item.id === id);
    return (node && displayTitle(nodesRef.current, node)) || id.slice(0, 8);
  };

  const colorFor = (typeId: string | undefined) => objectTypes.find((item) => item.id === typeId)?.color;

  const plainOf = (element: HTMLElement) => {
    let out = '';
    const walk = (node: Node) => {
      if (node instanceof HTMLElement && node.dataset.id) {
        out += `[[${node.dataset.id}]]`;
        return;
      }
      if (node instanceof HTMLElement && node.classList.contains('capture-name')) {
        const code = CAPTURE_SHORTCUTS.find((item) => item.typeId === node.dataset.type)?.code ?? '';
        const name = (node.textContent ?? '').replace(/\u200b/g, '').trim();
        out += name ? `/${code} ${name}` : `/${code}`;
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? '';
      else node.childNodes.forEach(walk);
    };
    element.childNodes.forEach(walk);
    return out.replace(/\u00a0/g, ' ');
  };

  const appendRich = (parent: HTMLElement, text: string) => {
    const parts = text.split(/(\[\[[0-9a-fA-F-]{8,}\]\])/g);
    for (const part of parts) {
      const match = part.match(/^\[\[([0-9a-fA-F-]{8,})\]\]$/);
      if (match) appendObject(parent, match[1]);
      else if (part) parent.append(document.createTextNode(part));
    }
  };

  const readBlocks = (): Block[] => {
    const root = rootRef.current;
    if (!root) return blocks;
    const rows = [...root.children].filter((item): item is HTMLElement => item instanceof HTMLElement);
    if (!rows.length) return [{ ...emptyBlock(), text: root.textContent ?? '' }];
    return rows.map((row) => ({
      id: row.dataset.blockId || (row.dataset.blockId = newBlockId()),
      type: 'paragraph' as const,
      text: plainOf(row),
    }));
  };

  const markEmpty = () => {
    const root = rootRef.current;
    if (!root) return;
    const text = root.innerText.replace(/\u00a0/g, ' ').trim();
    const hasChip = !!root.querySelector('.inline-object, .inline-image, .capture-name');
    root.dataset.empty = !text && !hasChip ? 'true' : 'false';
  };

  const persist = () => {
    markEmpty();
    onChange(readBlocks());
  };

  const schedulePersist = () => {
    markEmpty();
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(persist, 280);
  };

  const place = (node: Node, offset: number) => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    const max = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').length : node.childNodes.length;
    range.setStart(node, Math.min(offset, max));
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const placeAtEnd = (element: HTMLElement) => {
    const last = element.lastChild;
    if (!last) {
      const text = document.createTextNode('');
      element.append(text);
      place(text, 0);
      return;
    }
    if (last.nodeType === Node.TEXT_NODE) place(last, (last.textContent ?? '').length);
    else place(element, element.childNodes.length);
  };

  const paint = (source: Block[]) => {
    const root = rootRef.current;
    if (!root) return;
    root.replaceChildren();
    const rows = source.length ? source : [emptyBlock()];
    for (const block of rows) {
      const paragraph = document.createElement('p');
      paragraph.dataset.blockId = block.id;
      appendRich(paragraph, block.text);
      if (!paragraph.childNodes.length) paragraph.append(document.createTextNode(''));
      root.append(paragraph);
    }
    markEmpty();
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (root === document.activeElement || root.contains(document.activeElement)) return;
    paint(blocks);
    // Labels update when nodes arrive. Repainting while typing would move the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, nodes]);

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }, []);

  const currentParagraph = () => {
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    if (!node || !rootRef.current?.contains(node)) return rootRef.current?.querySelector('p') ?? null;
    return (node instanceof HTMLElement ? node : node.parentElement)?.closest('p') ?? null;
  };

  const textBeforeCaret = () => {
    const selection = window.getSelection();
    const paragraph = currentParagraph();
    if (!selection || !selection.rangeCount || !paragraph) return '';
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(paragraph);
    range.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset);
    return range.toString().replace(/\u00a0/g, ' ');
  };

  const namingQuery = (naming: HTMLElement) =>
    (naming.textContent ?? '').replace(/\u200b/g, '').replace(/\u00a0/g, ' ').trim();

  const refreshSuggest = (naming: HTMLElement) => {
    const query = namingQuery(naming);
    const typeId = naming.dataset.type ?? '';
    const hits = nameSuggestions(nodesRef.current, typeId, query);
    if (!hits.length) {
      setSuggest(null);
      return;
    }
    const rect = naming.getBoundingClientRect();
    setSuggest((current) => ({
      x: rect.left,
      y: rect.bottom + 4,
      query,
      active: current && current.query === query ? Math.min(current.active, hits.length - 1) : 0,
    }));
  };

  const refreshMenu = () => {
    const paragraph = currentParagraph();
    const naming = paragraph?.querySelector('.capture-name');
    if (!paragraph || (naming && caretInside(naming))) {
      setMenu(null);
      if (naming instanceof HTMLElement && caretInside(naming)) refreshSuggest(naming);
      else setSuggest(null);
      return;
    }
    setSuggest(null);
    const opened = openShortcut(textBeforeCaret());
    if (!opened) {
      setMenu(null);
      return;
    }
    const selection = window.getSelection();
    const rect = selection && selection.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
    setMenu({
      x: rect?.left ?? 0,
      y: (rect?.bottom ?? 0) + 4,
      command: opened.command,
    });
  };

  const ensureSpace = (parent: HTMLElement) => {
    const last = parent.lastChild;
    if (!last) return;
    if (last.nodeType === Node.TEXT_NODE) {
      if (!/\s$/.test(last.textContent ?? '')) last.textContent = `${last.textContent} `;
      return;
    }
    parent.append(document.createTextNode(' '));
  };

  const makeChip = (id: string, label: string, color?: string) => {
    const span = document.createElement('span');
    span.className = 'inline-object';
    span.contentEditable = 'false';
    span.dataset.id = id;
    span.textContent = label || id.slice(0, 8);
    if (color) span.style.textDecorationColor = color;
    return span;
  };

  const appendObject = (parent: HTMLElement, id: string) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (node?.typeId === 'image') {
      parent.append(makeImage(id, labelFor(id)));
      return;
    }
    parent.append(makeChip(id, labelFor(id), colorFor(node?.typeId)));
  };

  const makeImage = (id: string, alt: string, src?: string) => {
    const img = document.createElement('img');
    img.className = 'inline-image';
    img.dataset.id = id;
    img.alt = alt;
    img.contentEditable = 'false';
    if (src) img.src = src;
    else {
      void imageSrc(id).then((url) => {
        if (url && img.isConnected) img.src = url;
      });
    }
    return img;
  };

  const imageSrc = async (id: string): Promise<string | null> => {
    const node = nodesRef.current.find((item) => item.id === id);
    const raw = node?.fieldValues.image?.src;
    if (typeof raw !== 'string') return null;
    if (isDataUrl(raw)) return raw;
    const mediaId = parseBlobRef(raw);
    if (!mediaId) return null;
    const record = await readMedia(mediaId);
    return record ? mediaObjectUrl(record) : null;
  };

  const makeName = (typeId: string) => {
    const span = document.createElement('span');
    span.className = 'capture-name is-empty';
    span.contentEditable = 'true';
    span.dataset.type = typeId;
    span.dataset.label = t(`supertags.${typeId}`);
    span.append(document.createTextNode('\u200b'));
    return span;
  };

  const focusName = (span: HTMLElement) => {
    const text = span.firstChild;
    if (!text) return;
    rootRef.current?.focus();
    place(text, (text.textContent ?? '').length);
  };

  const replaceTrailingShortcut = (paragraph: HTMLElement, typeId: string) => {
    let tail: ChildNode | null = paragraph.lastChild;
    while (
      tail &&
      (tail.nodeName === 'BR' || (tail.nodeType === Node.TEXT_NODE && (tail.textContent ?? '').length === 0))
    ) {
      const previous = tail.previousSibling;
      tail.remove();
      tail = previous;
    }
    if (tail?.nodeType === Node.TEXT_NODE) {
      const text = tail.textContent ?? '';
      const slashAt = text.lastIndexOf('/');
      if (slashAt >= 0) tail.textContent = text.slice(0, slashAt);
      if (!(tail.textContent ?? '').length) tail.remove();
    }
    const span = makeName(typeId);
    paragraph.append(span);
    focusName(span);
    setMenu(null);
    schedulePersist();
  };

  const applyPieces = async (paragraph: HTMLElement, pieces: LinePiece[]) => {
    if (!onCreateObject) return;
    type Built =
      | { kind: 'text'; text: string }
      | { kind: 'chip'; id: string; label: string; color?: string }
      | { kind: 'name'; typeId: string };
    const built: Built[] = [];
    for (const piece of pieces) {
      if (piece.kind === 'text') built.push(piece);
      else if (piece.kind === 'create') {
        const id = await onCreateObject(piece.typeId, piece.title);
        if (!id) {
          built.push({ kind: 'text', text: piece.title });
          continue;
        }
        built.push({ kind: 'chip', id, label: piece.title, color: colorFor(piece.typeId) });
      } else built.push({ kind: 'name', typeId: piece.typeId });
    }
    paragraph.replaceChildren();
    const caret: { node: Node | null; offset: number } = { node: null, offset: 0 };
    built.forEach((item, index) => {
      if (item.kind === 'text') {
        appendRich(paragraph, item.text);
        return;
      }
      if (paragraph.childNodes.length) ensureSpace(paragraph);
      if (item.kind === 'chip') {
        paragraph.append(makeChip(item.id, item.label, item.color));
        const space = document.createTextNode(index === built.length - 1 ? ' ' : '');
        if (space.textContent) paragraph.append(space);
        if (index === built.length - 1 && space.textContent) {
          caret.node = space;
          caret.offset = 1;
        }
        return;
      }
      const span = makeName(item.typeId);
      paragraph.append(span);
      caret.node = span.firstChild ?? span;
      caret.offset = 0;
    });
    rootRef.current?.focus();
    if (caret.node) place(caret.node, caret.offset);
    else placeAtEnd(paragraph);
    setMenu(null);
    persist();
  };

  const commitName = async (span: HTMLElement) => {
    const title = span.textContent?.replace(/\u200b/g, '').replace(/\u00a0/g, ' ').trim() ?? '';
    const typeId = span.dataset.type ?? '';
    if (!title || !typeId || !onCreateObject) {
      span.remove();
      schedulePersist();
      return;
    }
    const chip = makeChip('', canonicalName(title) || title, colorFor(typeId));
    const space = document.createTextNode(' ');
    span.replaceWith(chip, space);
    rootRef.current?.focus();
    place(space, 1);
    setMenu(null);
    setSuggest(null);
    const id = await onCreateObject(typeId, title);
    if (!id) {
      chip.replaceWith(document.createTextNode(title));
      persist();
      return;
    }
    chip.dataset.id = id;
    const label = labelFor(id);
    if (label && !label.startsWith(id.slice(0, 8))) chip.textContent = label;
    persist();
  };

  const acceptSuggestion = (span: HTMLElement, id: string) => {
    const node = nodesRef.current.find((item) => item.id === id);
    const chip = makeChip(id, (node && objectTitle(node)) || labelFor(id), colorFor(node?.typeId));
    const space = document.createTextNode(' ');
    span.replaceWith(chip, space);
    rootRef.current?.focus();
    place(space, 1);
    setMenu(null);
    setSuggest(null);
    persist();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const paragraph = currentParagraph();
    const naming = rootRef.current?.querySelector('.capture-name');
    const activeName = naming instanceof HTMLElement ? caretInside(naming) : null;
    if (event.key === 'Escape' && activeName) {
      event.preventDefault();
      const code = CAPTURE_SHORTCUTS.find((item) => item.typeId === activeName.dataset.type)?.code ?? '';
      const text = document.createTextNode(`/${code}`);
      activeName.replaceWith(text);
      place(text, text.textContent?.length ?? 0);
      setMenu(null);
      setSuggest(null);
      schedulePersist();
      return;
    }
    if (activeName && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const hits = nameSuggestions(nodesRef.current, activeName.dataset.type ?? '', namingQuery(activeName));
      if (hits.length) {
        event.preventDefault();
        const query = namingQuery(activeName);
        const rect = activeName.getBoundingClientRect();
        setSuggest((current) => {
          const index = current && current.query === query ? current.active : 0;
          const next = event.key === 'ArrowDown' ? (index + 1) % hits.length : (index - 1 + hits.length) % hits.length;
          return { x: rect.left, y: rect.bottom + 4, query, active: next };
        });
        return;
      }
    }
    if (event.key === 'Backspace' && window.getSelection()?.isCollapsed) {
      if (activeName && !(activeName.textContent ?? '').replace(/[\u200b\u00a0]/g, '').length) {
        event.preventDefault();
        const previous = activeName.previousSibling;
        activeName.remove();
        if (previous) placeAtEndNode(previous);
        else if (paragraph) placeAtEnd(paragraph);
        schedulePersist();
        return;
      }
      const previous = nodeBeforeCaret();
      if (previous instanceof HTMLElement && previous.dataset.id) {
        event.preventDefault();
        previous.remove();
        schedulePersist();
        return;
      }
    }
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (activeName) {
      event.preventDefault();
      const query = namingQuery(activeName);
      const hits = nameSuggestions(nodesRef.current, activeName.dataset.type ?? '', query);
      if (hits.length) {
        const index = suggestRef.current && suggestRef.current.query === query ? suggestRef.current.active : 0;
        acceptSuggestion(activeName, hits[Math.min(index, hits.length - 1)].id);
        return;
      }
      void commitName(activeName);
      return;
    }
    if (!paragraph || !onCreateObject) return;
    const plain = plainOf(paragraph);
    const pieces = lineCaptures(plain);
    if (pieces) {
      event.preventDefault();
      const names = pieces.filter((piece) => piece.kind === 'name');
      const creates = pieces.filter((piece) => piece.kind === 'create');
      if (creates.length === 0 && names.length === 1) {
        replaceTrailingShortcut(paragraph, names[0].typeId);
        return;
      }
      void applyPieces(paragraph, pieces);
      return;
    }
    const opened = openShortcut(textBeforeCaret());
    if (!opened) {
      if (isStandaloneUrl(plain) && onCreateWeblink) {
        event.preventDefault();
        void onCreateWeblink(plain.trim()).then((id) => {
          if (!id || !paragraph.isConnected) return;
          paragraph.replaceChildren(makeChip(id, plain.trim(), colorFor('weblink')));
          placeAtEnd(paragraph);
          persist();
        });
      }
      return;
    }
    const choices = captureChoices(opened.command);
    if (choices.length === 1) {
      event.preventDefault();
      replaceTrailingShortcut(paragraph, choices[0].typeId);
      return;
    }
    if (choices.length > 1 || opened.command === '') event.preventDefault();
  };

  return (
    <div
      className="block-editor is-document"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          rootRef.current?.focus();
          const last = rootRef.current?.querySelector('p:last-child');
          if (last instanceof HTMLElement) placeAtEnd(last);
        }
      }}
    >
      <div
        ref={rootRef}
        className="doc-flow"
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder || t('blocks.placeholder')}
        spellCheck
        onKeyDown={onKeyDown}
        onInput={() => {
          const naming = rootRef.current?.querySelector('.capture-name');
          if (naming) naming.classList.toggle('is-empty', !(naming.textContent ?? '').replace(/\u200b/g, '').trim());
          refreshMenu();
          const plain = rootRef.current ? [...rootRef.current.querySelectorAll('p')].map((row) => plainOf(row)).join('\n') : '';
          if (onCreateWeblink) {
            for (const hit of urlsInText(plain)) void onCreateWeblink(hit.url);
          }
          schedulePersist();
        }}
        onDragOver={(event) => {
          const types = [...event.dataTransfer.types];
          if (types.includes('Files') || imageFiles(event.dataTransfer).length) event.preventDefault();
        }}
        onPaste={(event) => {
          const images = imageFiles(event.clipboardData);
          if (images.length && onCreateImage) {
            event.preventDefault();
            void insertImages(images);
            return;
          }
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          insertPlain(text);
          schedulePersist();
        }}
        onDrop={(event) => {
          const images = imageFiles(event.dataTransfer);
          if (!images.length || !onCreateImage) return;
          event.preventDefault();
          const point = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(
            event.clientX,
            event.clientY,
          );
          if (point) {
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(point);
          }
          void insertImages(images);
        }}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          const naming = rootRef.current?.querySelector('.capture-name');
          if (naming instanceof HTMLElement && (naming.textContent ?? '').trim()) {
            void commitName(naming);
            return;
          }
          setMenu(null);
          setSuggest(null);
          persist();
        }}
        onClick={(event) => {
          const chip = (event.target as HTMLElement).closest?.('.inline-object, .inline-image');
          if (chip instanceof HTMLElement && chip.dataset.id) onOpen(chip.dataset.id);
        }}
      />
      {suggest && (() => {
        const naming = rootRef.current?.querySelector('.capture-name');
        const typeId = naming instanceof HTMLElement ? naming.dataset.type ?? '' : '';
        const hits = nameSuggestions(nodesRef.current, typeId, suggest.query);
        if (!hits.length) return null;
        return (
          <div className="doc-menu" style={{ left: suggest.x, top: suggest.y }}>
            {hits.map((node, index) => (
              <button
                key={node.id}
                type="button"
                className={index === suggest.active ? 'is-active' : ''}
                onMouseEnter={() => setSuggest((current) => (current ? { ...current, active: index } : current))}
                onMouseDown={(event) => {
                  event.preventDefault();
                  const field = rootRef.current?.querySelector('.capture-name');
                  if (field instanceof HTMLElement) acceptSuggestion(field, node.id);
                }}
              >
                {objectTitle(node)}
              </button>
            ))}
          </div>
        );
      })()}
      {menu && (
        <div className="doc-menu" style={{ left: menu.x, top: menu.y }}>
          {captureChoices(menu.command).map((item) => (
            <button
              key={item.typeId}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                const paragraph = currentParagraph();
                if (paragraph) replaceTrailingShortcut(paragraph, item.typeId);
              }}
            >
              <span>/{item.code}</span>
              {t(`supertags.${item.typeId}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  function insertPlain(text: string) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    place(node, node.textContent?.length ?? 0);
  }

  function paragraphForInsert(): HTMLElement | null {
    const root = rootRef.current;
    if (!root) return null;
    const current = currentParagraph();
    if (current) return current;
    const last = root.lastElementChild;
    if (last instanceof HTMLElement && last.tagName === 'P') return last;
    const created = document.createElement('p');
    created.dataset.blockId = newBlockId();
    root.append(created);
    return created;
  }

  async function insertImages(files: File[]) {
    if (!onCreateImage) return;
    const paragraph = paragraphForInsert();
    if (!paragraph) return;
    for (const file of files) {
      const id = await onCreateImage(file);
      if (!id) continue;
      if (paragraph.childNodes.length) ensureSpace(paragraph);
      const preview = URL.createObjectURL(file);
      const image = makeImage(id, file.name.replace(/\.[^.]+$/, '') || file.name, preview);
      const space = document.createTextNode(' ');
      paragraph.append(image, space);
      place(space, 1);
    }
    markEmpty();
    persist();
  }
}

function caretInside(element: Element | null): HTMLElement | null {
  if (!(element instanceof HTMLElement)) return null;
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  if (!node || !element.contains(node)) return null;
  return element;
}

function nodeBeforeCaret(): Node | null {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType === Node.TEXT_NODE) {
    if (startOffset > 0) return null;
    return startContainer.previousSibling;
  }
  if (startContainer instanceof HTMLElement) return startContainer.childNodes[startOffset - 1] ?? null;
  return null;
}

function placeAtEndNode(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  if (node.nodeType === Node.TEXT_NODE) range.setStart(node, (node.textContent ?? '').length);
  else range.setStart(node, node.childNodes.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function imageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const fromFiles = [...data.files].filter((file) => file.type.startsWith('image/'));
  if (fromFiles.length) return fromFiles;
  const found: File[] = [];
  for (const item of data.items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) found.push(file);
  }
  return found;
}
