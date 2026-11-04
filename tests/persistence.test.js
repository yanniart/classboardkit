import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORRUPT_KEY_PREFIX,
  SETTINGS_KEY,
  boardsKey,
  loadData,
  saveData,
  startAutoSave,
} from '../src/core/persistence.js';
import { SCHEMA_VERSION, createDefaultData } from '../src/core/schema.js';
import { createStore } from '../src/core/store.js';
import { createMemoryStorage } from '../src/core/utils/memory-storage.js';

const KEY = boardsKey(SCHEMA_VERSION);
const makeDefault = () => createDefaultData({ boardName: 'Default', locale: 'en' });
const keysOf = (storage) =>
  Array.from({ length: storage.length }, (_, i) => storage.key(i));

test('first run returns default data and flags isFirstRun', () => {
  const { data, issues, isFirstRun } = loadData({
    storage: createMemoryStorage(),
    createDefault: makeDefault,
  });
  assert.equal(isFirstRun, true);
  assert.deepEqual(issues, []);
  assert.equal(data.boards[0].name, 'Default');
});

test('save then load round-trips boards and settings', () => {
  const storage = createMemoryStorage();
  const original = createDefaultData({ boardName: 'Mon', locale: 'ko' });
  original.settings.theme = 'dark';
  assert.equal(saveData(storage, original), null);

  const { data, issues, isFirstRun } = loadData({ storage, createDefault: makeDefault });
  assert.equal(isFirstRun, false);
  assert.deepEqual(issues, []);
  assert.deepEqual(data.boards, original.boards);
  assert.deepEqual(data.settings, original.settings);
});

test('corrupt JSON is backed up, not overwritten, and defaults are returned', () => {
  const storage = createMemoryStorage();
  storage.setItem(KEY, '{not json');
  const now = new Date('2026-11-04T01:02:03.000Z');

  const { data, issues } = loadData({ storage, createDefault: makeDefault, now });
  assert.equal(issues[0].type, 'corrupt');
  assert.equal(data.boards[0].name, 'Default');
  assert.equal(storage.getItem(`${CORRUPT_KEY_PREFIX}${now.toISOString()}`), '{not json');
});

test('structurally invalid data is backed up and reported as invalid', () => {
  const storage = createMemoryStorage();
  storage.setItem(KEY, JSON.stringify([{ id: 'b_1' }]));
  const { issues } = loadData({ storage, createDefault: makeDefault });
  assert.equal(issues[0].type, 'invalid');
  assert.ok(keysOf(storage).some((k) => k.startsWith(CORRUPT_KEY_PREFIX)));
});

test('missing settings are filled with defaults and active board is repaired', () => {
  const storage = createMemoryStorage();
  const saved = createDefaultData({ boardName: 'Mon', locale: 'en' });
  storage.setItem(KEY, JSON.stringify(saved.boards));

  const { data, issues } = loadData({ storage, createDefault: makeDefault });
  assert.deepEqual(issues, []);
  assert.equal(data.boards[0].name, 'Mon');
  assert.equal(data.settings.activeBoardId, saved.boards[0].id);
});

test('settings survive when only the boards key was removed', () => {
  const storage = createMemoryStorage();
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ locale: 'ko', theme: 'contrast', dockCollapsed: true, activeBoardId: 'gone' }),
  );
  const { data, isFirstRun } = loadData({ storage, createDefault: makeDefault });
  assert.equal(isFirstRun, true);
  assert.equal(data.settings.theme, 'contrast');
  assert.equal(data.settings.locale, 'ko');
  assert.equal(data.settings.activeBoardId, data.boards[0].id);
});

test('saveData reports quota errors', () => {
  const storage = createMemoryStorage({ quotaBytes: 50 });
  const issue = saveData(storage, makeDefault());
  assert.equal(issue?.type, 'quota');
});

test('startAutoSave debounces writes and flush writes immediately', async () => {
  const storage = createMemoryStorage();
  const store = createStore({ ...makeDefault() });
  const auto = startAutoSave({ storage, store, wait: 20 });

  store.update((s) => ({ ...s, settings: { ...s.settings, theme: 'dark' } }));
  store.update((s) => ({ ...s, settings: { ...s.settings, theme: 'light' } }));
  assert.equal(storage.getItem(SETTINGS_KEY), null, 'nothing written before the wait');

  await new Promise((r) => setTimeout(r, 40));
  assert.equal(JSON.parse(storage.getItem(SETTINGS_KEY)).theme, 'light');

  store.update((s) => ({ ...s, settings: { ...s.settings, theme: 'contrast' } }));
  auto.flush();
  assert.equal(JSON.parse(storage.getItem(SETTINGS_KEY)).theme, 'contrast');
  auto.stop();
});

test('startAutoSave forwards write issues', async () => {
  const storage = createMemoryStorage({ quotaBytes: 50 });
  const store = createStore(makeDefault());
  const seen = [];
  const auto = startAutoSave({ storage, store, wait: 0, onIssue: (i) => seen.push(i.type) });
  store.update((s) => ({ ...s }));
  auto.flush();
  assert.deepEqual(seen, ['quota']);
  auto.stop();
});
