import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SW_PATH, hashFiles, listAppFiles, readSwConfig } from '../tools/sw-files.mjs';

const FIX = '→ run `node tools/sw-stamp.mjs`';
const sw = readSwConfig(readFileSync(SW_PATH, 'utf8'));
const appFiles = listAppFiles();

test('sw.js PRECACHE에 모든 앱 파일이 있다', () => {
  const missing = appFiles.filter((f) => !sw.files.includes(f));
  assert.deepEqual(missing, [], `missing from PRECACHE ${FIX}`);
});

test('sw.js PRECACHE의 파일이 모두 실제로 존재한다', () => {
  const stale = sw.files.filter((f) => f !== './' && !existsSync(join(ROOT, f)));
  assert.deepEqual(stale, [], `stale entries in PRECACHE ${FIX}`);
  assert.ok(sw.files.includes('./'), 'PRECACHE must include ./ (navigation)');
});

test('sw.js BUILD가 현재 앱 파일 해시와 같다 (배포 후 캐시 갱신 보장)', () => {
  assert.equal(sw.build, hashFiles(appFiles), `app files changed but BUILD was not updated ${FIX}`);
});

test('index.html이 참조하는 manifest·아이콘이 precache 대상이다', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"#:]+)(?:#[^"]*)?"/g)].map((m) => m[1]);
  assert.ok(refs.includes('manifest.webmanifest'), 'index.html must link the manifest');
  for (const ref of refs) assert.ok(sw.files.includes(ref), `${ref} referenced by index.html is not precached`);

  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) assert.ok(sw.files.includes(icon.src), `${icon.src} is not precached`);
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'manifest needs a maskable icon');
});

test('배포 스크립트가 sw.js·manifest를 포함한다', () => {
  const deploy = readFileSync(join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
  assert.match(deploy, /sw\.js/);
  assert.match(deploy, /manifest\.webmanifest/);
});
