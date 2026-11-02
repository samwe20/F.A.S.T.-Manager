import type { SupertagDef } from '../types';

const statusOptions = ['new', 'inProgress', 'done', 'cancelled'];
const priorityOptions = ['low', 'medium', 'high'];
const questionStatusOptions = ['open', 'researching', 'answered', 'archived'];
const importanceOptions = ['low', 'normal', 'high', 'critical'];
const ideaStatusOptions = ['raw', 'developing', 'accepted', 'rejected'];
const projectStatusOptions = ['planning', 'active', 'onHold', 'completed'];
const meetingStatusOptions = ['scheduled', 'completed', 'cancelled'];
const decisionStatusOptions = ['pending', 'decided', 'revisited'];

export const BUILTIN_SUPERTAGS: SupertagDef[] = [
  {
    id: 'task',
    name: 'Task',
    color: '#f59e0b',
    icon: 'check-square',
    description: 'Action item with deadline and priority',
    fields: [
      { key: 'dueDate', type: 'date' },
      { key: 'priority', type: 'select', options: priorityOptions, defaultValue: 'medium' },
      { key: 'status', type: 'select', options: statusOptions, defaultValue: 'new', required: true },
      { key: 'recurrence', type: 'select', options: ['none', 'daily', 'weekly', 'monthly'], defaultValue: 'none' },
      { key: 'reminderTime', type: 'datetime' },
      { key: 'assignee', type: 'reference', referenceSupertag: 'person' },
      { key: 'project', type: 'reference', referenceSupertag: 'project' },
    ],
  },
  {
    id: 'question',
    name: 'Question',
    color: '#8b5cf6',
    icon: 'help-circle',
    description: 'Open question to research or answer',
    fields: [
      { key: 'status', type: 'select', options: questionStatusOptions, defaultValue: 'open', required: true },
      { key: 'answer', type: 'text' },
      { key: 'askedTo', type: 'reference', referenceSupertag: 'person' },
      { key: 'dueDate', type: 'date' },
    ],
  },
  {
    id: 'inform',
    name: 'Inform',
    color: '#3b82f6',
    icon: 'info',
    description: 'Information worth remembering',
    fields: [
      { key: 'category', type: 'text' },
      { key: 'source', type: 'text' },
      { key: 'importance', type: 'select', options: importanceOptions, defaultValue: 'normal' },
      { key: 'verified', type: 'checkbox', defaultValue: false },
    ],
  },
  {
    id: 'person',
    name: 'Person',
    color: '#06b6d4',
    icon: 'user',
    description: 'Contact or team member',
    fields: [
      { key: 'email', type: 'text' },
      { key: 'phone', type: 'text' },
      { key: 'organization', type: 'text' },
      { key: 'role', type: 'text' },
    ],
  },
  {
    id: 'project',
    name: 'Project',
    color: '#10b981',
    icon: 'folder',
    description: 'Project or initiative',
    fields: [
      { key: 'status', type: 'select', options: projectStatusOptions, defaultValue: 'planning', required: true },
      { key: 'deadline', type: 'date' },
      { key: 'owner', type: 'reference', referenceSupertag: 'person' },
    ],
  },
  {
    id: 'dailyNote',
    name: 'DailyNote',
    color: '#6366f1',
    icon: 'calendar',
    description: 'Daily journal entry',
    fields: [{ key: 'date', type: 'date', required: true }],
  },
  {
    id: 'meeting',
    name: 'Meeting',
    color: '#ec4899',
    icon: 'users',
    description: 'Scheduled meeting',
    fields: [
      { key: 'dateTime', type: 'date', required: true },
      { key: 'location', type: 'text' },
      { key: 'status', type: 'select', options: meetingStatusOptions, defaultValue: 'scheduled' },
    ],
  },
  {
    id: 'decision',
    name: 'Decision',
    color: '#ef4444',
    icon: 'gavel',
    description: 'Recorded decision',
    fields: [
      { key: 'status', type: 'select', options: decisionStatusOptions, defaultValue: 'pending' },
      { key: 'decidedAt', type: 'date' },
      { key: 'outcome', type: 'text' },
      { key: 'rationale', type: 'text' },
    ],
  },
  {
    id: 'idea',
    name: 'Idea',
    color: '#eab308',
    icon: 'lightbulb',
    description: 'Creative idea or hypothesis',
    fields: [
      { key: 'status', type: 'select', options: ideaStatusOptions, defaultValue: 'raw' },
      { key: 'potential', type: 'select', options: priorityOptions, defaultValue: 'medium' },
    ],
  },
  {
    id: 'note',
    name: 'Note',
    color: '#64748b',
    icon: 'file-text',
    description: 'Plain note without extra fields',
    fields: [],
  },
  {
    id: 'folder',
    name: 'Folder',
    color: '#78716c',
    icon: 'folder-open',
    description: 'Container for documents and nested folders',
    fields: [{ key: 'description', type: 'text' }],
  },
];

export const SUPERTAG_MAP = Object.fromEntries(BUILTIN_SUPERTAGS.map((s) => [s.id, s]));

export function getDefaultFieldValues(tag: SupertagDef): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const field of tag.fields) {
    if (field.defaultValue !== undefined) {
      values[field.key] = field.defaultValue;
    } else if (field.type === 'checkbox') {
      values[field.key] = false;
    } else {
      values[field.key] = '';
    }
  }
  return values;
}

export function fieldsForLineObject(type: SupertagDef, dueDate?: string): Record<string, string | number | boolean> {
  const fields = { ...getDefaultFieldValues(type) };
  if (type.id === 'task' && dueDate) fields.dueDate = dueDate;
  return fields;
}
