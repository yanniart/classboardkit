// Lighthouse JSON 결과 요약: 카테고리 점수와 통과하지 못한 감사 항목을 출력한다.
// 사용: node tools/lh-summary.mjs tools/e2e/out/lh-desktop.json
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const [id, cat] of Object.entries(report.categories)) {
  console.log(`${id}: ${Math.round(cat.score * 100)}`);
  for (const ref of cat.auditRefs) {
    const audit = report.audits[ref.id];
    if (ref.weight > 0 && audit.score !== null && audit.score < 0.9) {
      console.log(`  - ${ref.id} (${audit.score}) ${audit.displayValue ?? ''} — ${audit.title}`);
    }
  }
}
const m = report.audits;
console.log(`FCP ${m['first-contentful-paint']?.displayValue}, LCP ${m['largest-contentful-paint']?.displayValue}, TBT ${m['total-blocking-time']?.displayValue}, CLS ${m['cumulative-layout-shift']?.displayValue}`);
