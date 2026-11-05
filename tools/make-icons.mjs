// PWA 아이콘 PNG 생성: 헤드리스 Edge로 SVG를 렌더링해 캡처한다 (빌드 도구 없이).
// 사용: 정적 서버(8765) 실행 후 `.tools/node/node.exe tools/make-icons.mjs`
// 아이콘 SVG를 바꾸면 다시 실행하고, 결과 PNG를 커밋한다.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_URL, launch, sleep } from './e2e/harness.mjs';

const ICON_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icons');

/** [원본 SVG, 출력 PNG, 크기, 투명 배경 여부] */
const TARGETS = [
  ['icon.svg', 'icon-192.png', 192, true],
  ['icon.svg', 'icon-512.png', 512, true],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512, false],
  // iOS는 투명 영역을 검게 칠하고 모서리를 직접 둥글린다 → 꽉 찬 마스커블 버전 사용
  ['icon-maskable.svg', 'apple-touch-icon.png', 180, false],
];

const app = await launch();
const { cdp } = app;

for (const [source, output, size, transparent] of TARGETS) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await cdp('Emulation.setDefaultBackgroundColorOverride', transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
  await cdp('Page.navigate', { url: new URL(`assets/icons/${source}`, APP_URL).href });
  await sleep(500);
  const { data } = await cdp('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
  });
  writeFileSync(join(ICON_DIR, output), Buffer.from(data, 'base64'));
  app.check(`${output} (${size}px)`, true);
}

// SVG 문서를 직접 열면 브라우저가 /favicon.ico를 요청한다 → 무관한 404는 제외
const unrelated = app.errors.filter((e) => e.includes('favicon.ico'));
for (const e of unrelated) app.errors.splice(app.errors.indexOf(e), 1);
app.finish();
