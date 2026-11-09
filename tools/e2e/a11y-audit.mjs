// 접근성 진단 (M6 3-0): 점검 상태마다 axe + 접근성 트리 결과를 표로 출력하고 JSON으로 저장
// 실행: 서버(8765) 실행 후 `node tools/e2e/a11y-audit.mjs` → tools/e2e/out/a11y-audit.json
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_URL, OUT_DIR, launch, sleep } from './harness.mjs';
import { AXE_AVAILABLE, axe, axTree, severe, summarize } from './a11y.mjs';
import { auditStates } from './a11y-states.mjs';

if (!AXE_AVAILABLE) console.log('WARN: .tools/axe/axe.min.js 없음 → 접근성 트리 검사만');

const b = await launch({ lang: 'ko' });
await b.viewport(1440, 900);
await b.cdp('Page.navigate', { url: APP_URL });
await b.ready();

const rows = [];
for await (const { name, include } of auditStates(b)) {
  const violations = await axe(b, include ? { include } : {});
  const tree = await axTree(b);
  rows.push({ name, severe: severe(violations).length, total: violations?.length ?? null, unnamed: tree.unnamed.length, violations, unnamedList: tree.unnamed });
  await sleep(50);
}

writeFileSync(join(OUT_DIR, 'a11y-audit.json'), JSON.stringify(rows, null, 2));
console.log('state | critical+serious | all | unnamed');
for (const r of rows) {
  console.log(`${r.name} | ${r.severe} | ${r.total} | ${r.unnamed}`);
  if (r.total) console.log(`   ${summarize(r.violations)}`);
}
console.log(`\nconsole errors: ${b.errors.length ? b.errors.join(' | ') : 'none'}`);
b.close();
process.exit(0);
