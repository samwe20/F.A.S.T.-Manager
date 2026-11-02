import { describe, expect, it } from 'vitest';
import {
  adjustIndent,
  embedIdFromText,
  isEmbedText,
  lineToBlock,
  mirrorContent,
  moveBlock,
  parseContentField,
  serializeContentField,
} from '../src/utils/blocks';
import { linkIdsInNode } from '../src/utils/blocks';
import type { Block, NodeRecord } from '../src/types';

const id = '11111111-1111-1111-1111-111111111111';

function block(partial: Partial<Block> & Pick<Block, 'id' | 'text'>): Block {
  return { type: 'paragraph', ...partial };
}

describe('embed blocks', () => {
  it('recognises a block that is only one link', () => {
    expect(isEmbedText(`[[${id}]]`)).toBe(true);
    expect(isEmbedText(`  [[${id}]]  `)).toBe(true);
    expect(embedIdFromText(`[[${id}]]`)).toBe(id);
  });

  it('leaves mixed prose as text', () => {
    expect(isEmbedText(`viz [[${id}]]`)).toBe(false);
    expect(isEmbedText(`[[${id}]] a dál`)).toBe(false);
    expect(embedIdFromText(`viz [[${id}]]`)).toBeNull();
  });
});

describe('indent and order', () => {
  it('clamps indent and leaves the heading level alone', () => {
    const heading = block({ id: 'h', type: 'heading', level: 2, text: 'Nadpis', indent: 4 });
    expect(adjustIndent(heading, 1).indent).toBe(4);
    expect(adjustIndent(heading, 1).level).toBe(2);
    expect(adjustIndent(heading, -8).indent).toBe(0);
  });

  it('moves a block without dropping the others', () => {
    const blocks = [
      block({ id: 'a', text: 'a' }),
      block({ id: 'b', text: 'b' }),
      block({ id: 'c', text: 'c' }),
    ];
    expect(moveBlock(blocks, 0, 2).map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(moveBlock(blocks, 2, 0).map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(moveBlock(blocks, 1, 1)).toBe(blocks);
  });
});

describe('markdown mirror', () => {
  it('keeps an embed as a link line and stores indent as spaces', () => {
    const blocks = [
      block({ id: 'e', text: `[[${id}]]` }),
      block({ id: 'h', type: 'heading', level: 1, text: 'Nadpis', indent: 1 }),
      block({ id: 't', type: 'todo', text: 'úkol', checked: false, indent: 2 }),
    ];
    expect(mirrorContent('', blocks)).toBe(`[[${id}]]\n  # Nadpis\n    - [ ] úkol`);
  });

  it('reads indent back without changing the heading level', () => {
    const heading = lineToBlock('  ## Nadpis');
    expect(heading.indent).toBe(1);
    expect(heading.level).toBe(2);
    expect(heading.text).toBe('Nadpis');
    const task = lineToBlock('    - [x] hotovo');
    expect(task.type).toBe('todo');
    expect(task.indent).toBe(2);
    expect(task.checked).toBe(true);
  });

  it('keeps a line break inside a single block', () => {
    expect(mirrorContent('', [block({ id: 'p', text: 'první řádek\ndruhý řádek' })])).toBe('první řádek\ndruhý řádek');
  });

  it('still counts the embed as one backlink', () => {
    const node = {
      id: 'note',
      content: `[[${id}]]`,
      blocks: [block({ id: 'e', text: `[[${id}]]` })],
    } as NodeRecord;
    expect(linkIdsInNode(node)).toEqual([id]);
  });
});

describe('content property', () => {
  it('round-trips a block body stored on a property', () => {
    const blocks = [block({ id: 'body', type: 'paragraph', text: 'další tělo' })];
    expect(parseContentField(serializeContentField(blocks))).toEqual(blocks);
  });

  it('reads a plain string as lines', () => {
    const blocks = parseContentField('první\ndruhý');
    expect(blocks.map((item) => item.text)).toEqual(['první', 'druhý']);
  });
});
