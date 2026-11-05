import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMPORT_SIZE,
  createExport,
  daysSince,
  exportFileName,
  parseImport,
  serializeExport,
  slugify,
} from '../src/core/transfer.js';
import { importBoards } from '../src/core/board-ops.js';
import { SCHEMA_VERSION, createBoard, createDefaultData, validateData, validateSettings } from '../src/core/schema.js';

const T0 = new Date('2026-11-05T09:00:00.000Z');

function sampleBoard(name = '월요일 1교시') {
  const board = createBoard(name, T0);
  board.widgets = [
    { id: 'w_a', type: 'timer', version: 1, x: 0.1, y: 0.1, w: 0.3, h: 0.3, z: 1, state: { durationMs: 300000 } },
    { id: 'w_b', type: 'future-widget', version: 3, x: 0.5, y: 0.5, w: 0.2, h: 0.2, z: 2, state: { foo: 1 } },
  ];
  return board;
}

test('createExport: 형식과 settings 포함 여부', () => {
  const board = sampleBoard();
  const single = createExport([board], { now: T0 });
  assert.equal(single.app, 'classboardkit');
  assert.equal(single.schemaVersion, SCHEMA_VERSION);
  assert.equal(single.exportedAt, T0.toISOString());
  assert.equal('settings' in single, false);
  assert.notEqual(single.boards[0], board, '원본을 복제한다');

  const all = createExport([board], { now: T0, settings: { locale: 'ko' } });
  assert.deepEqual(all.settings, { locale: 'ko' });
});

test('왕복: export → parseImport 내용 동일, ID만 새로 발급', () => {
  const boards = [sampleBoard('A'), sampleBoard('B')];
  const result = parseImport(serializeExport(createExport(boards, { now: T0 })));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.boards.length, 2);
  result.boards.forEach((imported, i) => {
    const original = boards[i];
    assert.notEqual(imported.id, original.id);
    assert.match(imported.id, /^b_/);
    assert.equal(imported.name, original.name);
    assert.deepEqual(imported.background, original.background);
    imported.widgets.forEach((w, j) => {
      assert.notEqual(w.id, original.widgets[j].id);
      assert.match(w.id, /^w_/);
      const { id: _a, ...rest } = w;
      const { id: _b, ...expected } = original.widgets[j];
      assert.deepEqual(rest, expected);
    });
  });
  // 알 수 없는 위젯 타입 보존
  assert.equal(result.boards[0].widgets[1].type, 'future-widget');
});

test('parseImport: 같은 파일 두 번 가져와도 ID가 겹치지 않음', () => {
  const text = serializeExport(createExport([sampleBoard()], { now: T0 }));
  const a = parseImport(text);
  const b = parseImport(text);
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  assert.notEqual(a.boards[0].id, b.boards[0].id);
});

test('parseImport: BOM 허용', () => {
  const text = `﻿${serializeExport(createExport([sampleBoard()], { now: T0 }))}`;
  assert.equal(parseImport(text).ok, true);
});

test('parseImport: 오류 코드', () => {
  const valid = createExport([sampleBoard()], { now: T0 });
  /** @param {unknown} v */
  const code = (v) => {
    const r = parseImport(typeof v === 'string' ? v : JSON.stringify(v));
    return r.ok ? 'ok' : r.error;
  };
  assert.equal(code('{not json'), 'not-json');
  assert.equal(code('null'), 'wrong-app');
  assert.equal(code([1, 2]), 'wrong-app');
  assert.equal(code({ ...valid, app: 'other' }), 'wrong-app');
  assert.equal(code({ ...valid, schemaVersion: SCHEMA_VERSION + 1 }), 'newer-version');
  assert.equal(code({ ...valid, schemaVersion: 0 }), 'invalid');
  assert.equal(code({ ...valid, schemaVersion: '1' }), 'invalid');
  assert.equal(code({ ...valid, boards: 'x' }), 'invalid');
  assert.equal(code({ ...valid, boards: [] }), 'empty');
  assert.equal(code({ ...valid, boards: [{ ...valid.boards[0], name: 3 }] }), 'invalid');
  assert.equal(
    code({ ...valid, boards: [{ ...valid.boards[0], widgets: [{ ...valid.boards[0].widgets[0], x: 2 }] }] }),
    'invalid',
  );
  assert.equal(code(' '.repeat(MAX_IMPORT_SIZE + 1)), 'too-large');
  assert.equal(code({ ...valid, boards: Array(201).fill(valid.boards[0]) }), 'too-large');
});

test('parseImport: 오류 시 상세 정보 포함', () => {
  const r = parseImport(JSON.stringify({ app: 'classboardkit', schemaVersion: 1, boards: [{}] }));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.detail, /boards\[0\]\.id/);
});

test('importBoards: 뒤에 추가하고 첫 가져온 보드 활성화', () => {
  const data = createDefaultData({ boardName: 'Mine', locale: 'en' });
  const state = { boards: data.boards, settings: data.settings };
  const parsed = parseImport(serializeExport(createExport([sampleBoard('X'), sampleBoard('Y')], { now: T0 })));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const next = importBoards(state, parsed.boards);
  assert.deepEqual(next.boards.map((b) => b.name), ['Mine', 'X', 'Y']);
  assert.equal(next.settings.activeBoardId, parsed.boards[0].id);
  assert.equal(validateData({ schemaVersion: SCHEMA_VERSION, ...next }).ok, true);
  assert.equal(importBoards(state, []), state, '빈 목록은 변경 없음');
});

test('slugify: 금지 문자 제거, 한글 허용', () => {
  assert.equal(slugify('월요일 1교시'), '월요일-1교시');
  assert.equal(slugify('A/B:C*D?"E<F>G|H\\I'), 'abcdefghi');
  assert.equal(slugify('  ..hidden..  '), 'hidden');
  assert.equal(slugify('a\u0000b\tc'), 'abc');
  assert.equal(slugify('x'.repeat(80)).length, 50);
  assert.equal(slugify('///'), '');
});

test('exportFileName: 날짜·slug·확장자', () => {
  const now = new Date(2026, 10, 5, 23, 59); // 로컬 2026-11-05
  assert.equal(exportFileName('Math Class', now), 'classboardkit-math-class-20261105.classboardkit.json');
  assert.equal(exportFileName(null, now), 'classboardkit-all-20261105.classboardkit.json');
  assert.equal(exportFileName('???', now), 'classboardkit-board-20261105.classboardkit.json');
});

test('daysSince: 로컬 달력 기준 일수', () => {
  const now = new Date(2026, 10, 5, 8, 0);
  assert.equal(daysSince(undefined, now), null);
  assert.equal(daysSince('nope', now), null);
  assert.equal(daysSince(new Date(2026, 10, 5, 0, 1).toISOString(), now), 0);
  assert.equal(daysSince(new Date(2026, 10, 4, 23, 59).toISOString(), now), 1);
  assert.equal(daysSince(new Date(2026, 9, 6, 12).toISOString(), now), 30);
  assert.equal(daysSince(new Date(2026, 10, 6).toISOString(), now), 0, '미래 값은 0');
});

test('validateSettings: 선택 필드 lastExportAt·keepAwake', () => {
  const base = createDefaultData({ boardName: 'b', locale: 'en' }).settings;
  assert.deepEqual(validateSettings(base), []);
  assert.deepEqual(validateSettings({ ...base, lastExportAt: T0.toISOString(), keepAwake: true }), []);
  assert.equal(validateSettings({ ...base, lastExportAt: 'nope' }).length, 1);
  assert.equal(validateSettings({ ...base, keepAwake: 'yes' }).length, 1);
});
