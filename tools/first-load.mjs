// 첫 로드 때 실제로 요청된 파일의 gzip 합계 (NFR-004, 예산 200KB). 서버(8765) 실행 후 `node tools/first-load.mjs`
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_URL, launch, sleep } from './e2e/harness.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const b = await launch({ lang: 'ko' });
await b.viewport(1440, 900);
await b.cdp('Page.navigate', { url: APP_URL });
await b.ready();
await sleep(1500);
const urls = await b.evaluate(`[location.href, ...performance.getEntriesByType('resource').filter(e => e.initiatorType !== 'fetch' && e.initiatorType !== 'other').map(e => e.name)]`);
const files = [...new Set(urls.map((u) => new URL(u).pathname.split('#')[0]))]
  .map((p) => (p.endsWith('/') ? `${p}index.html` : p))
  .filter((p) => !p.endsWith('sw.js'));
let total = 0;
for (const f of files) total += gzipSync(readFileSync(join(ROOT, f)), { level: 9 }).length;
const lazy = files.filter((f) => /template|share-dialog|share-open|qrcodegen|symbols\.svg/.test(f));
console.log(`files ${files.length}, gzip ${(total / 1024).toFixed(1)} KB, lazy modules loaded: ${lazy.join(',') || 'none'}`);
b.close();
process.exit(0);
