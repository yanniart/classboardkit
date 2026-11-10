// v1 공개 계약 (ADR-0011): 위젯이 import해도 되는 모듈을 강제한다.
// 공개 모듈은 v1 동안 하위 호환을 지키고, 내부 모듈은 내장 위젯만 예외로 쓴다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WIDGETS = join(ROOT, 'src', 'widgets');

/** 위젯이 쓸 수 있는 공개 모듈 (src 기준 경로) */
export const PUBLIC_MODULES = [
  'core/registry.js', // 타입 전용 (JSDoc WidgetDefinition·WidgetContext)
  'ui/dom.js',
  'widgets/shared/ui.js',
  'widgets/shared/list.js',
  'core/utils/random.js',
];

/** 내부 모듈 — 아래 내장 위젯만 예외 (새 위젯은 쓰지 말 것, v1 계약 밖이라 바뀔 수 있음) */
const INTERNAL_EXCEPTIONS = {
  timer: ['core/utils/sound.js'],
  draw: ['ui/dialog.js'],
  image: ['ui/idb-assets.js', 'core/assets.js'],
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.js') ? [path] : [];
  });
}

test('widgets import only their own files, shared public modules, or listed exceptions', () => {
  const problems = [];
  for (const file of walk(WIDGETS)) {
    const rel = relative(WIDGETS, file).replaceAll('\\', '/');
    const [folder] = rel.split('/');
    if (rel === 'index.js' || folder === 'shared') continue; // 등록 파일·공용 모듈 자체
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] ?? m[2];
      if (!spec.startsWith('.')) {
        problems.push(`${rel}: bare import "${spec}" (no runtime dependencies)`);
        continue;
      }
      const target = relative(join(ROOT, 'src'), resolve(dirname(file), spec)).replaceAll('\\', '/');
      if (target.startsWith(`widgets/${folder}/`)) continue;
      if (PUBLIC_MODULES.includes(target)) continue;
      if (INTERNAL_EXCEPTIONS[folder]?.includes(target)) continue;
      problems.push(`${rel}: imports internal module ${target}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('public modules exist', () => {
  for (const m of PUBLIC_MODULES) assert.ok(statSync(join(ROOT, 'src', m)).isFile(), m);
});
