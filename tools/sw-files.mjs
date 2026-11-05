// 서비스 워커 precache 목록·빌드 해시 계산 (sw-stamp.mjs와 tests/sw-manifest.test.js가 공유).
// 빌드 도구가 없으므로 sw.js 안의 목록을 이 규칙으로 생성·검증한다.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SW_PATH = join(ROOT, 'sw.js');

/** 루트의 앱 파일 (배포 대상과 같아야 함 — .github/workflows/deploy.yml) */
const ROOT_FILES = ['index.html', 'manifest.webmanifest'];
/** 하위 폴더 전체를 precache */
const ROOT_DIRS = ['src', 'assets'];

const BINARY = /\.(png|ico|jpe?g|webp|woff2?)$/i;

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (!entry.name.startsWith('.')) files.push(full);
  }
  return files;
}

/** precache할 앱 파일 (ROOT 기준 상대 경로, '/' 구분, 정렬) */
export function listAppFiles() {
  const files = [
    ...ROOT_FILES.map((f) => join(ROOT, f)),
    ...ROOT_DIRS.flatMap((d) => walk(join(ROOT, d))),
  ];
  return files.map((f) => relative(ROOT, f).split(sep).join('/')).sort();
}

/**
 * 앱 파일 전체의 해시 (8자리). 파일이 하나라도 바뀌면 달라진다.
 * 텍스트 파일은 줄바꿈을 LF로 맞춰 OS와 무관하게 같은 값을 낸다.
 * @param {string[]} files
 */
export function hashFiles(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    let content = readFileSync(join(ROOT, file));
    if (!BINARY.test(file)) content = Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'));
    hash.update(file).update('\0').update(content).update('\0');
  }
  return hash.digest('hex').slice(0, 8);
}

/**
 * sw.js에서 BUILD 값과 PRECACHE 목록을 읽는다.
 * @param {string} source
 */
export function readSwConfig(source) {
  const build = source.match(/const BUILD = '([0-9a-f]*)';/)?.[1] ?? null;
  const block = source.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] ?? '';
  const files = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return { build, files };
}

/**
 * sw.js의 BUILD·PRECACHE를 새 값으로 바꾼 소스를 반환한다.
 * @param {string} source
 * @param {string[]} files
 * @param {string} build
 */
export function stampSw(source, files, build) {
  const list = ["'./'", ...files.map((f) => `'${f}'`)].map((s) => `  ${s},`).join('\n');
  return source
    .replace(/const BUILD = '[0-9a-f]*';/, `const BUILD = '${build}';`)
    .replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = [\n${list}\n];`);
}
