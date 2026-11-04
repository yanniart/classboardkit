import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,
  createBoard,
  createDefaultData,
  migrate,
  validateData,
  validateWidget,
} from '../src/core/schema.js';

const validWidget = () => ({
  id: 'w_1',
  type: 'timer',
  version: 1,
  x: 0.1,
  y: 0.1,
  w: 0.25,
  h: 0.3,
  z: 1,
  state: {},
});

test('createDefaultData produces valid data with an active board', () => {
  const data = createDefaultData({ boardName: 'My board', locale: 'ko' });
  assert.equal(data.schemaVersion, SCHEMA_VERSION);
  assert.equal(data.boards.length, 1);
  assert.equal(data.settings.activeBoardId, data.boards[0].id);
  assert.equal(data.settings.locale, 'ko');
  assert.deepEqual(validateData(data), { ok: true, errors: [] });
});

test('createBoard uses the given time and a "b_" id', () => {
  const now = new Date('2026-11-04T00:00:00.000Z');
  const board = createBoard('Mon', now);
  assert.match(board.id, /^b_[0-9a-z]{8}$/);
  assert.equal(board.createdAt, now.toISOString());
  assert.equal(board.updatedAt, now.toISOString());
});

test('validateWidget accepts a valid widget', () => {
  assert.deepEqual(validateWidget(validWidget(), 'w'), []);
});

test('validateWidget rejects out-of-range ratios and bad fields', () => {
  const errors = validateWidget({ ...validWidget(), x: 1.5, version: 0, state: null }, 'w');
  assert.ok(errors.some((e) => e.startsWith('w.x')));
  assert.ok(errors.some((e) => e.startsWith('w.version')));
  assert.ok(errors.some((e) => e.startsWith('w.state')));
});

test('validateData reports nested widget errors with a path', () => {
  const data = createDefaultData({ boardName: 'B', locale: 'en' });
  data.boards[0].widgets.push({ ...validWidget(), y: -0.1 });
  const result = validateData(data);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('boards[0].widgets[0].y: must be a number between 0 and 1'));
});

test('validateData rejects duplicate board ids', () => {
  const data = createDefaultData({ boardName: 'B', locale: 'en' });
  data.boards.push({ ...data.boards[0] });
  assert.ok(validateData(data).errors.includes('boards: duplicate board ids'));
});

test('validateData rejects an unknown theme and wrong schema version', () => {
  const data = createDefaultData({ boardName: 'B', locale: 'en' });
  data.settings.theme = 'neon';
  data.schemaVersion = 99;
  const { errors } = validateData(data);
  assert.ok(errors.some((e) => e.startsWith('settings.theme')));
  assert.ok(errors.some((e) => e.startsWith('schemaVersion')));
});

test('migrate returns an equal copy when already current', () => {
  const data = createDefaultData({ boardName: 'B', locale: 'en' });
  const out = migrate(data);
  assert.deepEqual(out, data);
  assert.notEqual(out, data);
});

test('migrate applies steps in order without mutating the input', () => {
  const table = {
    1: (d) => ({ ...d, steps: ['1to2'] }),
    2: (d) => ({ ...d, steps: [...d.steps, '2to3'] }),
  };
  const input = { schemaVersion: 1 };
  const out = migrate(input, table, 3);
  assert.deepEqual(out, { schemaVersion: 3, steps: ['1to2', '2to3'] });
  assert.deepEqual(input, { schemaVersion: 1 });
});

test('migrate throws for newer data and missing steps', () => {
  assert.throws(() => migrate({ schemaVersion: SCHEMA_VERSION + 1 }), /newer/);
  assert.throws(() => migrate({ schemaVersion: 1 }, {}, 2), /missing migration from v1/);
  assert.throws(() => migrate({}), /schemaVersion/);
});
