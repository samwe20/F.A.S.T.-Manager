import { create } from 'zustand';
import { BUILTIN_SUPERTAGS, fieldsForLineObject, getDefaultFieldValues } from '../data/supertags';
import i18n from '../i18n';
import {
  addNodeEmbed,
  addSupertagToNode,
  completeTask as completeTaskNode,
  createNode,
  deleteNode,
  evaluateQuery,
  getAllNodes,
  getQueries,
  getWorkspaces,
  loadSettings,
  moveNode,
  removeNodeEmbed,
  removeSupertagFromNode,
  restoreNodesSnapshot,
  saveQuery,
  saveSettings,
  seedIfEmpty,
  updateNode,
  updateNodeField,
} from '../services/dataService';
import {
  addThemeTag,
  createCollection,
  createObjectType,
  createThemeTag,
  createWeblinkObject,
  ensureDailyNote,
  ensureObjectModel,
  getCollections,
  getObjectTypes,
  getTemplates,
  removeThemeTag,
  setObjectBody,
  saveObjectType,
  saveTemplate,
  setObjectProperty,
  setObjectType,
  templateForType,
  toggleCollectionItem,
} from '../services/objectModel';
import { exportDirectory, importDirectory, importLinkedVault, scheduleVaultExport } from '../services/vaultSync';
import { clearLink, persistLink, pickDirectory, VaultUnsupportedError } from '../services/vaultLink';
import {
  canRedo,
  canUndo,
  clearHistory,
  popRedo,
  popUndo,
  pushHistory,
} from '../services/historyService';
import { saveMediaFile } from '../services/mediaStore';
import { requestNotificationPermission, startReminderChecker } from '../services/reminderService';
import { SyncClient, type SyncStatus } from '../sync/syncClient';
import type {
  AppSettings,
  Block,
  CollectionRecord,
  DataView,
  NodeEmbed,
  NodeRecord,
  ObjectTypeRecord,
  QueryExpression,
  QuickCaptureInput,
  SavedQueryRecord,
  TemplateRecord,
  Theme,
  WorkspaceRecord,
} from '../types';
import { emptyBlock } from '../utils/blocks';
import { blobRef } from '../utils/media';
import { localToday } from '../utils/dateUtils';
import { getFolderNodes, resolveFolderTitle } from '../utils/folderUtils';
import { getBacklinks, resolveNodeTitle, searchNodes } from '../utils/nodeUtils';

export type ViewMode =
  | 'inbox'
  | 'today'
  | 'planned'
  | 'query'
  | 'settings'
  | 'search'
  | 'folder'
  | 'object'
  | 'type'
  | 'calendar'
  | 'studio'
  | 'collection';

interface AppState {
  ready: boolean;
  initError: string | null;
  settings: AppSettings | null;
  workspaces: WorkspaceRecord[];
  nodes: NodeRecord[];
  queries: SavedQueryRecord[];
  objectTypes: ObjectTypeRecord[];
  collections: CollectionRecord[];
  templates: TemplateRecord[];
  selectedNodeId: string | null;
  activeView: ViewMode;
  returnView: ViewMode;
  returnNodeId: string | null;
  activeQueryId: string | null;
  activeFolderId: string | null;
  activeTypeId: string | null;
  activeCollectionId: string | null;
  dataView: DataView;
  searchQuery: string;
  commandPaletteOpen: boolean;
  quickCaptureOpen: boolean;
  showMobilePanel: boolean;
  syncStatus: SyncStatus;
  syncClient: SyncClient | null;
  historyTick: number;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  withHistory: <T>(fn: () => Promise<T>) => Promise<T>;
  selectNode: (id: string | null) => void;
  setView: (view: ViewMode, queryId?: string | null, folderId?: string | null) => void;
  openFolder: (folderId: string) => void;
  setSearchQuery: (q: string) => void;
  openQuickCapture: () => void;
  closeQuickCapture: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleMobilePanel: () => void;
  addRootNode: (content?: string) => Promise<void>;
  addFolder: (parentId?: string | null) => Promise<void>;
  addDocument: (parentId?: string | null) => Promise<void>;
  addChildNode: (parentId: string) => Promise<void>;
  quickCapture: (input: QuickCaptureInput) => Promise<void>;
  editNodeContent: (id: string, content: string) => Promise<void>;
  removeNode: (id: string) => Promise<void>;
  attachTag: (nodeId: string, tagId: string) => Promise<void>;
  detachTag: (nodeId: string, tagId: string) => Promise<void>;
  setField: (nodeId: string, tagId: string, key: string, value: string | number | boolean) => Promise<void>;
  completeTask: (nodeId: string) => Promise<void>;
  moveNodeTo: (nodeId: string, parentId: string | null, order: number) => Promise<void>;
  addEmbed: (nodeId: string, expression: QueryExpression, title?: string) => Promise<void>;
  removeEmbed: (nodeId: string, embedId: string) => Promise<void>;
  getEmbedResults: (embed: NodeEmbed) => NodeRecord[];
  getFolderNodes: (parentId?: string | null) => NodeRecord[];
  resolveFolderTitle: (folderId: string) => string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  markOnboardingDone: () => Promise<void>;
  applyTheme: (theme: Theme) => void;
  syncNow: () => Promise<void>;
  getVisibleNodes: () => NodeRecord[];
  getQueryResults: () => NodeRecord[];
  getSearchResults: () => NodeRecord[];
  getNodeBacklinks: (nodeId: string) => NodeRecord[];
  resolveNodeTitle: (nodeId: string) => string;
  canUndoAction: () => boolean;
  canRedoAction: () => boolean;
  openObject: (id: string) => void;
  backToIndex: () => void;
  openType: (typeId: string) => void;
  openCollection: (collectionId: string) => void;
  setDataView: (view: DataView) => void;
  createTypedObject: (typeId: string) => Promise<void>;
  saveObjectBody: (id: string, title: string, blocks: Block[]) => Promise<void>;
  changeObjectType: (id: string, typeId: string) => Promise<void>;
  setObjectField: (id: string, typeId: string, key: string, value: string | number | boolean) => Promise<void>;
  addTagToObject: (id: string, tagId: string) => Promise<void>;
  removeTagFromObject: (id: string, tagId: string) => Promise<void>;
  createAndAddTag: (id: string, name: string) => Promise<void>;
  setAliases: (id: string, aliases: string[]) => Promise<void>;
  setReviewed: (id: string, reviewed: boolean) => Promise<void>;
  saveType: (type: ObjectTypeRecord) => Promise<void>;
  addType: (name: string) => Promise<ObjectTypeRecord | undefined>;
  addCollection: (name: string, typeId: string) => Promise<void>;
  toggleInCollection: (collectionId: string, objectId: string) => Promise<void>;
  saveTypeTemplate: (input: { typeId: string; name: string; title: string; fieldValues: Record<string, string | number | boolean>; blocks: Block[] }) => Promise<void>;
  saveNewQuery: (input: { name: string; expression: QueryExpression }) => Promise<void>;
  openDaily: (date: string) => Promise<void>;
  createObjectFromLine: (typeId: string, title: string, dueDate?: string) => Promise<string | undefined>;
  createTag: (name: string) => Promise<void>;
  ensureTag: (name: string) => Promise<string | undefined>;
  createWeblink: (url: string) => Promise<string | undefined>;
  attachMedia: (nodeId: string, typeId: string, file: File) => Promise<void>;
  setMediaProperty: (nodeId: string, typeId: string, key: string, file: File) => Promise<void>;
  vaultError: string | null;
  vaultSavedAt: string | null;
  chooseVault: () => Promise<void>;
  loadVault: () => Promise<void>;
  disconnectVault: () => Promise<void>;
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  initError: null,
  settings: null,
  workspaces: [],
  nodes: [],
  queries: [],
  objectTypes: [],
  collections: [],
  templates: [],
  selectedNodeId: null,
  activeView: 'object',
  returnView: 'calendar',
  returnNodeId: null,
  activeQueryId: 'q-tasks',
  activeFolderId: null,
  activeTypeId: null,
  activeCollectionId: null,
  dataView: 'list',
  searchQuery: '',
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  showMobilePanel: false,
  syncStatus: {
    enabled: false,
    connected: false,
    syncing: false,
    lastSyncAt: null,
    error: null,
    pendingCount: 0,
  },
  syncClient: null,
  historyTick: 0,
  vaultError: null,
  vaultSavedAt: null,

  init: async () => {
    try {
      await seedIfEmpty();
      await ensureObjectModel();
      let vaultError: string | null = null;
      try {
        await importLinkedVault();
      } catch (err) {
        vaultError = err instanceof Error ? err.message : String(err);
      }
      const settings = await loadSettings();
      const [workspaces, queries, objectTypes, collections, templates] = await Promise.all([
        getWorkspaces(),
        getQueries(),
        getObjectTypes(),
        getCollections(),
        getTemplates(),
      ]);
      const wsId = settings.workspaceId || workspaces[0]?.id || 'default';
      const todayNote = await ensureDailyNote(wsId, localToday());
      const nodes = await getAllNodes(wsId);

      document.documentElement.lang = settings.language;
      if (settings.language) {
        await i18n.changeLanguage(settings.language);
      }
      get().applyTheme(settings.theme);
      void requestNotificationPermission();

      const syncClient = new SyncClient(settings);
      syncClient.subscribe((status) => set({ syncStatus: status }));
      if (settings.syncEnabled) void syncClient.connect();

      startReminderChecker(
        () => get().nodes,
        () => get().settings?.language ?? 'cs',
      );

      clearHistory();
      set({
        ready: true,
        initError: null,
        settings: { ...settings, workspaceId: wsId, onboardingDone: settings.onboardingDone ?? false, syncEnabled: settings.syncEnabled ?? false },
        workspaces,
        nodes,
        queries,
        objectTypes,
        collections,
        templates,
        selectedNodeId: todayNote.id,
        activeView: 'object',
        returnView: 'calendar',
        returnNodeId: null,
        syncClient,
        vaultError,
        vaultSavedAt: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('FAST init failed:', err);
      set({ ready: false, initError: message });
    }
  },

  refresh: async () => {
    const { settings } = get();
    if (!settings) return;
    const [nodes, queries, workspaces, objectTypes, collections, templates] = await Promise.all([
      getAllNodes(settings.workspaceId),
      getQueries(),
      getWorkspaces(),
      getObjectTypes(),
      getCollections(),
      getTemplates(),
    ]);
    set({ nodes, queries, workspaces, objectTypes, collections, templates });
    try {
      const wrote = await scheduleVaultExport();
      if (wrote) set({ vaultError: null, vaultSavedAt: new Date().toISOString() });
    } catch (err) {
      set({ vaultError: err instanceof Error ? err.message : String(err) });
    }
  },

  withHistory: async (fn) => {
    pushHistory(get().nodes);
    const result = await fn();
    set((s) => ({ historyTick: s.historyTick + 1 }));
    void get().syncClient?.syncNow();
    return result;
  },

  selectNode: (id) => set({ selectedNodeId: id, showMobilePanel: !!id }),

  setView: (view, queryId = null, folderId = undefined) =>
    set({
      activeView: view,
      activeQueryId: queryId ?? get().activeQueryId,
      activeFolderId: view === 'folder' ? (folderId ?? get().activeFolderId) : null,
      searchQuery: view === 'search' ? get().searchQuery : '',
    }),

  openFolder: (folderId) => set({ activeView: 'folder', activeFolderId: folderId, selectedNodeId: null }),

  setSearchQuery: (q) => {
    if (!q.trim() && get().activeView === 'search') {
      set({ searchQuery: '' });
      void get().openDaily(localToday());
      return;
    }
    set({
      searchQuery: q,
      activeView: q ? 'search' : get().activeView,
    });
  },

  openQuickCapture: () => set({ quickCaptureOpen: true }),
  closeQuickCapture: () => set({ quickCaptureOpen: false }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleMobilePanel: () => set((s) => ({ showMobilePanel: !s.showMobilePanel })),

  addRootNode: async () => {
    await get().createTypedObject('note');
  },

  addFolder: async (parentId) => {
    await get().withHistory(async () => {
      const { settings, activeFolderId, activeView } = get();
      if (!settings) return;
      const folderParent =
        parentId !== undefined ? parentId : activeView === 'folder' && activeFolderId ? activeFolderId : null;
      const node = await createNode({
        workspaceId: settings.workspaceId,
        parentId: folderParent,
        content: i18n.t('folders.newFolder'),
        supertagIds: ['folder'],
      });
      await get().refresh();
      set({ selectedNodeId: node.id, activeView: 'folder', activeFolderId: node.id });
    });
  },

  addDocument: async (parentId) => {
    await get().withHistory(async () => {
      const { settings, activeFolderId, activeView } = get();
      if (!settings) return;
      const docParent =
        parentId !== undefined ? parentId : activeView === 'folder' && activeFolderId ? activeFolderId : null;
      const node = await createNode({
        workspaceId: settings.workspaceId,
        parentId: docParent,
        content: i18n.t('folders.newDocument'),
        supertagIds: ['note'],
      });
      await get().refresh();
      set({ selectedNodeId: node.id });
    });
  },

  addChildNode: async (parentId) => {
    await get().withHistory(async () => {
      const { settings } = get();
      if (!settings) return;
      const node = await createNode({ workspaceId: settings.workspaceId, parentId, content: ' ' });
      await get().refresh();
      set({ selectedNodeId: node.id });
    });
  },

  quickCapture: async (input) => {
    await get().withHistory(async () => {
      const { settings } = get();
      if (!settings || !input.content.trim()) return;

      const tagId = input.supertagId ?? 'task';
      const tag = BUILTIN_SUPERTAGS.find((t) => t.id === tagId);
      const fieldValues: NodeRecord['fieldValues'] = {};
      if (tag) {
        fieldValues[tagId] = {
          ...getDefaultFieldValues(tag),
          ...(input.dueDate ? { dueDate: input.dueDate } : {}),
          ...(input.reminderTime ? { reminderTime: input.reminderTime } : {}),
        };
      }

      const node = await createNode({
        workspaceId: settings.workspaceId,
        parentId: null,
        content: input.content.trim(),
        supertagIds: [tagId],
        fieldValues,
      });
      await get().refresh();
      set({ selectedNodeId: node.id, activeView: 'inbox', quickCaptureOpen: false });
    });
  },

  editNodeContent: async (id, content) => {
    await get().withHistory(async () => {
      const node = get().nodes.find((item) => item.id === id);
      await updateNode(id, node?.typeId === 'folder' ? { content, title: content } : { content });
      await get().refresh();
    });
  },

  removeNode: async (id) => {
    await get().withHistory(async () => {
      await deleteNode(id);
      await get().refresh();
      if (get().selectedNodeId === id) set({ selectedNodeId: null });
    });
  },

  attachTag: async (nodeId, tagId) => {
    await get().withHistory(async () => {
      await addSupertagToNode(nodeId, tagId);
      await get().refresh();
    });
  },

  detachTag: async (nodeId, tagId) => {
    await get().withHistory(async () => {
      await removeSupertagFromNode(nodeId, tagId);
      await get().refresh();
    });
  },

  setField: async (nodeId, tagId, key, value) => {
    await get().withHistory(async () => {
      await updateNodeField(nodeId, tagId, key, value);
      await get().refresh();
    });
  },

  completeTask: async (nodeId) => {
    await get().withHistory(async () => {
      await completeTaskNode(nodeId);
      await get().refresh();
    });
  },

  moveNodeTo: async (nodeId, parentId, order) => {
    await get().withHistory(async () => {
      await moveNode(nodeId, parentId, order);
      await get().refresh();
    });
  },

  addEmbed: async (nodeId, expression, title) => {
    await get().withHistory(async () => {
      await addNodeEmbed(nodeId, expression, title);
      await get().refresh();
    });
  },

  removeEmbed: async (nodeId, embedId) => {
    await get().withHistory(async () => {
      await removeNodeEmbed(nodeId, embedId);
      await get().refresh();
    });
  },

  getEmbedResults: (embed) => evaluateQuery(get().nodes, embed.expression),

  getFolderNodes: (parentId = null) => getFolderNodes(get().nodes, parentId),

  resolveFolderTitle: (folderId) => resolveFolderTitle(get().nodes, folderId),

  undo: async () => {
    const snapshot = popUndo(get().nodes);
    if (!snapshot) return;
    await restoreNodesSnapshot(snapshot);
    await get().refresh();
    set((s) => ({ historyTick: s.historyTick + 1 }));
    void get().syncClient?.syncNow();
  },

  redo: async () => {
    const snapshot = popRedo(get().nodes);
    if (!snapshot) return;
    await restoreNodesSnapshot(snapshot);
    await get().refresh();
    set((s) => ({ historyTick: s.historyTick + 1 }));
    void get().syncClient?.syncNow();
  },

  updateSettings: async (patch) => {
    const current = get().settings;
    if (!current) return;
    const next = { ...current, ...patch };
    await saveSettings(next);
    if (patch.theme) get().applyTheme(patch.theme);
    if (patch.language) {
      document.documentElement.lang = patch.language;
      await i18n.changeLanguage(patch.language);
    }
    if (patch.theme || patch.language || patch.syncUrl || patch.syncEnabled) {
      get().syncClient?.updateSettings(next);
    }
    set({ settings: next });
  },

  markOnboardingDone: async () => {
    await get().updateSettings({ onboardingDone: true });
  },

  chooseVault: async () => {
    try {
      const dir = await pickDirectory(i18n.t('vault.choose'));
      if (!dir) return;
      const exists = await dir.exists('vault.json');
      if (exists && !window.confirm(i18n.t('vault.replaceLocal'))) return;
      const link = await persistLink(dir);
      await get().updateSettings(link);
      if (exists) await importDirectory(dir);
      else await exportDirectory(dir);
      await get().refresh();
      set({ vaultError: null, vaultSavedAt: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof VaultUnsupportedError ? i18n.t('vault.unsupported') : err instanceof Error ? err.message : String(err);
      set({ vaultError: message });
    }
  },

  loadVault: async () => {
    try {
      if (!window.confirm(i18n.t('vault.replaceLocal'))) return;
      const imported = await importLinkedVault();
      if (!imported) {
        set({ vaultError: get().settings?.vaultLabel || get().settings?.vaultPath ? i18n.t('vault.needsPermission') : i18n.t('vault.empty') });
        return;
      }
      await get().refresh();
      set({ vaultError: null, vaultSavedAt: new Date().toISOString() });
    } catch (err) {
      set({ vaultError: err instanceof Error ? err.message : String(err) });
    }
  },

  disconnectVault: async () => {
    await clearLink();
    await get().updateSettings({ vaultPath: null, vaultLabel: null });
    set({ vaultError: null, vaultSavedAt: null });
  },

  applyTheme: (theme) => {
    const resolved = resolveTheme(theme);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  },

  syncNow: async () => {
    await get().syncClient?.syncNow();
    const settings = get().settings;
    if (settings) {
      const next = { ...settings, lastSyncAt: new Date().toISOString() };
      await saveSettings(next);
      set({ settings: next });
    }
    await get().refresh();
  },

  getVisibleNodes: () => {
    const { nodes, activeView, activeFolderId } = get();
    const today = localToday();
    if (activeView === 'today') {
      return nodes.filter(
        (n) =>
          (n.typeId === 'dailyNote' || n.supertagIds.includes('dailyNote')) && n.fieldValues.dailyNote?.date === today ||
          ((n.typeId === 'task' || n.supertagIds.includes('task')) &&
            n.fieldValues.task?.dueDate === today &&
            n.fieldValues.task?.status !== 'done') ||
          (n.blocks ?? []).some((block) => block.type === 'todo' && !block.checked),
      );
    }
    if (activeView === 'search') return get().getSearchResults();
    if (activeView === 'planned') {
      return nodes
        .filter(
          (n) =>
            (n.typeId === 'task' || n.supertagIds.includes('task')) &&
            typeof n.fieldValues.task?.dueDate === 'string' &&
            (n.fieldValues.task.dueDate as string) > today &&
            n.fieldValues.task?.status !== 'done',
        )
        .sort((a, b) =>
          String(a.fieldValues.task?.dueDate ?? '').localeCompare(String(b.fieldValues.task?.dueDate ?? '')),
        );
    }
    if (activeView === 'folder' && activeFolderId) {
      return nodes.filter((n) => n.parentId === activeFolderId).sort((a, b) => a.order - b.order);
    }
    return nodes
      .filter(
        (n) =>
          n.parentId === null &&
          n.typeId !== 'folder' &&
          n.typeId !== 'tag' &&
          !n.supertagIds.includes('folder'),
      )
      .sort((a, b) => a.order - b.order);
  },

  getQueryResults: () => {
    const { nodes, queries, activeQueryId } = get();
    const query = queries.find((q) => q.id === activeQueryId);
    if (!query) return [];
    return evaluateQuery(nodes, query.expression);
  },

  getSearchResults: () => {
    const { nodes, searchQuery } = get();
    return searchNodes(nodes, searchQuery);
  },

  getNodeBacklinks: (nodeId) => getBacklinks(get().nodes, nodeId),

  resolveNodeTitle: (nodeId) => resolveNodeTitle(get().nodes, nodeId),

  canUndoAction: () => canUndo(),
  canRedoAction: () => canRedo(),

  openObject: (id) =>
    set((state) => ({
      returnView: state.activeView === 'object' ? state.returnView : state.activeView,
      returnNodeId: state.activeView === 'object' ? state.selectedNodeId : null,
      selectedNodeId: id,
      activeView: 'object',
    })),

  backToIndex: () => {
    const state = get();
    if (state.returnNodeId) {
      set({ selectedNodeId: state.returnNodeId, activeView: 'object', returnNodeId: null });
      return;
    }
    if (state.returnView === 'inbox' || state.returnView === 'today' || state.returnView === 'planned') {
      void get().openDaily(localToday());
      return;
    }
    set({
      activeView: state.returnView === 'object' ? 'calendar' : state.returnView,
      selectedNodeId: null,
      returnNodeId: null,
    });
  },

  openType: (typeId) => {
    const type = get().objectTypes.find((item) => item.id === typeId);
    set({ activeView: 'type', activeTypeId: typeId, selectedNodeId: null, dataView: type?.defaultView ?? 'list' });
  },

  openCollection: (collectionId) => set({ activeView: 'collection', activeCollectionId: collectionId, selectedNodeId: null }),

  setDataView: (view) => set({ dataView: view }),

  createTypedObject: async (typeId) => {
    await get().withHistory(async () => {
      const { settings, activeFolderId, activeView } = get();
      if (!settings) return;
      const template = await templateForType(typeId);
      const parentId = activeView === 'folder' && activeFolderId ? activeFolderId : null;
      const node = await createNode({
        workspaceId: settings.workspaceId,
        parentId,
        content: template?.title || i18n.t('object.untitled'),
        title: template?.title || '',
        blocks: template?.blocks?.length ? template.blocks : [emptyBlock()],
        typeId,
        supertagIds: [typeId],
        fieldValues: template ? { [typeId]: template.fieldValues } : undefined,
      });
      await get().refresh();
      set({ selectedNodeId: node.id, activeView: 'object', returnView: get().activeView === 'object' ? get().returnView : activeView });
    });
  },

  saveObjectBody: async (id, title, blocks) => {
    await get().withHistory(async () => {
      await setObjectBody(id, title, blocks);
      await get().refresh();
    });
  },

  changeObjectType: async (id, typeId) => {
    await get().withHistory(async () => {
      await setObjectType(id, typeId);
      await get().refresh();
    });
  },

  setObjectField: async (id, typeId, key, value) => {
    await get().withHistory(async () => {
      await setObjectProperty(id, typeId, key, value);
      await get().refresh();
    });
  },

  addTagToObject: async (id, tagId) => {
    await get().withHistory(async () => {
      await addThemeTag(id, tagId);
      await get().refresh();
    });
  },

  removeTagFromObject: async (id, tagId) => {
    await get().withHistory(async () => {
      await removeThemeTag(id, tagId);
      await get().refresh();
    });
  },

  createAndAddTag: async (id, name) => {
    await get().withHistory(async () => {
      const { settings } = get();
      if (!settings) return;
      const tag = await createThemeTag(settings.workspaceId, name);
      await addThemeTag(id, tag.id);
      await get().refresh();
    });
  },

  setAliases: async (id, aliases) => {
    await get().withHistory(async () => {
      await updateNode(id, { aliases });
      await get().refresh();
    });
  },

  setReviewed: async (id, reviewed) => {
    await get().withHistory(async () => {
      await updateNode(id, { reviewed });
      await get().refresh();
    });
  },

  saveType: async (type) => {
    await saveObjectType(type);
    await get().refresh();
  },

  addType: async (name) => {
    const type = await createObjectType(name);
    await get().refresh();
    return type;
  },

  addCollection: async (name, typeId) => {
    const collection = await createCollection(name, typeId);
    await get().refresh();
    set({ activeView: 'collection', activeCollectionId: collection.id });
  },

  toggleInCollection: async (collectionId, objectId) => {
    await toggleCollectionItem(collectionId, objectId);
    await get().refresh();
  },

  saveTypeTemplate: async (input) => {
    const existing = get().templates.find((template) => template.typeId === input.typeId);
    await saveTemplate({ ...input, id: existing?.id });
    await get().refresh();
  },

  saveNewQuery: async (input) => {
    const query = await saveQuery(input);
    await get().refresh();
    set({ activeView: 'query', activeQueryId: query.id });
  },

  createTag: async (name) => {
    const { settings } = get();
    if (!settings || !name.trim()) return;
    const tag = await createThemeTag(settings.workspaceId, name.trim());
    await get().refresh();
    set({ selectedNodeId: tag.id, activeView: 'object', returnView: get().activeView });
  },

  ensureTag: async (name) => {
    const { settings } = get();
    if (!settings || !name.trim()) return undefined;
    const tag = await createThemeTag(settings.workspaceId, name.trim());
    await get().refresh();
    return tag.id;
  },

  createWeblink: async (url) => {
    const { settings } = get();
    if (!settings || !url.trim()) return undefined;
    const node = await get().withHistory(async () => createWeblinkObject(settings.workspaceId, url.trim()));
    await get().refresh();
    return node.id;
  },

  attachMedia: async (nodeId, typeId, file) => {
    await get().withHistory(async () => {
      const id = await saveMediaFile(file);
      await setObjectProperty(nodeId, typeId, 'src', blobRef(id));
      if (typeId === 'file') await setObjectProperty(nodeId, typeId, 'fileName', file.name);
      await get().refresh();
    });
  },

  setMediaProperty: async (nodeId, typeId, key, file) => {
    await get().withHistory(async () => {
      const id = await saveMediaFile(file);
      await setObjectProperty(nodeId, typeId, key, blobRef(id));
      await get().refresh();
    });
  },

  openDaily: async (date) => {
    const { settings } = get();
    if (!settings) return;
    const note = await ensureDailyNote(settings.workspaceId, date);
    await get().refresh();
    set({ selectedNodeId: note.id, activeView: 'object', returnView: 'calendar', returnNodeId: null });
  },

  createObjectFromLine: async (typeId, title, dueDate) => {
    const { settings, objectTypes } = get();
    if (!settings) return undefined;
    if (typeId === 'tag' || typeId === 'folder' || typeId === 'dailyNote') return undefined;
    const type = objectTypes.find((item) => item.id === typeId);
    if (!type) return undefined;
    const fields = fieldsForLineObject(type, dueDate);
    const trimmed = title.trim();
    const node = await get().withHistory(() =>
      createNode({
        workspaceId: settings.workspaceId,
        parentId: null,
        content: trimmed,
        title: trimmed,
        typeId,
        supertagIds: [typeId],
        fieldValues: { [typeId]: fields },
        blocks: [{ ...emptyBlock(), text: trimmed }],
      }),
    );
    await get().refresh();
    return node.id;
  },
}));

export { BUILTIN_SUPERTAGS };
