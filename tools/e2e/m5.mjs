// M5 E2E: 실행 취소(F-014) · 템플릿(F-013) · 공유 링크(F-012) + 오프라인
// 실행: 정적 서버(8765)를 띄운 뒤 `node tools/e2e/m5.mjs` (오프라인 검사용 자체 서버 8767도 사용)
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { APP_URL, OUT_DIR, launch, sleep } from './harness.mjs';
import { makePng } from './png.mjs';

const b = await launch({ lang: 'ko' });
const { evaluate, click, drag, check, shot, viewport, cdp, saved, type, key, ready } = b;
const SAVE_WAIT = 650;
const BOARDS_KEY = 'classboardkit:v1:boards';
const CTRL = 2;
const SHIFT = 8;
const undoKey = () => key('z', 'KeyZ', 90, CTRL);
const redoKey = () => key('Z', 'KeyZ', 90, CTRL | SHIFT);
const W = (t) => `.widget[data-type="${t}"]`;

const state = async () => {
  await sleep(SAVE_WAIT);
  const boards = await saved();
  const settings = await evaluate(`JSON.parse(localStorage.getItem('classboardkit:settings'))`);
  const active = boards.find((bd) => bd.id === settings.activeBoardId);
  return { boards, settings, active };
};
const rectOf = (w) => (w ? [w.x, w.y, w.w, w.h].map((n) => Math.round(n * 1000) / 1000).join(',') : 'none');
const findType = (bd, t) => bd?.widgets.find((w) => w.type === t);
const blurToCanvas = () => evaluate(`(document.activeElement?.blur(), document.getElementById('canvas').focus(), true)`);
const btn = (sel) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? { disabled: el.disabled, hidden: el.hidden } : null; })()`);
const openMenu = async () => {
  if (!(await evaluate(`document.querySelector('#board-menu').open`))) await click('#board-menu > summary');
};
const menuAction = async (action) => {
  await openMenu();
  await click(`#board-menu [data-action="${action}"]`);
  await sleep(250);
};
const dialogOpen = () => evaluate(`!!document.querySelector('dialog[open]')`);
const confirmDialog = () => click('dialog[open] .dialog__actions .button--primary, dialog[open] .dialog__actions .button--danger');
const cancelDialog = () => click('dialog[open] .dialog__actions .button:not(.button--primary):not(.button--danger)');
const overlaps = (a, c) => a.x < c.x + c.w - 1e-9 && c.x < a.x + a.w - 1e-9 && a.y < c.y + c.h - 1e-9 && c.y < a.y + a.h - 1e-9;

/** 저장 데이터를 직접 바꾼 뒤 새로고침 */
async function writeBoards(boards, activeBoardId) {
  await sleep(SAVE_WAIT);
  await evaluate(`(() => {
    localStorage.setItem('${BOARDS_KEY}', ${JSON.stringify(JSON.stringify(boards))});
    const s = JSON.parse(localStorage.getItem('classboardkit:settings'));
    s.activeBoardId = ${JSON.stringify(activeBoardId)};
    localStorage.setItem('classboardkit:settings', JSON.stringify(s));
  })()`);
  await cdp('Page.reload');
  await ready();
}

const NOW = new Date().toISOString();
const mkBoard = (id, name, widgets, background = { type: 'gradient', value: 'default' }) => ({
  id, name, createdAt: NOW, updatedAt: NOW, background, widgets,
});
const mkWidget = (id, type, rect, st, z = 1) => ({ id, type, version: 1, x: rect[0], y: rect[1], w: rect[2], h: rect[3], z, state: st });

await viewport(1440, 900);
await cdp('Page.navigate', { url: APP_URL });
await ready();

// ═════════ 1. 실행 취소 ═════════

check('undo: toolbar buttons start disabled', (await btn('#undo-button'))?.disabled === true && (await btn('#redo-button'))?.disabled === true);

await click('.dock__item[data-type="text"]');
let s = await state();
const added = findType(s.active, 'text');
check('undo: widget added, undo button enabled', added && (await btn('#undo-button')).disabled === false);

await drag(`${W('text')} .widget__bar`, 220, 120);
s = await state();
const moved = findType(s.active, 'text');
await drag(`${W('text')} .widget__resize`, 120, 60);
s = await state();
const resized = findType(s.active, 'text');
check('undo: drag moved and resize changed size', rectOf(moved) !== rectOf(added) && resized.w > moved.w, `${rectOf(added)} → ${rectOf(moved)} → ${rectOf(resized)}`);

await click(`${W('text')} .widget__remove`);
s = await state();
check('undo: widget deleted + notice with undo action', !findType(s.active, 'text') &&
  (await evaluate(`!!document.querySelector('.notice[data-key="history.removedWidget"] .notice__action')`)));

await blurToCanvas();
await undoKey();
s = await state();
check('undo 1 (Ctrl+Z): deleted widget restored exactly', rectOf(findType(s.active, 'text')) === rectOf(resized) && findType(s.active, 'text').id === added.id);
await undoKey();
s = await state();
check('undo 2: size restored', rectOf(findType(s.active, 'text')) === rectOf(moved));
await undoKey();
s = await state();
check('undo 3: position restored', rectOf(findType(s.active, 'text')) === rectOf(added));
await undoKey();
s = await state();
check('undo 4: added widget removed, undo disabled', !findType(s.active, 'text') && (await btn('#undo-button')).disabled === true);
check('undo: feedback notice shows action name', await evaluate(`document.querySelector('.notice[data-key="history.undone"]')?.textContent.includes('위젯 추가')`));

await redoKey();
await redoKey();
s = await state();
check('redo x2 (Ctrl+Shift+Z): widget back at moved position', rectOf(findType(s.active, 'text')) === rectOf(moved));
await key('y', 'KeyY', 89, CTRL);
s = await state();
check('redo (Ctrl+Y): resize re-applied', rectOf(findType(s.active, 'text')) === rectOf(resized));

// 이동 → 텍스트 입력 → 실행 취소: 입력 유지, 위치만 복원
const beforeMove = findType(s.active, 'text');
await drag(`${W('text')} .widget__bar`, -150, 80);
await click(`${W('text')} .text-widget__input`);
await type('수업 목표');
s = await state();
check('undo: text typed after move', findType(s.active, 'text').state.content === '수업 목표');
// 입력 중 Ctrl+Z는 앱이 가로채지 않음 (위치 그대로)
const redoBefore = (await btn('#redo-button')).disabled;
await undoKey();
s = await state();
check('undo: Ctrl+Z inside textarea is not intercepted by the app',
  rectOf(findType(s.active, 'text')) !== rectOf(beforeMove) && (await btn('#redo-button')).disabled === redoBefore);
// 브라우저 기본 실행 취소가 글자를 지웠을 수 있으니 다시 입력
await evaluate(`(() => { const t = document.querySelector('${W('text')} .text-widget__input'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await type('수업 목표');
await blurToCanvas();
await undoKey();
s = await state();
check('undo after typing: position restored, typed text kept',
  rectOf(findType(s.active, 'text')) === rectOf(beforeMove) && findType(s.active, 'text').state.content === '수업 목표');

// 툴바 버튼 (태블릿)
await click(`${W('text')} .widget__remove`);
await click('#undo-button');
s = await state();
check('undo: toolbar undo button restores deleted widget', !!findType(s.active, 'text'));
await click('#redo-button');
s = await state();
check('undo: toolbar redo button deletes it again', !findType(s.active, 'text'));
await click('#undo-button');

// 삭제 알림의 "실행 취소" 버튼
await click(`${W('text')} .widget__remove`);
await click('.notice[data-key="history.removedWidget"] .notice__action');
s = await state();
check('undo: notice "undo" button restores widget', findType(s.active, 'text')?.state.content === '수업 목표');

// Delete 키 삭제도 기록
await evaluate(`document.querySelector('${W('text')}').focus()`);
await key('Delete', 'Delete', 46);
await blurToCanvas();
await undoKey();
s = await state();
check('undo: Delete-key removal can be undone', !!findType(s.active, 'text'));

// 키보드 연속 이동은 한 번에 되돌림 (합치기)
const beforeKeys = findType(s.active, 'text');
await evaluate(`document.querySelector('${W('text')}').focus()`);
for (let i = 0; i < 5; i += 1) await key('ArrowRight', 'ArrowRight', 39);
s = await state();
const afterKeys = findType(s.active, 'text');
await blurToCanvas();
await undoKey();
s = await state();
check('undo: 5 arrow-key moves undone with one Ctrl+Z', afterKeys.x > beforeKeys.x && rectOf(findType(s.active, 'text')) === rectOf(beforeKeys));

// 배경 변경
await openMenu();
await click('#background-swatches .swatch:nth-child(3)');
await sleep(150);
await evaluate(`document.querySelector('#board-menu').open = false`);
await blurToCanvas();
s = await state();
const changedBg = s.active.background.value;
await undoKey();
s = await state();
check('undo: background change undone', changedBg !== 'default' && s.active.background.value === 'default');

// 보드 삭제 → 실행 취소: 같은 위치·위젯
const boardA = s.active;
await menuAction('new');
s = await state();
const boardB = s.active;
check('undo: new board created', s.boards.length === 2 && boardB.id !== boardA.id);
await evaluate(`[...document.querySelectorAll('#board-list button')][0].click()`);
await menuAction('delete');
await confirmDialog();
s = await state();
check('undo: board A deleted', s.boards.length === 1 && s.boards[0].id === boardB.id &&
  (await evaluate(`!!document.querySelector('.notice[data-key="history.removedBoard"]')`)));
await blurToCanvas();
await undoKey();
s = await state();
check('undo: deleted board restored at same position with widgets',
  s.boards.length === 2 && s.boards[0].id === boardA.id && s.active.id === boardA.id &&
  JSON.stringify(s.boards[0].widgets) === JSON.stringify(boardA.widgets));

// 다른 보드에서 실행 취소 → 그 보드로 전환
await drag(`${W('text')} .widget__bar`, 100, 0);
await evaluate(`[...document.querySelectorAll('#board-list button')][1].click()`);
s = await state();
check('undo: switched to board B', s.active.id === boardB.id);
await blurToCanvas();
await undoKey();
s = await state();
check('undo: undo from another board switches back and restores', s.active.id === boardA.id && rectOf(findType(s.active, 'text')) === rectOf(beforeKeys));

// 이름 변경
await menuAction('rename');
await evaluate(`(() => { const i = document.querySelector('dialog[open] input'); i.value = '이름 바뀐 보드'; })()`);
await confirmDialog();
s = await state();
const renamed = s.active.name === '이름 바뀐 보드';
await blurToCanvas();
await undoKey();
s = await state();
check('undo: rename undone', renamed && s.active.name === boardA.name);

// 이미지 위젯 삭제 → 실행 취소: 이미지 유지 (GC 유예)
const IMG_DIR = join(OUT_DIR, 'm5-images');
mkdirSync(IMG_DIR, { recursive: true });
const PNG = join(IMG_DIR, 'green.png');
writeFileSync(PNG, makePng(240, 160, () => [40, 180, 90]));
await click('.dock__item[data-type="image"]');
{
  const { root } = await cdp('DOM.getDocument', { depth: -1, pierce: false });
  const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: `${W('image')} .image__file` });
  await cdp('DOM.setFileInputFiles', { nodeId, files: [PNG] });
  await sleep(1000);
}
const imgShown = () => evaluate(`(() => { const i = document.querySelector('${W('image')} .image__img'); return !!i && !i.hidden && i.naturalWidth === 240; })()`);
const hadImage = await imgShown();
await click(`${W('image')} .widget__remove`);
await sleep(3500); // 시작 3초 뒤 GC가 돌아도 10분 유예로 보존되어야 함
await blurToCanvas();
await undoKey();
await sleep(600);
check('undo: image widget restored with its image', hadImage && (await imgShown()));
await shot('m5-undo');

// ═════════ 2. 템플릿 ═════════

await menuAction('template');
check('template: dialog with 6 cards', (await evaluate(`document.querySelectorAll('dialog[open] .template-card').length`)) === 6);
check('template: cards have mini layout previews', (await evaluate(`document.querySelectorAll('dialog[open] [data-template="group-work"] .template-card__cell').length`)) === 4);
await shot('m5-template-dialog');
const boardsBeforeTpl = (await state()).boards.length;
await click('dialog[open] [data-template="group-work"]');
s = await state();
const tplBoard = s.active;
const tplRects = tplBoard.widgets;
check('template: new board "모둠 활동" with 4 widgets, active',
  s.boards.length === boardsBeforeTpl + 1 && tplBoard.name === '모둠 활동' && tplRects.length === 4,
  `${tplBoard.name} ${tplRects.length}`);
check('template: widgets do not overlap', tplRects.every((a, i) => tplRects.every((c, j) => i === j || !overlaps(a, c))));
check('template: timer is 15 minutes', findType(tplBoard, 'timer')?.state.durationMs === 15 * 60_000);
await shot('m5-template-group');
await viewport(768, 1024, true);
await sleep(400);
const tabletOk = await evaluate(`(() => {
  const dock = document.getElementById('dock').getBoundingClientRect();
  return [...document.querySelectorAll('.widget')].every(w => w.getBoundingClientRect().bottom <= dock.top + 1);
})()`);
check('template: 768px tablet — widgets stay above the dock', tabletOk);
await shot('m5-template-tablet');
await viewport(1440, 900);
await blurToCanvas();
await undoKey();
s = await state();
check('template: creating from template can be undone', s.boards.length === boardsBeforeTpl && !s.boards.some((bd) => bd.id === tplBoard.id));

// 영어로 바꿔 만든 템플릿은 영어 문구
await evaluate(`(() => { const sel = document.getElementById('setting-locale'); sel.value = 'en'; sel.dispatchEvent(new Event('change')); })()`);
await sleep(200);
await menuAction('template');
await click('dialog[open] [data-template="lesson-start"]');
s = await state();
check('template: English template text', s.active.name === 'Lesson start' && findType(s.active, 'text')?.state.content === 'Today’s goal',
  `${s.active.name} / ${findType(s.active, 'text')?.state.content}`);
await shot('m5-template-lesson-en');
await evaluate(`(() => { const sel = document.getElementById('setting-locale'); sel.value = 'ko'; sel.dispatchEvent(new Event('change')); })()`);
await sleep(200);

// 빈 보드 안내의 "템플릿으로 시작하기"
await menuAction('new');
check('template: empty-state link visible on empty board', await evaluate(`!document.getElementById('canvas-empty').hidden && document.getElementById('empty-template').offsetParent !== null`));
await shot('m5-empty-state');
await click('#empty-template');
await sleep(250);
check('template: empty-state link opens template dialog', (await evaluate(`document.querySelectorAll('dialog[open] .template-card').length`)) === 6);
await cancelDialog();
check('template: dialog closes', !(await dialogOpen()));

// ═════════ 3. 공유 링크 만들기 ═════════

const SHARE_ID = 'b_sharetest';
const shareBoard = mkBoard(SHARE_ID, '공유 테스트 3반', [
  mkWidget('w_rand', 'randomizer', [0.03, 0.12, 0.3, 0.45], { items: ['김민수', '이서연', '박지호'], excludePicked: true, picked: ['김민수'], history: ['김민수'] }, 1),
  mkWidget('w_text', 'text', [0.36, 0.12, 0.35, 0.25], { content: '오늘은 발표하는 날', size: 'l', align: 'center', color: 'default' }, 2),
  mkWidget('w_tmr', 'timer', [0.36, 0.4, 0.3, 0.4], { durationMs: 420000, mode: 'visual', status: 'idle', sound: false }, 3),
], { type: 'gradient', value: 'mint' });
const current = await state();
await writeBoards([...current.boards, shareBoard], SHARE_ID);

await menuAction('share');
const linkValue = async () => {
  for (let i = 0; i < 30; i += 1) {
    const v = await evaluate(`document.getElementById('share-link')?.value ?? ''`);
    if (v) return v;
    await sleep(100);
  }
  return '';
};
check('share: dialog open with "exclude names" checked', await evaluate(`document.getElementById('share-exclude-names')?.checked === true`));
const linkNoNames = await linkValue();
check('share: link uses URL fragment format', linkNoNames.startsWith(`${APP_URL.split('#')[0]}#share=1.`), linkNoNames.slice(0, 60));
await sleep(400);
check('share: short link (≤2000) shows QR code', linkNoNames.length <= 2000 && (await evaluate(`!!document.querySelector('dialog[open] .share__qr:not([hidden]) svg path')`)), `${linkNoNames.length} chars`);
check('share: privacy note shown', await evaluate(`!!document.querySelector('dialog[open] .share__privacy')?.textContent.includes('서버')`));
await shot('m5-share-dialog');

// 클립보드 복사
await cdp('Browser.grantPermissions', { origin: new URL(APP_URL).origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
await cdp('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
await click('#share-copy');
await sleep(200);
const clip = await evaluate(`navigator.clipboard.readText().catch(e => 'ERR ' + e.message)`);
check('share: copy button writes the link to the clipboard', clip === linkNoNames, clip.slice(0, 40));

// 명단 제외 끔 → 다른 링크
await click('#share-exclude-names');
let linkWithNames = '';
for (let i = 0; i < 30 && (!linkWithNames || linkWithNames === linkNoNames); i += 1) {
  linkWithNames = await linkValue();
  await sleep(100);
}
check('share: unchecking "exclude names" regenerates a longer link', linkWithNames !== linkNoNames && linkWithNames.length > linkNoNames.length);
await cancelDialog();

// 큰 그림 보드 → 32,000자 초과 안내
const strokes = [];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) % 10001);
for (let i = 0; i < 60; i += 1) strokes.push({ c: 'ink', w: 'm', p: Array.from({ length: 400 }, rnd) });
const bigBoard = mkBoard('b_bigdraw', '큰 그림', [mkWidget('w_draw', 'draw', [0.1, 0.12, 0.5, 0.6], { strokes, aspect: 1.5 })]);
await writeBoards([...(await state()).boards, bigBoard], 'b_bigdraw');
await menuAction('share');
let tooLong = false;
for (let i = 0; i < 40 && !tooLong; i += 1) {
  tooLong = await evaluate(`!!document.querySelector('dialog[open] .share__too-long:not([hidden]) .button--primary')`);
  if (!tooLong) await sleep(100);
}
check('share: board over 32,000 chars → file export suggested', tooLong && (await evaluate(`document.querySelector('dialog[open] .share__link-box').hidden`)));
await shot('m5-share-too-long');
await cancelDialog();

// ═════════ 4. 공유 링크 열기 (다른 프로필) ═════════

const b2 = await launch({ lang: 'ko' });
await b2.viewport(1280, 800);
const s2 = async () => {
  await sleep(SAVE_WAIT);
  const boards = await b2.saved();
  const settings = await b2.evaluate(`JSON.parse(localStorage.getItem('classboardkit:settings'))`);
  return { boards, active: boards.find((bd) => bd.id === settings.activeBoardId) };
};
const waitDialog = async (page) => {
  for (let i = 0; i < 40; i += 1) {
    if (await page.evaluate(`!!document.querySelector('dialog[open]')`)) return true;
    await sleep(100);
  }
  return false;
};
const waitNotice = async (page, k) => {
  for (let i = 0; i < 40; i += 1) {
    if (await page.evaluate(`!!document.querySelector('.notice[data-key="${k}"]')`)) return true;
    await sleep(100);
  }
  return false;
};

await b2.cdp('Page.navigate', { url: linkNoNames });
await b2.ready();
check('open: confirm dialog appears with board name and widget count', (await waitDialog(b2)) &&
  (await b2.evaluate(`document.querySelector('dialog[open] .dialog__message').textContent`)).includes('공유 테스트 3반'));
check('open: nothing added before confirming', (await s2()).boards.length === 1);
await b2.shot('m5-share-open-confirm');
await b2.click('dialog[open] .button--primary');
let r2 = await s2();
const opened = r2.active;
const origRand = shareBoard.widgets[0];
check('open: shared board added and active', r2.boards.length === 2 && opened.name === '공유 테스트 3반' && opened.id !== SHARE_ID);
check('open: names excluded (randomizer list empty)', findType(opened, 'randomizer')?.state.items.length === 0 && findType(opened, 'randomizer').state.history.length === 0);
check('open: layout & settings identical', rectOf(findType(opened, 'randomizer')) === rectOf(origRand) &&
  findType(opened, 'timer').state.durationMs === 420000 && findType(opened, 'timer').state.mode === 'visual' &&
  findType(opened, 'text').state.content === '오늘은 발표하는 날' && opened.background.value === 'mint');
check('open: #share removed from address', (await b2.evaluate('location.hash')) === '');
check('open: success notice', await waitNotice(b2, 'share.added'));
await b2.cdp('Page.reload');
await b2.ready();
await sleep(500);
check('open: reload does not ask again', !(await b2.evaluate(`!!document.querySelector('dialog[open]')`)) && (await s2()).boards.length === 2);

// 이미 열린 앱에 링크로 이동 (hashchange) — 명단 포함 링크
await b2.cdp('Page.navigate', { url: linkWithNames });
check('open: hashchange in running app also asks', await waitDialog(b2));
await b2.click('dialog[open] .button--primary');
r2 = await s2();
check('open: names included when not excluded', r2.boards.length === 3 && findType(r2.active, 'randomizer')?.state.items.join(',') === '김민수,이서연,박지호');

// 취소 → 변화 없음
await b2.cdp('Page.navigate', { url: linkNoNames });
await waitDialog(b2);
await b2.click('dialog[open] .dialog__actions .button:not(.button--primary)');
r2 = await s2();
check('open: cancel adds nothing and clears hash', r2.boards.length === 3 && (await b2.evaluate('location.hash')) === '');

// 실행 취소로 추가한 공유 보드 제거
await b2.evaluate(`(document.activeElement?.blur(), document.getElementById('canvas').focus(), true)`);
await b2.key('z', 'KeyZ', 90, CTRL);
check('open: added shared board can be undone', (await s2()).boards.length === 2);

// 잘린 링크·변조·압축 폭탄
const errorsBefore = b2.errors.length;
const [base, encoded] = linkNoNames.split('#share=');
await b2.cdp('Page.navigate', { url: `${base}#share=${encoded.slice(0, Math.floor(encoded.length * 0.6))}` });
check('open: truncated link → error notice', await waitNotice(b2, 'share.error.invalid'));
await b2.evaluate(`document.querySelectorAll('.notice').forEach(n => n.remove())`);
await b2.cdp('Page.navigate', { url: `${base}#share=1.not*valid*base64` });
check('open: tampered link → error notice', await waitNotice(b2, 'share.error.invalid'));
await b2.evaluate(`document.querySelectorAll('.notice').forEach(n => n.remove())`);
const bomb = deflateRawSync(Buffer.alloc(1024 * 1024 + 4096, 32)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
await b2.cdp('Page.navigate', { url: `${base}#share=1.${bomb}` });
check('open: decompression bomb (>1MB) rejected', (await waitNotice(b2, 'share.error.invalid')) && (await s2()).boards.length === 2, `${bomb.length} chars`);
await b2.evaluate(`document.querySelectorAll('.notice').forEach(n => n.remove())`);
await b2.cdp('Page.navigate', { url: `${base}#share=9.abcd` });
check('open: newer share version → update notice', await waitNotice(b2, 'transfer.error.newerVersion'));
check('open: no console errors in second profile', b2.errors.length === errorsBefore && b2.errors.length === 0, b2.errors.join(' | '));
b2.close();

// ═════════ 5. 오프라인: 템플릿·공유 링크 열기 ═════════

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
const OFFLINE = 'http://127.0.0.1:8767/';
await new Promise((r) => server.listen(8767, '127.0.0.1', r));
await cdp('Page.navigate', { url: OFFLINE });
await ready();
let controlled = false;
for (let i = 0; i < 40 && !controlled; i += 1) {
  controlled = await evaluate(`navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller)`);
  if (!controlled) await sleep(250);
}
check('offline prep: service worker controls page', controlled);
server.closeAllConnections();
await new Promise((r) => server.close(r));
b.errors.length = 0;
await cdp('Page.reload');
await ready();
check('offline: network really blocked', await evaluate(`fetch('/__not_cached__?' + Date.now()).then(() => false, () => true)`));
for (let i = b.errors.length - 1; i >= 0; i -= 1) if (b.errors[i].includes('__not_cached__')) b.errors.splice(i, 1);
const offBefore = (await state()).boards.length;
await menuAction('template');
await click('dialog[open] [data-template="quiz"]');
s = await state();
check('offline: template board created (lazy module from cache)', s.boards.length === offBefore + 1 && findType(s.active, 'scoreboard')?.state.teams.length === 4);
await cdp('Page.navigate', { url: 'about:blank' });
await cdp('Page.navigate', { url: `${OFFLINE}#share=${encoded}` });
await ready();
check('offline: share link opens (confirm dialog)', await waitDialog(b));
await confirmDialog();
s = await state();
check('offline: shared board added', s.boards.length === offBefore + 2 && s.active.name === '공유 테스트 3반');

b.finish();
