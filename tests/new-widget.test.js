// tools/new-widget.mjs — 임시 폴더에 src/를 복사해 생성하고, 결과가 계약·번역 검사·자체 테스트를 통과하는지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createWidget, IMPORT_MARKER, LIST_MARKER } from '../tools/new-widget.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'cbk-new-widget-'));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  cpSync(join(ROOT, 'tools', 'i18n-lint.mjs'), join(dir, 'tools', 'i18n-lint.mjs'));
  return dir;
}
const quiet = () => {};

test('real src/widgets/index.js has the generator markers', () => {
  const src = readFileSync(join(ROOT, 'src', 'widgets', 'index.js'), 'utf8');
  assert.ok(src.includes(IMPORT_MARKER) && src.includes(LIST_MARKER));
});

test('generates a widget that registers, passes the contract, i18n lint and its own tests', async () => {
  const dir = sandbox();
  try {
    const { created } = createWidget({ root: dir, type: 'exit-ticket', title: 'Exit ticket', stamp: false, log: quiet });
    assert.deepEqual(created, [
      'src/widgets/exit-ticket/index.js',
      'src/widgets/exit-ticket/exit-ticket-logic.js',
      'src/widgets/exit-ticket/exit-ticket.css',
      'tests/exit-ticket.test.js',
    ]);
    const url = (p) => pathToFileURL(join(dir, p)).href;
    const { BUILT_IN_WIDGETS, createDefaultRegistry } = await import(url('src/widgets/index.js'));
    const registry = createDefaultRegistry(); // validateWidgetDefinition + 중복 검사
    assert.equal(BUILT_IN_WIDGETS.at(-1).type, 'exit-ticket', 'added at the end of the dock');
    assert.ok(registry.get('exit-ticket'));

    const { messages } = await import(url('src/locales/index.js'));
    const { lintLocales } = await import(url('tools/i18n-lint.mjs'));
    const { errors, warnings } = lintLocales(messages, 'en');
    assert.deepEqual(errors, []);
    assert.ok(warnings.some((w) => w.key === 'widget.exit-ticket.title' && w.locale === 'ja'), 'untranslated texts are flagged');

    // 생성된 테스트 파일이 그대로 통과
    const run = spawnSync(process.execPath, ['--test', join(dir, 'tests', 'exit-ticket.test.js')], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects bad names, existing types and dry-run writes nothing', () => {
  const dir = sandbox();
  try {
    for (const bad of ['Timer', '1st', 'my_widget', 'a b', '']) {
      assert.throws(() => createWidget({ root: dir, type: bad, stamp: false, log: quiet }), /valid type/);
    }
    assert.throws(() => createWidget({ root: dir, type: 'timer', stamp: false, log: quiet }), /already exists/);
    const before = readFileSync(join(dir, 'src', 'widgets', 'index.js'), 'utf8');
    createWidget({ root: dir, type: 'poll', dryRun: true, stamp: false, log: quiet });
    assert.equal(existsSync(join(dir, 'src', 'widgets', 'poll')), false);
    assert.equal(readFileSync(join(dir, 'src', 'widgets', 'index.js'), 'utf8'), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
