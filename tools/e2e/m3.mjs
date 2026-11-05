// M3 E2E: 내보내기/가져오기, 전체 화면·화면 켜두기, PWA 오프라인
// 실행: 정적 서버를 띄운 뒤 `node tools/e2e/m3.mjs`
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_URL, OUT_DIR, launch, sleep } from './harness.mjs';

const b = await launch({ lang: 'ko' });
const { evaluate, click, check, shot, viewport, cdp, saved, settings } = b;
const SAVE_WAIT = 650;

const DL_DIR = join(OUT_DIR, 'downloads');
rmSync(DL_DIR, { recursive: true, force: true });
mkdirSync(DL_DIR, { recursive: true });

const openMenu = async () => {
  if (!(await evaluate(`document.querySelector('#board-menu').open`))) await click('#board-menu > summary');
};
const notices = () =>
  evaluate(`[...document.querySelectorAll('.notice')].map(n => ({ key: n.dataset.key, type: n.dataset.type, text: n.querySelector('.notice__text').textContent }))`);
const clearNotices = () => evaluate(`document.querySelectorAll('.notice').forEach(n => n.remove())`);

/** 파일 입력에 로컬 파일을 넣는다 (파일 선택 창 없이 change 이벤트 발생) */
async function importPath(path) {
  const { root } = await cdp('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: '#import-file' });
  await cdp('DOM.setFileInputFiles', { nodeId, files: [path] });
  await sleep(400);
}

/** 다운로드 폴더에 새 파일이 생길 때까지 기다린다 */
async function waitDownload(before) {
  for (let i = 0; i < 40; i += 1) {
    const files = readdirSync(DL_DIR).filter((f) => !before.includes(f) && !f.endsWith('.crdownload'));
    if (files.length > 0) return files[0];
    await sleep(150);
  }
  return null;
}

await viewport(1440, 900);
await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR });
await cdp('Page.navigate', { url: APP_URL });
await sleep(1200);
await b.ready();

// 0. 준비: 위젯 2개 + 보드 이름
await click('.dock__item[data-type="timer"]');
await click('.dock__item[data-type="text"]');
await sleep(SAVE_WAIT);
await evaluate(`(() => {
  const boards = JSON.parse(localStorage.getItem('classboardkit:v1:boards'));
  boards[0].name = '월요일 1교시';
  boards[0].widgets[0] = { ...boards[0].widgets[0], x: 0.05, y: 0.1, w: 0.3, h: 0.4 };
  boards[0].widgets[1] = { ...boards[0].widgets[1], x: 0.4, y: 0.1, w: 0.3, h: 0.4, state: { ...boards[0].widgets[1].state, content: '가져오기 테스트' } };
  localStorage.setItem('classboardkit:v1:boards', JSON.stringify(boards));
})()`);
await cdp('Page.reload');
await sleep(1200);

// 1. 백업 상태: 아직 없음 (강조)
await openMenu();
check('backup status: never (stale style)', await evaluate(`(() => { const el = document.querySelector('#board-backup-status');
  return el.textContent === '아직 백업한 적 없음' && el.classList.contains('board-menu__backup--stale'); })()`));
check('transfer buttons labelled', (await evaluate(`[...document.querySelectorAll('#board-transfer .menu-button')].map(b => b.textContent.trim()).join('|')`)) === '보드 내보내기|전체 내보내기|가져오기');
await shot('m3-board-menu-ko');

// 2. 현재 보드 내보내기
let before = readdirSync(DL_DIR);
await click('#board-transfer [data-action="export"]');
const single = await waitDownload(before);
check('export downloads a file', single !== null, String(single));
check('export file name', /^classboardkit-월요일-1교시-\d{8}\.classboardkit\.json$/.test(single ?? ''), single);
const singleData = single ? JSON.parse(readFileSync(join(DL_DIR, single), 'utf8')) : null;
check('export file content', singleData?.app === 'classboardkit' && singleData.schemaVersion === 1 &&
  singleData.boards.length === 1 && singleData.boards[0].widgets.length === 2 && !('settings' in singleData));
check('export info notice', (await notices()).some((n) => n.key === 'transfer.exported' && n.type === 'info' && n.text.includes(single)));
await sleep(SAVE_WAIT);
check('lastExportAt saved', typeof (await settings()).lastExportAt === 'string');
await openMenu();
check('backup status: today', (await evaluate(`document.querySelector('#board-backup-status').textContent`)) === '마지막 백업: 오늘' &&
  !(await evaluate(`document.querySelector('#board-backup-status').classList.contains('board-menu__backup--stale')`)));

// 3. 전체 내보내기 (settings 포함)
await clearNotices();
before = readdirSync(DL_DIR);
await click('#board-transfer [data-action="exportAll"]');
const all = await waitDownload(before);
const allData = all ? JSON.parse(readFileSync(join(DL_DIR, all), 'utf8')) : null;
check('export all: file name + settings', /^classboardkit-all-\d{8}\.classboardkit\.json$/.test(all ?? '') && allData?.settings?.locale === 'ko', all);

// 4. 가져오기 버튼 → 파일 선택 창 호출 (헤드리스에서는 창을 막고 호출만 확인)
await evaluate(`document.getElementById('import-file').addEventListener('click', (e) => { window.__fileClick = true; e.preventDefault(); }, { once: true })`);
await openMenu();
await click('#board-transfer [data-action="import"]');
check('import button opens file chooser', await evaluate(`window.__fileClick === true`));

// 5. 가져오기: 내보낸 파일 → 보드 추가, 새 ID, 활성화
const beforeBoards = await saved();
await importPath(join(DL_DIR, single));
await sleep(SAVE_WAIT);
const afterBoards = await saved();
check('import adds a board', afterBoards.length === beforeBoards.length + 1, `${beforeBoards.length} → ${afterBoards.length}`);
const imported = afterBoards.at(-1);
check('import keeps name and widgets', imported.name === '월요일 1교시' && imported.widgets.length === 2 &&
  imported.widgets.some((w) => w.state.content === '가져오기 테스트'));
check('import assigns new ids', imported.id !== beforeBoards[0].id &&
  imported.widgets.every((w) => !beforeBoards[0].widgets.some((o) => o.id === w.id)));
check('imported board becomes active', (await settings()).activeBoardId === imported.id);
check('import info notice with count', (await notices()).some((n) => n.key === 'transfer.imported' && n.text === '보드 1개를 가져왔어요.'));
check('imported widgets rendered', (await evaluate(`document.querySelectorAll('.widget').length`)) === 2);

// 6. 알 수 없는 위젯 타입 보존 → 플레이스홀더
const futurePath = join(OUT_DIR, 'm3-future.classboardkit.json');
const future = structuredClone(singleData);
future.boards[0].name = 'Future';
future.boards[0].widgets.push({ id: 'w_future', type: 'hologram', version: 1, x: 0.75, y: 0.1, w: 0.2, h: 0.3, z: 9, state: { a: 1 } });
writeFileSync(futurePath, JSON.stringify(future));
await importPath(futurePath);
await sleep(SAVE_WAIT);
check('unknown widget kept in data', (await saved()).at(-1).widgets.some((w) => w.type === 'hologram'));
check('unknown widget placeholder shown', await evaluate(`!!document.querySelector('.widget[data-type="hologram"]')`));

// 7. 잘못된 파일 → 오류 알림, 보드 수 그대로
const count = (await saved()).length;
const badCases = [
  ['m3-bad-json.json', '{ nope', 'transfer.error.notJson'],
  ['m3-bad-app.json', JSON.stringify({ app: 'other', schemaVersion: 1, boards: [] }), 'transfer.error.wrongApp'],
  ['m3-bad-future.json', JSON.stringify({ ...singleData, schemaVersion: 99 }), 'transfer.error.newerVersion'],
  ['m3-bad-board.json', JSON.stringify({ ...singleData, boards: [{ name: 'x' }] }), 'transfer.error.invalid'],
];
for (const [file, content, keyName] of badCases) {
  await clearNotices();
  const path = join(OUT_DIR, file);
  writeFileSync(path, content);
  await importPath(path);
  const list = await notices();
  check(`bad import → ${keyName}`, list.some((n) => n.key === keyName && n.type === 'error'), JSON.stringify(list));
}
await sleep(SAVE_WAIT);
check('bad imports add no boards', (await saved()).length === count);
await shot('m3-import-error');
await clearNotices();

// 8. 전체 화면·화면 켜두기 버튼
const fsButton = await evaluate(`(() => { const b = document.getElementById('fullscreen-toggle');
  return { hidden: b.hidden, pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), enabled: document.fullscreenEnabled }; })()`);
check('fullscreen button visible when supported', fsButton.enabled ? !fsButton.hidden && fsButton.label === '전체 화면' : fsButton.hidden, JSON.stringify(fsButton));
if (fsButton.enabled) {
  await click('#fullscreen-toggle');
  await sleep(300);
  const on = await evaluate(`({ el: !!document.fullscreenElement, pressed: document.getElementById('fullscreen-toggle').getAttribute('aria-pressed') })`);
  // 헤드리스는 실제 전체 화면을 거부할 수 있다 → 상태와 버튼이 일치하는지만 확인
  check('fullscreen state matches button', String(on.el) === on.pressed, JSON.stringify(on));
  if (on.el) {
    await click('#fullscreen-toggle');
    await sleep(300);
    check('exit fullscreen', (await evaluate(`document.getElementById('fullscreen-toggle').getAttribute('aria-pressed')`)) === 'false');
  }
}
const hasWakeLock = await evaluate(`'wakeLock' in navigator`);
check('keep-awake button visible when supported', (await evaluate(`!document.getElementById('keep-awake-toggle').hidden`)) === hasWakeLock);
if (hasWakeLock) {
  await click('#keep-awake-toggle');
  await sleep(SAVE_WAIT);
  check('keep-awake on (pressed + saved)', (await evaluate(`document.getElementById('keep-awake-toggle').getAttribute('aria-pressed')`)) === 'true' &&
    (await settings()).keepAwake === true);
  await shot('m3-toolbar-awake');
  await clearNotices();
  await click('#keep-awake-toggle');
  await sleep(SAVE_WAIT);
  check('keep-awake off', (await settings()).keepAwake === false);
}

// 9. 영어 문구
await evaluate(`(() => { const s = document.getElementById('setting-locale'); s.value = 'en'; s.dispatchEvent(new Event('change')); })()`);
await sleep(200);
await openMenu();
check('English transfer labels', (await evaluate(`[...document.querySelectorAll('#board-transfer .menu-button')].map(b => b.textContent.trim()).join('|')`)) === 'Export board|Export all|Import');
await shot('m3-board-menu-en');
await click('#board-menu > summary');
await evaluate(`(() => { const s = document.getElementById('setting-locale'); s.value = 'ko'; s.dispatchEvent(new Event('change')); })()`);

// 10. 태블릿: 보드 메뉴가 화면 안에 들어오는지
await viewport(1180, 820, true);
await sleep(200);
await openMenu();
const panel = await evaluate(`(() => { const p = document.querySelector('#board-menu .popover__panel'); const r = p.getBoundingClientRect();
  return { bottom: r.bottom, scroll: p.scrollHeight > p.clientHeight, vh: innerHeight }; })()`);
check('board menu fits tablet viewport', panel.bottom <= panel.vh, JSON.stringify(panel));
await shot('m3-board-menu-tablet');
await click('#board-menu > summary');
await viewport(1440, 900);

// 11. PWA: 서비스 워커 설치 → 오프라인 새로고침
// DevTools 네트워크 에뮬레이션은 서비스 워커의 fetch를 막지 못한다 → 전용 서버를 띄웠다가 실제로 종료한다
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
/** 업데이트 테스트용: 설정되면 /sw.js 대신 이 내용을 보낸다 */
let swOverride = null;
const handler = (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/sw.js' && swOverride) {
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' }).end(swOverride);
    return;
  }
  const file = normalize(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
};
let server = createServer(handler);
await new Promise((r) => server.listen(8766, '127.0.0.1', r));
const PWA_URL = 'http://127.0.0.1:8766/';
await cdp('Page.navigate', { url: PWA_URL });
await sleep(1200);
// 다른 출처라 저장소가 비어 있음 → 위젯 하나 추가
await click('.dock__item[data-type="timer"]');
await sleep(SAVE_WAIT);

const manifestOk = await evaluate(`fetch('manifest.webmanifest').then(r => r.json()).then(m => m.name === 'ClassBoardKit' && m.icons.length >= 3)`);
check('manifest served', manifestOk);
let controlled = false;
for (let i = 0; i < 40 && !controlled; i += 1) {
  controlled = await evaluate(`navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller)`);
  if (!controlled) await sleep(250);
}
check('service worker controls page', controlled);
const cacheInfo = await evaluate(`caches.keys().then(async keys => { const c = await caches.open(keys[0]); return { keys, n: (await c.keys()).length }; })`);
check('precache filled', cacheInfo.keys.length === 1 && /^cbk-v\d+\.\d+\.\d+-[0-9a-f]{8}$/.test(cacheInfo.keys[0]) && cacheInfo.n > 60, JSON.stringify(cacheInfo));

const boardsBeforeOffline = (await saved()).length;
server.closeAllConnections();
await new Promise((r) => server.close(r));
b.errors.length = 0;
await cdp('Page.reload');
await sleep(1500);
check('offline: app boots', await evaluate(`!!document.querySelector('.dock__item') && document.querySelectorAll('.widget').length > 0`));
check('offline: widget styles loaded', await evaluate(`getComputedStyle(document.querySelector('.widget')).position === 'absolute'`));
check('offline: data intact', (await saved()).length === boardsBeforeOffline);
check('offline: network really blocked', await evaluate(`fetch('/__not_cached__?' + Date.now()).then(() => false, () => true)`));
await click('.dock__item[data-type="clock"]');
check('offline: can add widget', await evaluate(`!!document.querySelector('.widget[data-type="clock"]')`));
await shot('m3-offline');
// 오프라인 중 sw.js 업데이트 확인 실패 로그는 정상 동작 → 제외
for (const e of b.errors.filter((x) => /sw\.js|ERR_CONNECTION_REFUSED|__not_cached__/.test(x))) b.errors.splice(b.errors.indexOf(e), 1);

// 12. 새 버전 배포 → 알림 → 새로고침 → 옛 캐시 삭제
server = createServer(handler);
await new Promise((r) => server.listen(8766, '127.0.0.1', r));
const oldCache = cacheInfo.keys[0];
swOverride = readFileSync(join(ROOT, 'sw.js'), 'utf8').replace(/const BUILD = '[0-9a-f]*';/, "const BUILD = 'e2e00000';");
await evaluate(`navigator.serviceWorker.getRegistration().then(r => r.update())`);
let updateNotice = null;
for (let i = 0; i < 40 && !updateNotice; i += 1) {
  updateNotice = (await notices()).find((n) => n.key === 'update.available') ?? null;
  if (!updateNotice) await sleep(250);
}
check('update notice shown (info + reload button)', updateNotice?.type === 'info' &&
  (await evaluate(`document.querySelector('.notice[data-key="update.available"] .notice__action')?.textContent`)) === '새로고침');
await shot('m3-update-notice');
await evaluate(`window.__beforeUpdate = true`);
await click('.notice[data-key="update.available"] .notice__action');
await sleep(2000);
check('page reloaded after update', await evaluate(`window.__beforeUpdate !== true`));
const keysAfter = await evaluate(`caches.keys()`);
check('old cache removed, new cache active', keysAfter.length === 1 && /^cbk-v\d+\.\d+\.\d+-e2e00000$/.test(keysAfter[0]) && keysAfter[0] !== oldCache, JSON.stringify(keysAfter));
check('data survives update', (await saved())[0].widgets.some((w) => w.type === 'clock'));
server.closeAllConnections();
await new Promise((r) => server.close(r));

// 정리
for (const f of ['m3-future.classboardkit.json', ...badCases.map((c) => c[0])]) {
  const p = join(OUT_DIR, f);
  if (existsSync(p)) rmSync(p);
}
b.finish();
