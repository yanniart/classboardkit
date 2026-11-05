// 배포 URL에서 서비스 워커 설치·precache 확인 (원격 서버는 끌 수 없으므로 오프라인 새로고침은 m3가 로컬에서 검증)
// 사용: E2E_URL=https://<user>.github.io/classboardkit/ node tools/e2e/pwa-remote.mjs
import { APP_URL, launch, sleep } from './harness.mjs';

const b = await launch({ lang: 'en' });
const { evaluate, check, cdp } = b;
await cdp('Page.navigate', { url: APP_URL });
await sleep(2000);

let controlled = false;
for (let i = 0; i < 60 && !controlled; i += 1) {
  controlled = await evaluate(`navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller)`);
  if (!controlled) await sleep(250);
}
check('service worker controls page', controlled, APP_URL);
const scope = await evaluate(`navigator.serviceWorker.getRegistration().then(r => r.scope)`);
check('scope is app root', scope === APP_URL, scope);
const info = await evaluate(`caches.keys().then(async keys => ({ keys, n: (await (await caches.open(keys[0])).keys()).length }))`);
check('precache filled', info.keys.length === 1 && info.n > 60, JSON.stringify(info));
const manifest = await evaluate(`fetch('manifest.webmanifest').then(r => r.json())`);
check('manifest start_url resolves to app', new URL(manifest.start_url, APP_URL).href === APP_URL);
check('English UI', (await evaluate(`document.title`)).startsWith('ClassBoardKit'));
b.finish();
