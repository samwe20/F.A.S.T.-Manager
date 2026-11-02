import type { NodeRecord } from '../types';

const MAX_HISTORY = 50;

let undoStack: NodeRecord[][] = [];
let redoStack: NodeRecord[][] = [];

export function pushHistory(nodes: NodeRecord[]): void {
  undoStack.push(structuredClone(nodes));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function popUndo(current: NodeRecord[]): NodeRecord[] | null {
  if (undoStack.length === 0) return null;
  redoStack.push(structuredClone(current));
  return undoStack.pop() ?? null;
}

export function popRedo(current: NodeRecord[]): NodeRecord[] | null {
  if (redoStack.length === 0) return null;
  undoStack.push(structuredClone(current));
  return redoStack.pop() ?? null;
}

export function clearHistory(): void {
  undoStack = [];
  redoStack = [];
}
