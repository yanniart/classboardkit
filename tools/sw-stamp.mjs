// sw.js의 PRECACHE 목록과 BUILD 해시를 현재 앱 파일 기준으로 갱신한다.
// 앱 파일(index.html, manifest, src/, assets/)을 바꾼 뒤 실행: `.tools/node/node.exe tools/sw-stamp.mjs`
// 잊으면 tests/sw-manifest.test.js가 실패한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { SW_PATH, hashFiles, listAppFiles, readSwConfig, stampSw } from './sw-files.mjs';

const source = readFileSync(SW_PATH, 'utf8');
const files = listAppFiles();
const build = hashFiles(files);
const before = readSwConfig(source);
const next = stampSw(source, files, build);

if (next === source) {
  console.log(`sw.js is up to date (build ${build}, ${files.length} files)`);
} else {
  writeFileSync(SW_PATH, next);
  console.log(`sw.js stamped: build ${before.build} → ${build}, ${files.length} files`);
}
