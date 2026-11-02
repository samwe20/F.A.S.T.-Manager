import type { SupertagDef } from '../types';
import { foldSlash, joinIds, slashChoices, slashPick, type SlashCandidate } from './blocks';

const HIDDEN_TYPES = new Set(['tag', 'folder', 'dailyNote']);
const CASE_ENDINGS = ['ovi', 'ech', 'ami', 'ove', 'um', 'em', 'ou', 'u', 'a', 'e', 'y', 'i'];

export interface SlashToken {
  start: number;
  end: number;
  raw: string;
}

export interface SlashTypeRef {
  id: string;
  names: string[];
}

export interface SlashObjectRef {
  id: string;
  typeId: string;
  names: string[];
}

export interface PlannedMention {
  token: SlashToken;
  action: 'link' | 'create' | 'keep';
  id?: string;
  typeId?: string;
  title?: string;
}

export type SlashPlan =
  | { kind: 'none' }
  | { kind: 'ambiguous' }
  | { kind: 'create'; typeId: string; leading: SlashToken; mentions: PlannedMention[] }
  | { kind: 'mentions'; mentions: PlannedMention[] };

export interface ResolvedMention {
  token: SlashToken;
  plain: string;
  linked: string;
  id?: string;
  typeId?: string;
}

const SLASH_TOKEN = /(^|[\s(])\/([\p{L}\p{N}][\p{L}\p{N}'’_-]*)/gu;

export function slashTokens(text: string): SlashToken[] {
  const tokens: SlashToken[] = [];
  for (const match of text.matchAll(SLASH_TOKEN)) {
    const lead = match[1] ?? '';
    const raw = match[2] ?? '';
    const start = (match.index ?? 0) + lead.length;
    tokens.push({ start, end: start + 1 + raw.length, raw });
  }
  return tokens;
}

export function activeSlashToken(text: string): SlashToken | null {
  const tokens = slashTokens(text);
  const last = tokens[tokens.length - 1];
  if (!last || last.end !== text.length) return null;
  return last;
}

export function nameStem(value: string): string {
  const folded = foldSlash(value);
  for (const ending of CASE_ENDINGS) {
    if (folded.endsWith(ending) && folded.length - ending.length >= 3) {
      return folded.slice(0, -ending.length);
    }
  }
  return folded;
}

function namesOf(item: SlashCandidate): string[] {
  return [item.id, ...item.names];
}

function sameStem(left: string, right: string): boolean {
  const stem = nameStem(left);
  return stem.length >= 3 && stem === nameStem(right);
}

function isExactName(word: string, item: SlashCandidate): boolean {
  const folded = foldSlash(word);
  return namesOf(item).some((name) => foldSlash(name) === folded);
}

export function uniqueTypeByStem(word: string, types: SlashTypeRef[]): SlashTypeRef | undefined {
  const exact = types.filter((type) => isExactName(word, type));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const stemmed = types.filter((type) => namesOf(type).some((name) => sameStem(word, name)));
  return stemmed.length === 1 ? stemmed[0] : undefined;
}

export function typeHintForToken(text: string, token: SlashToken, types: SlashTypeRef[]): string | undefined {
  const previous = slashTokens(text).filter((item) => item.end <= token.start).at(-1);
  const window = text.slice(previous ? previous.end : 0, token.start);
  const words = window.trim().split(/\s+/).filter(Boolean).slice(-3);
  for (let index = words.length - 1; index >= 0; index -= 1) {
    const word = words[index].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!word) continue;
    const match = uniqueTypeByStem(word, types);
    if (match) return match.id;
  }
  return undefined;
}

export function defaultMentionType(types: SlashTypeRef[]): string | undefined {
  if (types.some((type) => type.id === 'person')) return 'person';
  if (types.some((type) => type.id === 'note')) return 'note';
  return undefined;
}

export function matchObjects(raw: string, objects: SlashObjectRef[]): { kind: 'exact' | 'stem' | 'none'; objects: SlashObjectRef[] } {
  const visible = objects.filter((item) => item.typeId && !HIDDEN_TYPES.has(item.typeId));
  const exact = visible.filter((item) => item.names.some((name) => foldSlash(name) === foldSlash(raw)));
  if (exact.length > 0) return { kind: 'exact', objects: exact };
  const stemmed = visible.filter((item) => item.names.some((name) => sameStem(raw, name)));
  if (stemmed.length > 0) return { kind: 'stem', objects: stemmed };
  return { kind: 'none', objects: [] };
}

export function planMention(text: string, token: SlashToken, types: SlashTypeRef[], objects: SlashObjectRef[]): PlannedMention {
  const hint = typeHintForToken(text, token, types);
  const found = matchObjects(token.raw, objects).objects;
  const hinted = hint ? found.filter((item) => item.typeId === hint) : [];
  if (hinted.length === 1) return { token, action: 'link', id: hinted[0].id, typeId: hinted[0].typeId };
  if (hinted.length > 1) return { token, action: 'keep' };
  if (!hint && found.length === 1) return { token, action: 'link', id: found[0].id, typeId: found[0].typeId };
  if (!hint && found.length > 1) return { token, action: 'keep' };
  if (uniqueTypeByStem(token.raw, types)) return { token, action: 'keep' };
  if (hint && HIDDEN_TYPES.has(hint)) return { token, action: 'keep' };
  const typeId = hint ?? defaultMentionType(types.filter((type) => !HIDDEN_TYPES.has(type.id)));
  if (!typeId || HIDDEN_TYPES.has(typeId)) return { token, action: 'keep' };
  return { token, action: 'create', typeId, title: token.raw };
}

export function planSlashLine(text: string, types: SlashTypeRef[], objects: SlashObjectRef[]): SlashPlan {
  const tokens = slashTokens(text);
  if (tokens.length === 0) return { kind: 'none' };
  const creatable = types.filter((type) => !HIDDEN_TYPES.has(type.id));
  const leading = tokens[0];
  if (leading.start === 0) {
    const allHits = slashChoices(leading.raw, types);
    if (allHits.length > 0 && allHits.every((type) => HIDDEN_TYPES.has(type.id))) return { kind: 'none' };
    const choices = slashChoices(leading.raw, creatable);
    const pick = slashPick(leading.raw, creatable);
    if (choices.length > 1 && !pick) return { kind: 'ambiguous' };
    if (pick) {
      return {
        kind: 'create',
        typeId: pick.id,
        leading,
        mentions: tokens.slice(1).map((token) => planMention(text, token, types, objects)),
      };
    }
  }
  return { kind: 'mentions', mentions: tokens.map((token) => planMention(text, token, types, objects)) };
}

function applyPieces(text: string, mentions: ResolvedMention[], key: 'plain' | 'linked'): string {
  const ordered = [...mentions].sort((left, right) => right.token.start - left.token.start);
  let out = text;
  for (const mention of ordered) {
    out = out.slice(0, mention.token.start) + mention[key] + out.slice(mention.token.end);
  }
  return out;
}

function stripLeading(value: string, leading: SlashToken): string {
  let end = leading.end;
  while (value[end] === ' ') end += 1;
  return (value.slice(0, leading.start) + value.slice(end)).trim();
}

export function renderSlashText(text: string, mentions: ResolvedMention[], leading?: SlashToken): { plain: string; linked: string } {
  const plain = applyPieces(text, mentions, 'plain');
  const linked = applyPieces(text, mentions, 'linked');
  if (!leading) return { plain, linked };
  return { plain: stripLeading(plain, leading), linked: stripLeading(linked, leading) };
}

export function replacementFor(mention: PlannedMention, id = mention.id): ResolvedMention {
  if (mention.action === 'keep' || !id) {
    const raw = `/${mention.token.raw}`;
    return { token: mention.token, plain: raw, linked: raw };
  }
  return {
    token: mention.token,
    plain: mention.token.raw,
    linked: `[[${id}]]`,
    id,
    typeId: mention.typeId,
  };
}

export function linkMentionFields(
  type: SupertagDef,
  fields: Record<string, string | number | boolean>,
  mentions: { id: string; typeId: string }[],
): Record<string, string | number | boolean> {
  const next = { ...fields };
  const used = new Set<string>();
  for (const field of type.fields) {
    if (field.type !== 'reference' || !field.referenceSupertag) continue;
    const hits = mentions.filter((mention) => mention.typeId === field.referenceSupertag && !used.has(mention.id));
    if (hits.length === 0) continue;
    if (field.multiple) {
      next[field.key] = joinIds(hits.map((mention) => mention.id));
      hits.forEach((mention) => used.add(mention.id));
    } else if (!next[field.key]) {
      next[field.key] = hits[0].id;
      used.add(hits[0].id);
    }
  }
  return next;
}
