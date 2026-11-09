// M4 E2E: 위젯 확장 (주사위·카운트다운·그리기·이미지·배경·소음·QR) + 이미지 포함 내보내기/가져오기
// 실행: 정적 서버를 띄운 뒤 `node tools/e2e/m4.mjs`
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_URL, OUT_DIR, launch, sleep } from './harness.mjs';
import { makePng } from './png.mjs';

const b = await launch({
  lang: 'ko',
  // 소음 측정기: 가짜 마이크 + 권한 창 자동 허용
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const { evaluate, click, check, shot, viewport, cdp, saved, type } = b;
const SAVE_WAIT = 650;
const W = (t) => `.widget[data-type="${t}"]`;
const widget = async (t) => (await saved()).flatMap((bd) => bd.widgets).find((w) => w.type === t);

const { ready } = b;

/** 위젯 배치를 저장 데이터에서 직접 정한 뒤 새로고침 */
async function layout(map) {
  await sleep(SAVE_WAIT);
  await evaluate(`(() => {
    const L = ${JSON.stringify(map)};
    const boards = JSON.parse(localStorage.getItem('classboardkit:v1:boards'));
    for (const bd of boards) bd.widgets = bd.widgets.map(w => L[w.type] ? { ...w, x: L[w.type][0], y: L[w.type][1], w: L[w.type][2], h: L[w.type][3] } : w);
    localStorage.setItem('classboardkit:v1:boards', JSON.stringify(boards));
  })()`);
  await cdp('Page.reload');
  await ready();
}

/** 해당 타입 위젯을 모두 지운다 (저장 데이터) */
async function clearWidgets() {
  await sleep(SAVE_WAIT);
  await evaluate(`(() => {
    const boards = JSON.parse(localStorage.getItem('classboardkit:v1:boards'));
    for (const bd of boards) bd.widgets = [];
    localStorage.setItem('classboardkit:v1:boards', JSON.stringify(boards));
  })()`);
  await cdp('Page.reload');
  await ready();
}

await viewport(1440, 900);
await cdp('Page.navigate', { url: APP_URL });
await ready();

// ── 1. 독 순서 ──
const EXPECTED_DOCK = (process.env.M4_DOCK ?? 'timer,stopwatch,clock,countdown,randomizer,dice,groups,scoreboard,traffic,symbols,noise,text,draw,image,qr').split(',');
const dockTypes = await evaluate(`[...document.querySelectorAll('.dock__item')].map(b => b.dataset.type)`);
check(`dock lists ${EXPECTED_DOCK.length} widgets in order`, dockTypes.join(',') === EXPECTED_DOCK.join(','), dockTypes.join(','));

// 768px 폭: 독이 넘치면 끝 fade, 마지막 항목까지 스크롤해서 추가 가능
await viewport(768, 1024, true);
await sleep(300);
const dockState = await evaluate(`(() => { const i = document.querySelector('.dock__items');
  return { overflow: i.scrollWidth > i.clientWidth, end: i.classList.contains('has-more-end'), start: i.classList.contains('has-more-start'),
    inView: (() => { const d = i.getBoundingClientRect(); return d.left >= 0 && d.right <= innerWidth; })() }; })()`);
check('768px: dock fits viewport, fade at end when overflowing', dockState.inView && (!dockState.overflow || (dockState.end && !dockState.start)), JSON.stringify(dockState));
const last = EXPECTED_DOCK[EXPECTED_DOCK.length - 1];
await click(`.dock__item[data-type="${last}"]`);
await sleep(300);
const afterScroll = await evaluate(`(() => { const i = document.querySelector('.dock__items'); return { start: i.classList.contains('has-more-start'), end: i.classList.contains('has-more-end') }; })()`);
check('768px: last dock item reachable (scrolled, fade at start)', dockState.overflow ? afterScroll.start && !afterScroll.end : true, JSON.stringify(afterScroll));
await sleep(SAVE_WAIT);
check('768px: last dock item added', (await saved())[0].widgets.some((w) => w.type === last));
await shot('m4-dock-768');
await viewport(1440, 900);
await clearWidgets();

// ── 2. 주사위 ──
await click('.dock__item[data-type="dice"]');
await click('.dock__item[data-type="countdown"]');
await layout({ dice: [0.03, 0.1, 0.3, 0.4], countdown: [0.36, 0.1, 0.3, 0.36] });
check('dice: placeholder faces before first roll', (await evaluate(`document.querySelectorAll('${W('dice')} .dice__tray.is-placeholder .dice__face').length`)) === 2);
await click(`${W('dice')} .widget__settings`);
await click(`${W('dice')} .w-panel .w-stepper .w-btn:last-child`); // 2 → 3
await click(`${W('dice')} .w-panel__header .w-btn`);
await sleep(SAVE_WAIT);
check('dice: count 3 saved', (await widget('dice')).state.count === 3);
let diceOk = true;
for (let i = 0; i < 5; i += 1) {
  await click(i % 2 ? `${W('dice')} .dice__tray` : `${W('dice')} .w-btn--primary`);
  await sleep(750); // 연출 600ms
  const st = (await widget('dice')).state;
  const shown = await evaluate(`[...document.querySelectorAll('${W('dice')} .dice__face')].map(f => Number(f.dataset.value))`);
  const sum = await evaluate(`document.querySelector('${W('dice')} .dice__sum').textContent`);
  const total = st.values.reduce((a, c) => a + c, 0);
  if (st.values.length !== 3 || !st.values.every((v) => v >= 1 && v <= 6) || shown.join() !== st.values.join() || !sum.includes(String(total))) {
    diceOk = false;
    console.log('dice mismatch', st.values, shown, sum);
  }
}
check('dice: 5 rolls → 3 values in 1..6, faces & total match saved state', diceOk);
const pipSize = await evaluate(`document.querySelector('${W('dice')} .dice__face').getBoundingClientRect().width`);
check('dice: faces readable at default size (≥ 48px)', pipSize >= 48, String(pipSize));

// ── 3. 카운트다운 ──
const tomorrow = await evaluate(`(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()`);
check('countdown: default target tomorrow 09:00', (await widget('countdown')).state.target === `${tomorrow}T09:00`);
check('countdown: D-1 badge', (await evaluate(`document.querySelector('${W('countdown')} .countdown__badge').textContent`)) === 'D-1');
await click(`${W('countdown')} .widget__settings`);
await click(`${W('countdown')} .w-panel input[type="text"]`);
await type('체험학습');
await evaluate(`(() => { const i = document.querySelector('${W('countdown')} .w-panel input[type="date"]'); i.value = '2020-03-02'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await click(`${W('countdown')} .w-panel__header .w-btn`);
await sleep(SAVE_WAIT);
const cd = (await widget('countdown')).state;
check('countdown: title & past date saved', cd.title === '체험학습' && cd.target === '2020-03-02T09:00', JSON.stringify(cd));
check('countdown: past → "지났어요" + D+ badge', (await evaluate(`document.querySelector('${W('countdown')} .countdown__status').textContent`)) === '지났어요' &&
  (await evaluate(`document.querySelector('${W('countdown')} .countdown__badge').textContent`)).startsWith('D+'));
await shot('m4-dice-countdown');

// ── 4. 그리기 ──
await clearWidgets();
await click('.dock__item[data-type="draw"]');
await layout({ draw: [0.05, 0.1, 0.45, 0.6] });
const stage = await b.rect(`${W('draw')} .draw__canvas`);
/** 캔버스 위 비율 좌표로 마우스 획 */
async function mouseStroke(points) {
  const at = ([fx, fy]) => [stage.x - stage.w / 2 + fx * stage.w, stage.y - stage.h / 2 + fy * stage.h];
  const [x0, y0] = at(points[0]);
  await b.mouse('mouseMoved', x0, y0);
  await b.mouse('mousePressed', x0, y0, { clickCount: 1, buttons: 1 });
  for (const p of points.slice(1)) {
    const [x, y] = at(p);
    await b.mouse('mouseMoved', x, y, { buttons: 1 });
  }
  const [x1, y1] = at(points[points.length - 1]);
  await b.mouse('mouseReleased', x1, y1, { clickCount: 1 });
  await sleep(150);
}
async function touchStroke(points) {
  const at = ([fx, fy]) => ({ x: stage.x - stage.w / 2 + fx * stage.w, y: stage.y - stage.h / 2 + fy * stage.h });
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(points[0])] });
  for (const p of points.slice(1)) await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(p)] });
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
}
/** 캔버스에서 색이 칠해진 픽셀 수 (영역 비율 좌표 주변) */
const inkAt = (fx, fy) => evaluate(`(() => {
  const c = document.querySelector('${W('draw')} .draw__canvas'); const g = c.getContext('2d');
  const x = Math.round(${fx} * c.width), y = Math.round(${fy} * c.height);
  const d = g.getImageData(x - 4, y - 4, 9, 9).data; let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n += 1; return n; })()`);

check('draw: hint shown when empty', await evaluate(`!document.querySelector('${W('draw')} .draw__hint').hidden`));
// 마우스 획 (빨강): 펜 → 팔레트 → 빨강
await click(`${W('draw')} .draw__pen`);
check('draw: palette opens', await evaluate(`!document.querySelector('${W('draw')} .draw__palette').hidden`));
await click(`${W('draw')} .draw__swatch[data-color="red"]`);
await mouseStroke([[0.1, 0.2], [0.2, 0.25], [0.3, 0.3], [0.4, 0.3], [0.5, 0.3], [0.6, 0.35]]);
// 터치 획 (기본색, 굵게)
await click(`${W('draw')} .draw__pen`);
await click(`${W('draw')} .draw__width[data-width="l"]`);
await click(`${W('draw')} .draw__swatch[data-color="ink"]`);
await touchStroke([[0.2, 0.7], [0.3, 0.72], [0.4, 0.74], [0.5, 0.76], [0.6, 0.78], [0.7, 0.8]]);
await sleep(SAVE_WAIT);
let dr = (await widget('draw')).state;
check('draw: mouse + touch → 2 strokes saved', dr.strokes.length === 2 && dr.strokes[0].c === 'red' && dr.strokes[1].w === 'l', JSON.stringify(dr.strokes.map((s) => [s.c, s.w, s.p.length])));
check('draw: points are ints 0..10000, collinear points simplified', dr.strokes.every((s) => s.p.every((v) => Number.isInteger(v) && v >= 0 && v <= 10000)) && dr.strokes[1].p.length === 4,
  JSON.stringify(dr.strokes[1].p));
check('draw: aspect saved', typeof dr.aspect === 'number' && Math.abs(dr.aspect - stage.w / stage.h) < 0.01, `${dr.aspect} vs ${stage.w / stage.h}`);
check('draw: did not move widget', (await widget('draw')).x === 0.05);
await shot('m4-draw');

await cdp('Page.reload');
await ready();
check('draw: after reload, ink pixels on both strokes', (await inkAt(0.35, 0.3)) > 0 && (await inkAt(0.45, 0.75)) > 0);
check('draw: empty area stays clear', (await inkAt(0.9, 0.1)) === 0);

// 지우개: 터치 획 위를 지움
await click(`${W('draw')} .draw__toolbar .w-btn:nth-child(2)`);
await mouseStroke([[0.4, 0.6], [0.4, 0.74], [0.4, 0.9]]);
await sleep(SAVE_WAIT);
dr = (await widget('draw')).state;
check('draw: eraser stroke saved as e:true', dr.strokes.length === 3 && dr.strokes[2].e === true);
check('draw: erased pixels', (await inkAt(0.4, 0.74)) === 0 && (await inkAt(0.6, 0.78)) > 0);

// 취소
await click(`${W('draw')} .draw__toolbar .w-btn:nth-child(3)`);
await sleep(SAVE_WAIT);
check('draw: undo removes last stroke', (await widget('draw')).state.strokes.length === 2);

// 크기 변경 → 비율 유지 (늘어나지 않음)
await layout({ draw: [0.05, 0.1, 0.8, 0.6] });
const paper = await evaluate(`(() => { const p = document.querySelector('${W('draw')} .draw__paper').getBoundingClientRect(); return p.width / p.height; })()`);
check('draw: wider widget keeps drawing aspect (contain)', Math.abs(paper - dr.aspect) < 0.02, `${paper} vs ${dr.aspect}`);

// 모두 지우기: 취소 → 유지, 확인 → 비움
await click(`${W('draw')} .draw__toolbar .w-btn:nth-child(4)`);
await click('.dialog .button:not(.button--danger)');
await sleep(SAVE_WAIT);
check('draw: clear cancelled keeps strokes', (await widget('draw')).state.strokes.length === 2);
await click(`${W('draw')} .draw__toolbar .w-btn:nth-child(4)`);
await click('.dialog .button--danger');
await sleep(SAVE_WAIT);
dr = (await widget('draw')).state;
check('draw: clear confirmed empties', dr.strokes.length === 0 && dr.aspect === null);

// ── 5. 이미지 위젯 (IndexedDB) ──
const IMG_DIR = join(OUT_DIR, 'images');
mkdirSync(IMG_DIR, { recursive: true });
const PNG_A = join(IMG_DIR, 'blue.png');
const PNG_B = join(IMG_DIR, 'orange-stripes.png');
const PNG_BIG = join(IMG_DIR, 'wide.png');
const PNG_BAD = join(IMG_DIR, 'broken.png');
writeFileSync(PNG_A, makePng(320, 200, () => [40, 110, 220]));
writeFileSync(PNG_B, makePng(400, 300, (x, y) => (Math.floor(y / 30) % 2 ? [250, 160, 40] : [255, 240, 200])));
writeFileSync(PNG_BIG, makePng(3000, 150, (x) => [x % 256, 80, 160]));
writeFileSync(PNG_BAD, Buffer.from('this is not a png'));

/** 파일 입력에 로컬 파일 넣기 */
async function setFile(selector, path) {
  const { root } = await cdp('DOM.getDocument', { depth: -1, pierce: false });
  const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector });
  await cdp('DOM.setFileInputFiles', { nodeId, files: [path] });
  await sleep(900);
}
/** IndexedDB 이미지 레코드 요약 */
const idbAssets = () => evaluate(`new Promise((resolve) => {
  const req = indexedDB.open('classboardkit');
  req.onsuccess = () => { const db = req.result;
    if (!db.objectStoreNames.contains('assets')) { resolve([]); return; }
    const all = db.transaction('assets').objectStore('assets').getAll();
    all.onsuccess = () => resolve(all.result.map(r => ({ id: r.id, type: r.type, width: r.width, height: r.height, tone: r.tone, size: r.blob.size, createdAt: r.createdAt }))); };
  req.onerror = () => resolve(null); })`);
/** 모든 레코드의 createdAt을 오래전으로 (GC 유예 10분 우회) */
const ageAssets = () => evaluate(`new Promise((resolve) => {
  const req = indexedDB.open('classboardkit');
  req.onsuccess = () => { const tx = req.result.transaction('assets', 'readwrite'); const os = tx.objectStore('assets');
    os.getAll().onsuccess = (e) => { for (const r of e.target.result) os.put({ ...r, createdAt: '2020-01-01T00:00:00.000Z' }); };
    tx.oncomplete = () => resolve(true); }; })`);

await clearWidgets();
await click('.dock__item[data-type="image"]');
await layout({ image: [0.05, 0.1, 0.4, 0.5] });
check('image: empty state with choose button', await evaluate(`!document.querySelector('${W('image')} .image__empty').hidden && !!document.querySelector('${W('image')} .image__empty .w-btn')`));
await setFile(`${W('image')} .image__file`, PNG_A);
await sleep(SAVE_WAIT);
const imgState = (await widget('image')).state;
check('image: assetId saved (content hash id)', /^a_[0-9a-f]{16}$/.test(imgState.assetId ?? ''), JSON.stringify(imgState));
check('image: displayed from blob URL', await evaluate(`(() => { const i = document.querySelector('${W('image')} .image__img'); return !i.hidden && i.src.startsWith('blob:') && i.complete && i.naturalWidth === 320; })()`));
let recs = await idbAssets();
check('image: stored once in IndexedDB (original kept when small)', recs.length === 1 && recs[0].id === imgState.assetId && recs[0].type === 'image/png' && recs[0].width === 320, JSON.stringify(recs));
await cdp('Page.reload');
await ready();
check('image: still shown after reload', await evaluate(`(() => { const i = document.querySelector('${W('image')} .image__img'); return !i.hidden && i.naturalWidth === 320; })()`));
await click(`${W('image')} .widget__settings`);
await click(`${W('image')} .w-panel .w-seg__opt:nth-child(2)`);
await click(`${W('image')} .w-panel input[type="text"]`);
await type('파란 사각형');
await click(`${W('image')} .w-panel__header .w-btn`);
await sleep(SAVE_WAIT);
const imgState2 = (await widget('image')).state;
check('image: fit cover + alt saved and applied', imgState2.fit === 'cover' && imgState2.alt === '파란 사각형' &&
  (await evaluate(`(() => { const i = document.querySelector('${W('image')} .image__img'); return getComputedStyle(i).objectFit + '|' + i.alt; })()`)) === 'cover|파란 사각형');
await shot('m4-image');

// 큰 이미지 → 긴 변 2048로 축소·재인코딩
await setFile(`${W('image')} .image__file`, PNG_BIG);
await sleep(SAVE_WAIT);
const bigId = (await widget('image')).state.assetId;
recs = await idbAssets();
const bigRec = recs.find((r) => r.id === bigId);
check('image: large image downscaled to 2048px (WebP/JPEG)', bigRec && bigRec.width === 2048 && bigRec.height === 102 && ['image/webp', 'image/jpeg'].includes(bigRec.type), JSON.stringify(bigRec));
// 깨진 파일 → 오류 안내, 상태 유지
await setFile(`${W('image')} .image__file`, PNG_BAD);
check('image: broken file → error message, state unchanged', (await evaluate(`(() => { const e = document.querySelector('${W('image')} .image__error'); return !e.hidden && e.textContent; })()`)) === '이미지를 읽을 수 없어요.' &&
  (await widget('image')).state.assetId === bigId);

// 위젯 삭제 → 재시작 시 GC로 IndexedDB에서 삭제 (유예 시간은 테스트에서 우회)
await click(`${W('image')} .widget__remove`);
await sleep(SAVE_WAIT);
await ageAssets();
await cdp('Page.reload');
await sleep(4000); // GC 지연 3초
recs = await idbAssets();
check('image: unreferenced images removed by GC after restart', recs.length === 0, JSON.stringify(recs.map((r) => r.id)));

// ── 6. 사용자 이미지 배경 ──
await click('#board-menu > summary');
check('background: "my image" swatch present', await evaluate(`!!document.querySelector('#background-swatches .swatch--image')`));
await setFile('#background-file', PNG_B);
await sleep(SAVE_WAIT);
let bg = (await saved())[0].background;
check('background: image background saved', bg.type === 'image' && /^a_[0-9a-f]{16}$/.test(bg.value), JSON.stringify(bg));
check('background: canvas shows blob image, tone light', await evaluate(`(() => { const c = document.querySelector('#canvas'); return c.style.backgroundImage.includes('blob:') && c.dataset.tone === 'light'; })()`));
check('background: image swatch pressed', (await evaluate(`document.querySelector('#background-swatches .swatch--image').getAttribute('aria-pressed')`)) === 'true');
await shot('m4-background');
// 새 보드에 같은 이미지 → 저장은 1개
await click('#board-actions [data-action="new"]');
await sleep(300);
await setFile('#background-file', PNG_B);
await sleep(SAVE_WAIT);
const boardsNow = await saved();
recs = await idbAssets();
check('background: same image on two boards stored once', boardsNow.length === 2 && boardsNow[1].background.value === bg.value && recs.length === 1, `${boardsNow.length} boards, ${recs.length} assets`);
// 고대비 테마는 검정 유지
await evaluate(`document.documentElement.dataset.theme = 'contrast'`);
await sleep(200);
check('background: contrast theme ignores image', (await evaluate(`getComputedStyle(document.querySelector('#canvas')).backgroundImage`)) === 'none');
await evaluate(`delete document.documentElement.dataset.theme`);
await cdp('Page.reload');
await ready();
check('background: image restored after reload', await evaluate(`document.querySelector('#canvas').style.backgroundImage.includes('blob:')`));

// ── 7. 이미지 포함 내보내기/가져오기 ──
const DL_DIR = join(OUT_DIR, 'downloads-m4');
rmSync(DL_DIR, { recursive: true, force: true });
mkdirSync(DL_DIR, { recursive: true });
await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR });
// 현재 보드(2번째)에 이미지 위젯 추가
await click('.dock__item[data-type="image"]');
await sleep(300);
await setFile(`${W('image')} .image__file`, PNG_A);
await sleep(SAVE_WAIT);
await click('#board-menu > summary');
await click('#board-transfer [data-action="exportAll"]');
let exported = null;
for (let i = 0; i < 40 && !exported; i += 1) {
  const f = readdirSync(DL_DIR).find((n) => n.endsWith('.classboardkit.json'));
  if (f) exported = f;
  else await sleep(150);
}
const exportPath = exported && join(DL_DIR, exported);
const exportData = exportPath ? JSON.parse(readFileSync(exportPath, 'utf8')) : null;
const assetIds = Object.keys(exportData?.assets ?? {});
check('export: file includes referenced images (2) as base64', assetIds.length === 2 && assetIds.every((id) => /^a_[0-9a-f]{16}$/.test(id) && exportData.assets[id].data.length > 100), assetIds.join(','));

// IndexedDB 비우고 새로고침 → 이미지 없음
await evaluate(`new Promise((resolve) => { const req = indexedDB.open('classboardkit'); req.onsuccess = () => {
  const tx = req.result.transaction('assets', 'readwrite'); tx.objectStore('assets').clear(); tx.oncomplete = () => resolve(true); }; })`);
await cdp('Page.reload');
await ready();
check('import prep: images gone → image widget shows "not found"', (await evaluate(`document.querySelector('${W('image')} .image').dataset.mode`)) === 'missing');

// 변조 파일 → 거부, 아무것도 바뀌지 않음
const tampered = structuredClone(exportData);
tampered.assets[assetIds[0]].data = Buffer.from('tampered image bytes!!').toString('base64');
const TAMPERED = join(DL_DIR, 'tampered.json');
writeFileSync(TAMPERED, JSON.stringify(tampered));
const boardsBefore = (await saved()).length;
await setFile('#import-file', TAMPERED);
check('import: tampered image (hash mismatch) rejected, nothing added',
  (await saved()).length === boardsBefore && (await idbAssets()).length === 0 &&
  (await evaluate(`[...document.querySelectorAll('.notice')].some(n => n.dataset.key === 'transfer.error.invalid')`)));
await evaluate(`document.querySelectorAll('.notice').forEach(n => n.remove())`);

// 정상 파일 가져오기 → 이미지 복원
await setFile('#import-file', exportPath);
await sleep(SAVE_WAIT);
const afterImport = await saved();
recs = await idbAssets();
check('import: boards added and images restored to IndexedDB', afterImport.length === boardsBefore + 2 && recs.length === 2 && assetIds.every((id) => recs.some((r) => r.id === id)),
  `${afterImport.length} boards, ${recs.length} assets`);
check('import: first imported board active with image background', afterImport[boardsBefore].background.type === 'image' &&
  (await evaluate(`document.querySelector('#canvas').style.backgroundImage.includes('blob:')`)));
// 마지막 보드(이미지 위젯 있음)로 전환
await click('#board-menu > summary');
await click('#board-list li:last-child button');
await sleep(800);
check('import: imported image widget displays restored image',
  await evaluate(`(() => { const i = document.querySelector('${W('image')} .image__img'); return !!i && !i.hidden && i.naturalWidth === 320; })()`));

// ── 8. 소음 측정기 (가짜 마이크) ──
await clearWidgets();
await click('.dock__item[data-type="noise"]');
await layout({ noise: [0.05, 0.1, 0.25, 0.55] });
/** getUserMedia를 감싸 스트림을 기록 (트랙 종료 확인용) */
const trackStreams = () => evaluate(`(() => { const md = navigator.mediaDevices; const orig = md.getUserMedia.bind(md); window.__streams = [];
  md.getUserMedia = async (c) => { const s = await orig(c); window.__streams.push(s); return s; }; return true; })()`);
const trackStates = () => evaluate(`window.__streams.flatMap(s => s.getTracks().map(t => t.readyState)).join(',')`);
await trackStreams();
check('noise: idle with privacy note before start (no mic access yet)', (await evaluate(`document.querySelector('${W('noise')} .noise').dataset.mode`)) === 'idle' &&
  (await evaluate(`window.__streams.length`)) === 0);
await click(`${W('noise')} .noise__idle .w-btn--primary`);
await sleep(1500);
check('noise: measuring with fake mic → level > 0', (await evaluate(`document.querySelector('${W('noise')} .noise').dataset.mode`)) === 'live' &&
  Number(await evaluate(`getComputedStyle(document.querySelector('${W('noise')} .noise')).getPropertyValue('--level')`)) > 0 &&
  (await trackStates()) === 'live');
// 경고 기준을 최저로 → 1초 넘게 넘으면 경고
await click(`${W('noise')} .widget__settings`);
await evaluate(`(() => { const r = document.querySelector('${W('noise')} .w-panel input[type="range"]'); r.value = '5'; r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await click(`${W('noise')} .w-panel__header .w-btn`);
await sleep(1800);
check('noise: threshold saved, sustained level → visual warning', (await widget('noise')).state.threshold === 5 &&
  (await evaluate(`document.querySelector('${W('noise')} .noise').classList.contains('is-alarm')`)) &&
  (await evaluate(`document.querySelector('${W('noise')} .noise__warning').textContent`)) === '조금 조용히!');
await shot('m4-noise');
check('noise: nothing about sound is saved', JSON.stringify((await widget('noise')).state) === JSON.stringify({ threshold: 5, sensitivity: 'mid', style: 'bar' }));
// 탭 숨김 → 마이크 끔
await evaluate(`(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); })()`);
await sleep(200);
check('noise: tab hidden → track stopped, "start again" shown', (await trackStates()) === 'ended' &&
  (await evaluate(`document.querySelector('${W('noise')} .noise__idle .w-btn--primary').textContent`)).includes('다시'));
await evaluate(`(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); })()`);
// 다시 시작 → 위젯 삭제 → 트랙 종료
await click(`${W('noise')} .noise__idle .w-btn--primary`);
await sleep(800);
check('noise: restarted', (await trackStates()) === 'ended,live');
await click(`${W('noise')} .widget__remove`);
await sleep(300);
check('noise: widget removed → microphone track ended', (await trackStates()) === 'ended,ended');

// ── 9. QR 코드 ──
await clearWidgets();
check('qr: library not loaded before a QR widget exists', await evaluate(`typeof window.qrcodegen === 'undefined' && !document.querySelector('script[src*="qrcodegen"]')`));
await click('.dock__item[data-type="qr"]');
await layout({ qr: [0.05, 0.1, 0.25, 0.5] });
check('qr: empty state asks for content', await evaluate(`!document.querySelector('${W('qr')} .qr__empty').hidden`));
await click(`${W('qr')} .qr__empty .w-btn`);
await click(`${W('qr')} .w-panel textarea`);
await type('https://yanniart.github.io/classboardkit/');
await click(`${W('qr')} .w-panel__header .w-btn`);
await sleep(SAVE_WAIT);
const qrInfo = await evaluate(`(() => { const s = document.querySelector('${W('qr')} .qr__code'); const r = s.getBoundingClientRect();
  return { visible: !document.querySelector('${W('qr')} .qr__view').hidden, size: Number(s.dataset.size), vb: s.getAttribute('viewBox'),
    d: s.querySelector('path').getAttribute('d').length, w: r.width, h: r.height,
    caption: document.querySelector('${W('qr')} .qr__caption').textContent, fill: getComputedStyle(s).backgroundColor }; })()`);
check('qr: SVG generated (version size + 4-module quiet zone)', qrInfo.visible && qrInfo.size >= 21 && qrInfo.vb === `0 0 ${qrInfo.size + 8} ${qrInfo.size + 8}` && qrInfo.d > 100, JSON.stringify(qrInfo));
check('qr: square, readable size, white background, short caption', Math.abs(qrInfo.w - qrInfo.h) < 1 && qrInfo.w >= 150 &&
  qrInfo.fill === 'rgb(255, 255, 255)' && qrInfo.caption === 'yanniart.github.io/classboardkit', JSON.stringify(qrInfo));
check('qr: text saved', (await widget('qr')).state.text === 'https://yanniart.github.io/classboardkit/');
// 크기 조절 → 비례
await layout({ qr: [0.05, 0.1, 0.4, 0.8] });
const qrBig = await evaluate(`document.querySelector('${W('qr')} .qr__code').getBoundingClientRect().width`);
check('qr: scales with widget', qrBig > qrInfo.w * 1.3, `${qrInfo.w} → ${qrBig}`);
await shot('m4-qr');
// 너무 긴 내용(바이너리 모드 한계 초과) → 안내
await evaluate(`(() => { const boards = JSON.parse(localStorage.getItem('classboardkit:v1:boards'));
  for (const bd of boards) for (const w of bd.widgets) if (w.type === 'qr') w.state.text = 'x'.repeat(600);
  localStorage.setItem('classboardkit:v1:boards', JSON.stringify(boards)); })()`);
await cdp('Page.reload');
await ready();
await sleep(300);
const qrLong = await evaluate(`(() => { const m = document.querySelector('${W('qr')} .qr__message'); return { shown: !document.querySelector('${W('qr')} .qr__empty').hidden, text: m.textContent, err: m.classList.contains('is-error') }; })()`);
check('qr: too-long text → error message', qrLong.shown && qrLong.err && qrLong.text.includes('너무 길어서'), JSON.stringify(qrLong));

// ── 10. 오프라인: 서비스 워커 설치 후 서버 종료 → QR(지연 로드)·이미지·그리기 동작 ──
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(8766, '127.0.0.1', r));
await cdp('Page.navigate', { url: 'http://127.0.0.1:8766/' });
await ready();
let controlled = false;
for (let i = 0; i < 40 && !controlled; i += 1) {
  controlled = await evaluate(`navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller)`);
  if (!controlled) await sleep(250);
}
check('offline prep: service worker controls page', controlled);
const vendorCached = await evaluate(`caches.keys().then(async keys => { const c = await caches.open(keys[0]); return !!(await c.match('src/vendor/qrcodegen.js')); })`);
check('offline prep: QR library precached', vendorCached);
server.closeAllConnections();
await new Promise((r) => server.close(r));
b.errors.length = 0;
await cdp('Page.reload');
await ready();
check('offline: network really blocked', await evaluate(`fetch('/__not_cached__?' + Date.now()).then(() => false, () => true)`));
// 위 확인용 요청의 실패 로그는 예상된 것
for (let i = b.errors.length - 1; i >= 0; i -= 1) if (b.errors[i].includes('__not_cached__')) b.errors.splice(i, 1);
await click('.dock__item[data-type="qr"]');
await click('.dock__item[data-type="image"]');
await click('.dock__item[data-type="dice"]');
await layout({ qr: [0.02, 0.1, 0.25, 0.5], image: [0.3, 0.1, 0.3, 0.4], dice: [0.65, 0.1, 0.3, 0.4] });
await click(`${W('qr')} .qr__empty .w-btn`);
await click(`${W('qr')} .w-panel textarea`);
await type('offline QR');
await click(`${W('qr')} .w-panel__header .w-btn`);
await sleep(400);
check('offline: QR library loads from cache and renders', await evaluate(`!document.querySelector('${W('qr')} .qr__view').hidden && Number(document.querySelector('${W('qr')} .qr__code').dataset.size) === 21`));
await setFile(`${W('image')} .image__file`, PNG_A);
check('offline: image widget stores & shows image', await evaluate(`(() => { const i = document.querySelector('${W('image')} .image__img'); return !i.hidden && i.naturalWidth === 320; })()`));
await click(`${W('dice')} .w-btn--primary`);
await sleep(800);
check('offline: dice works', (await widget('dice')).state.values.length === 2);

// ── 11. 영어 + 다크 테마: 새 위젯 6종 한 화면 (README 스크린샷), 원거리 가독성 ──
await click('.dock__item[data-type="countdown"]');
await click('.dock__item[data-type="draw"]');
await click('.dock__item[data-type="noise"]');
await sleep(SAVE_WAIT);
await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('classboardkit:settings')); s.locale = 'en'; s.theme = 'dark';
  localStorage.setItem('classboardkit:settings', JSON.stringify(s));
  // 스크린샷용 그림: 원 + 화살표 (점 좌표 0~10000)
  const boards = JSON.parse(localStorage.getItem('classboardkit:v1:boards'));
  const circle = []; for (let i = 0; i <= 40; i += 1) { const a = (i / 40) * Math.PI * 2; circle.push(Math.round(3000 + 1800 * Math.cos(a)), Math.round(5000 + 3000 * Math.sin(a))); }
  for (const bd of boards) for (const w of bd.widgets) if (w.type === 'draw') w.state = { aspect: 1.8, strokes: [
    { c: 'red', w: 'm', p: circle },
    { c: 'blue', w: 'l', p: [5600, 5000, 8600, 5000] }, { c: 'blue', w: 'l', p: [7800, 3800, 8600, 5000, 7800, 6200] },
  ] };
  localStorage.setItem('classboardkit:v1:boards', JSON.stringify(boards)); })()`);
await layout({
  dice: [0.01, 0.07, 0.24, 0.4], countdown: [0.26, 0.07, 0.3, 0.4], qr: [0.57, 0.07, 0.19, 0.4], noise: [0.77, 0.07, 0.22, 0.4],
  draw: [0.01, 0.49, 0.5, 0.4], image: [0.52, 0.49, 0.47, 0.4],
});
const en = await evaluate(`({ lang: document.documentElement.lang, theme: document.documentElement.dataset.theme,
  dock: document.querySelector('.dock__item[data-type="noise"]').textContent, qrTitle: document.querySelector('${W('qr')} .widget__title').textContent })`);
check('english + dark: new widgets translated', en.lang === 'en' && en.theme === 'dark' && en.dock === 'Noise meter' && en.qrTitle === 'QR code', JSON.stringify(en));
const fontPx = (sel) => evaluate(`parseFloat(getComputedStyle(document.querySelector(${JSON.stringify(sel)})).fontSize)`);
const sizes = {
  countdownClock: await fontPx(`${W('countdown')} .countdown__clock`),
  countdownTitle: await fontPx(`${W('countdown')} .countdown__head`),
  diceSum: await fontPx(`${W('dice')} .dice__sum`),
  qrCaption: await fontPx(`${W('qr')} .qr__caption`),
  noiseText: await fontPx(`${W('noise')} .noise__idle-text`),
};
check('readability: key text ≥ 18px at board size', Object.values(sizes).every((v) => v >= 18), JSON.stringify(sizes));
check('dark theme: QR keeps white background', (await evaluate(`getComputedStyle(document.querySelector('${W('qr')} .qr__code')).backgroundColor`)) === 'rgb(255, 255, 255)');
await shot('m4-widgets-dark-en');

b.finish();
