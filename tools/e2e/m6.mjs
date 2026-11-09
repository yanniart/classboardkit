// M6 E2E: 접근성(axe·접근성 트리·키보드·포커스·낭독기 알림·강제 색상·움직임 줄이기·200% 확대) · 활동 상징 · 위젯 모양
// 실행: 정적 서버(8765) 실행 후 `node tools/e2e/m6.mjs` (axe는 .tools/axe/axe.min.js — 없으면 해당 항목 건너뜀)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_URL, OUT_DIR, launch, sleep } from './harness.mjs';
import { AXE_AVAILABLE, axTree, axe, severe, summarize } from './a11y.mjs';
import { auditStates } from './a11y-states.mjs';
import { makePng } from './png.mjs';

const b = await launch({ lang: 'ko' });
const { evaluate, click, check, shot, viewport, cdp, key, type, ready } = b;
const SAVE_WAIT = 650;
const BOARDS_KEY = 'classboardkit:v1:boards';
const CTRL = 2;
const SHIFT = 8;
const W = (t) => `.widget[data-type="${t}"]`;
const active = () => evaluate(`(() => { const e = document.activeElement; return e ? (e.id || e.dataset.type || e.dataset.symbol || e.className || e.tagName) : null; })()`);
const activeIs = (sel) => evaluate(`document.activeElement?.matches(${JSON.stringify(sel)}) ?? false`);
const tab = (mods = 0) => key('Tab', 'Tab', 9, mods);
/** 버튼 활성화까지 되는 실제 Enter (char 이벤트 포함 — key()의 rawKeyDown만으로는 click이 안 생김) */
const enter = async () => {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(120);
};
const esc = () => key('Escape', 'Escape', 27);
const announcer = () => evaluate(`document.getElementById('announcer')?.textContent ?? ''`);
const savedBoard = async () => {
  await sleep(SAVE_WAIT);
  return evaluate(`(() => { const bs = JSON.parse(localStorage.getItem('${BOARDS_KEY}')); const s = JSON.parse(localStorage.getItem('classboardkit:settings')); return bs.find(x => x.id === s.activeBoardId); })()`);
};
const setTheme = (v) => evaluate(`(() => { const s = document.getElementById('setting-theme'); s.value = '${v}'; s.dispatchEvent(new Event('change')); })()`);
const setLocale = (v) => evaluate(`(() => { const s = document.getElementById('setting-locale'); s.value = '${v}'; s.dispatchEvent(new Event('change')); })()`);
const clearBoard = async () => {
  await sleep(SAVE_WAIT);
  await evaluate(`(() => { const bs = JSON.parse(localStorage.getItem('${BOARDS_KEY}')); for (const bd of bs) { bd.widgets = []; delete bd.widgetStyle; bd.background = { type: 'gradient', value: 'default' }; } localStorage.setItem('${BOARDS_KEY}', JSON.stringify(bs)); })()`);
  await cdp('Page.reload');
  await ready();
};
/** 저장 데이터로 위젯 배치 (타입별 [x, y, w, h], state 덮어쓰기) */
const placeWidgets = async (specs) => {
  await sleep(SAVE_WAIT);
  await evaluate(`(() => {
    const specs = ${JSON.stringify(specs)};
    const bs = JSON.parse(localStorage.getItem('${BOARDS_KEY}'));
    const s = JSON.parse(localStorage.getItem('classboardkit:settings'));
    const bd = bs.find(x => x.id === s.activeBoardId);
    bd.widgets = bd.widgets.map(w => specs[w.type] ? { ...w, x: specs[w.type].r[0], y: specs[w.type].r[1], w: specs[w.type].r[2], h: specs[w.type].r[3], state: { ...w.state, ...(specs[w.type].state || {}) } } : w);
    localStorage.setItem('${BOARDS_KEY}', JSON.stringify(bs));
  })()`);
  await cdp('Page.reload');
  await ready();
};

await viewport(1440, 900);
await cdp('Page.navigate', { url: APP_URL });
await ready();

// ═════════ 1. 자동 점검: axe + 접근성 트리 (점검 상태 전부) ═════════

if (!AXE_AVAILABLE) console.log('WARN: axe-core 없음 → axe 항목 건너뜀');
const failures = [];
let states = 0;
for await (const { name, include } of auditStates(b)) {
  states += 1;
  const v = await axe(b, include ? { include } : {});
  const tree = await axTree(b);
  if (severe(v).length) failures.push(`${name}: ${summarize(severe(v))}`);
  if (tree.unnamed.length) failures.push(`${name}: unnamed ${tree.unnamed.join(',')}`);
}
check(`a11y: axe critical/serious 0 and no unnamed controls in ${states} states${AXE_AVAILABLE ? '' : ' (tree only)'}`, failures.length === 0 && states >= 35, failures.join(' || '));

// ═════════ 2. 구조·탭 순서 ═════════

await setTheme('light');
await viewport(1440, 900);
await clearBoard();
const landmarks = await evaluate(`[...document.querySelectorAll('main, nav, section[aria-label], header')].map(e => e.tagName.toLowerCase() + ':' + (e.getAttribute('aria-label') ?? ''))`);
check('structure: landmarks (2 toolbars, main canvas, dock nav) with names', landmarks.length === 4 && landmarks.every((l) => !l.endsWith(':')), landmarks.join(' | '));
check('structure: h1 inside a landmark', await evaluate(`!!document.querySelector('h1').closest('section, main, nav')`));
await evaluate(`document.activeElement?.blur(); document.body.focus()`);
await tab();
check('keyboard: first Tab stop is "skip to dock" link, visible when focused', (await activeIs('#skip-to-dock')) &&
  (await evaluate(`document.getElementById('skip-to-dock').getBoundingClientRect().top >= 0`)));
await shot('m6-skip-link');
const order = [];
for (let i = 0; i < 5; i += 1) {
  await tab();
  order.push(await active());
}
check('keyboard: tab order = board menu → display controls → settings → canvas content (toolbars first)',
  order[0] === 'chip chip--button' && order.indexOf('empty-template') > order.indexOf('icon-button'), order.join(' > '));

// 건너뛰기 → 독 → 위젯 추가 → 프레임 조작
await evaluate(`document.getElementById('skip-to-dock').focus()`);
await enter();
check('keyboard: skip link moves focus to first dock item', await activeIs('.dock__item'));
await enter();
await sleep(300);
check('keyboard: Enter on dock item adds widget and focuses its frame', await activeIs('.widget[data-type="timer"]'));
check('a11y: widget frame describes keyboard controls', (await evaluate(`document.getElementById(document.activeElement.getAttribute('aria-describedby'))?.textContent ?? ''`)).includes('Delete'));
await key('ArrowRight', 'ArrowRight', 39);
await key('ArrowRight', 'ArrowRight', 39);
await sleep(600);
check('live: keyboard move announces position', /타이머: 가로 \d+%, 세로 \d+%/.test(await announcer()), await announcer());
await key('ArrowDown', 'ArrowDown', 40, 1 /* Alt */);
await sleep(600);
check('live: Alt+arrow resize announces size', /너비 \d+%, 높이 \d+%/.test(await announcer()), await announcer());
await tab();
await tab();
check('keyboard: Tab enters widget title bar buttons', await activeIs('.widget__settings, .widget__remove'));
await evaluate(`document.querySelector('${W('timer')} .widget__settings').focus()`);
await enter();
await sleep(200);
check('keyboard: settings panel opens with focus inside', await evaluate(`!!document.activeElement.closest('.w-panel')`));
await esc();
await sleep(150);
check('keyboard: Esc closes panel and returns focus to widget', (await activeIs(W('timer'))) && !(await evaluate(`!!document.querySelector('.w-panel')`)));
await key('Delete', 'Delete', 46);
await sleep(200);
check('keyboard: Delete removes widget, focus moves to canvas (not lost)', !(await evaluate(`!!document.querySelector('${W('timer')}')`)) && (await activeIs('#canvas')));
await key('z', 'KeyZ', 90, CTRL);
await sleep(200);
check('keyboard: Ctrl+Z restores it', await evaluate(`!!document.querySelector('${W('timer')}')`));

// 단축키 도움말
await evaluate(`document.getElementById('canvas').focus()`);
await key('?', 'Slash', 191, SHIFT);
await sleep(250);
check('shortcuts: ? opens help dialog with 8 rows', (await evaluate(`document.querySelectorAll('dialog[open] .shortcuts dt').length`)) === 8);
await shot('m6-shortcuts');
await esc();
await sleep(150);
check('shortcuts: Esc closes, focus back on canvas', !(await evaluate(`!!document.querySelector('dialog[open]')`)) && (await activeIs('#canvas')));
await click('#settings > summary');
await click('#shortcuts-open');
await sleep(250);
check('shortcuts: settings panel button opens the same dialog', (await evaluate(`document.querySelectorAll('dialog[open] .shortcuts dt').length`)) === 8);
await esc();
await evaluate(`document.querySelector('.widget').focus()`);
await click(`${W('timer')} .timer__display`).catch(() => {});
await evaluate(`(() => { const i = document.createElement('input'); i.id = 'tmp-input'; document.querySelector('${W('timer')} .widget__body').append(i); i.focus(); })()`);
await key('?', 'Slash', 191, SHIFT);
await sleep(200);
check('shortcuts: ? while typing does not open help', !(await evaluate(`!!document.querySelector('dialog[open]')`)));
await evaluate(`document.getElementById('tmp-input')?.remove()`);

// 대화상자 닫은 뒤 포커스 복귀
await click('#board-menu > summary');
await click('#board-menu [data-action="rename"]');
await sleep(200);
await esc();
await sleep(200);
check('focus: closing a menu dialog returns focus to the board menu button', await activeIs('#board-menu > summary'));
await click('#board-menu > summary');
await click('#board-menu [data-action="template"]');
await sleep(300);
await esc();
await sleep(200);
check('focus: closing template dialog returns focus to board menu button', await activeIs('#board-menu > summary'));
await evaluate(`document.querySelector('#board-menu').open = false`);

// ═════════ 3. 포커스 링·가림 ═════════

const ringOk = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return 'missing'; e.focus(); const s = getComputedStyle(e); return parseFloat(s.outlineWidth) >= 2 && s.outlineStyle !== 'none' ? 'ok' : s.outlineWidth + ' ' + s.outlineStyle; })()`);
// :focus-visible은 키보드 포커스에서만 → Tab으로 한 번 이동한 뒤 검사
await evaluate(`document.body.focus()`);
await tab();
const rings = {};
for (const sel of ['#board-menu > summary', '#undo-button', '#settings > summary', '.dock__item', '.dock__toggle', W('timer'), `${W('timer')} .widget__remove`, `${W('timer')} .w-btn--primary`]) rings[sel] = await ringOk(sel);
check('focus: visible 2px+ ring on toolbar, dock, widget frame and widget buttons', Object.values(rings).every((v) => v === 'ok'), JSON.stringify(rings));
check('focus: ring has a surface-colored halo (contrast on any background)', await evaluate(`(() => { const e = document.querySelector('${W('timer')} .widget__remove'); e.focus(); return getComputedStyle(e).boxShadow.includes('0px 0px 0px 2px'); })()`));

await click('.dock__item[data-type="text"]');
await placeWidgets({ timer: { r: [0.35, 0.09, 0.3, 0.3] }, text: { r: [0.05, 0.5, 0.3, 0.25] } });
await click(`${W('text')} .widget__remove`);
await evaluate(`document.querySelector('${W('timer')}').focus()`);
await sleep(200);
check('focus: notice that would cover the focused widget moves down (WCAG 2.4.11)', await evaluate(`document.getElementById('notices').classList.contains('notices--low')`));
await shot('m6-notice-low');
await evaluate(`document.querySelectorAll('.notice').forEach(n => n.remove())`);
await sleep(100);
check('focus: notices return to top when gone', !(await evaluate(`document.getElementById('notices').classList.contains('notices--low')`)));

// ═════════ 4. 낭독기 알림 (live region 정책) ═════════

await clearBoard();
for (const t of ['randomizer', 'scoreboard', 'dice', 'groups']) await click(`.dock__item[data-type="${t}"]`);
const names = ['김민수', '이서연', '박지호', '최하은'];
await placeWidgets({
  randomizer: { r: [0.02, 0.1, 0.3, 0.4], state: { items: names, picked: [], history: [] } },
  scoreboard: { r: [0.35, 0.1, 0.4, 0.38] },
  dice: { r: [0.02, 0.55, 0.3, 0.3] },
  groups: { r: [0.35, 0.52, 0.4, 0.34], state: { items: names, n: 2, result: [] } },
});
const live = (t) => evaluate(`[...document.querySelectorAll('${W(t)} [aria-live]')].map(e => e.textContent).join('|')`);
check('live: no live region announces during idle (results are not live)', (await live('randomizer')) === '' && !(await evaluate(`!!document.querySelector('${W('randomizer')} .randomizer__result[aria-live]')`)));
await click(`${W('randomizer')} .w-btn--primary`);
await sleep(300);
const duringSpin = await live('randomizer');
await sleep(1800);
const afterSpin = await live('randomizer');
check('live: randomizer announces only the final pick', duringSpin === '' && /^뽑힌 사람: (김민수|이서연|박지호|최하은)$/.test(afterSpin), `${duringSpin} → ${afterSpin}`);
await click(`${W('scoreboard')} [aria-label="1팀 1점 올리기"]`);
await sleep(200);
check('live: scoreboard announces team and score', (await live('scoreboard')) === '1팀 1점', await live('scoreboard'));
await click(`${W('dice')} .w-btn--primary`);
await sleep(300);
const diceDuring = await live('dice');
await sleep(900);
check('live: dice announces values and total after the roll', diceDuring === '' && /^주사위 \d, \d, 합계 \d+$/.test(await live('dice')), `${diceDuring} → ${await live('dice')}`);
await click(`${W('groups')} .w-empty .w-btn`);
await sleep(200);
check('live: groups announces the summary after making groups', /4명 · 2개 모둠/.test(await live('groups')), await live('groups'));
check('a11y: groups grid is keyboard-scrollable (focusable group with name)', await evaluate(`(() => { const g = document.querySelector('${W('groups')} .groups__grid'); return g.tabIndex === 0 && !!g.getAttribute('aria-label'); })()`));
await cdp('Page.reload');
await ready();
await sleep(400);
check('live: nothing is announced on page load', (await evaluate(`[...document.querySelectorAll('.widget [aria-live]')].map(e => e.textContent).join('')`)) === '');

// ═════════ 5. 강제 색상·움직임 줄이기·200% 확대 ═════════

await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
await sleep(300);
check('forced colors: media active, widget border uses system color', await evaluate(`matchMedia('(forced-colors: active)').matches && getComputedStyle(document.querySelector('.widget')).borderTopWidth === '2px'`));
check('forced colors: team colors kept on color swatches (forced-color-adjust: none)', await evaluate(`(() => { document.querySelector('#board-menu').open = true; const s = document.querySelector('.swatch:nth-child(2)'); const v = getComputedStyle(s).forcedColorAdjust; document.querySelector('#board-menu').open = false; return v === 'none'; })()`));
await shot('m6-forced-colors');
await cdp('Emulation.setEmulatedMedia', { features: [] });

await clearBoard();
await click('.dock__item[data-type="timer"]');
await placeWidgets({ timer: { r: [0.3, 0.2, 0.3, 0.4], state: { status: 'done', durationMs: 60000 } } });
await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await sleep(200);
const anim = await evaluate(`(() => { const s = getComputedStyle(document.querySelector('${W('timer')} .timer__display')); return s.animationIterationCount + ' ' + s.animationDuration; })()`);
check('reduced motion: timer "done" blink runs once, never flickers', anim.startsWith('1 '), anim);
await cdp('Emulation.setEmulatedMedia', { features: [] });

await viewport(640, 450);
await sleep(300);
const zoom = await evaluate(`(() => {
  const vw = innerWidth, r = (s) => document.querySelector(s).getBoundingClientRect();
  const start = r('.toolbar--start'), end = r('.toolbar--end'), dock = r('#dock');
  return { overlap: start.right > end.left, dockInside: dock.left >= 0 && dock.right <= vw, noHScroll: document.documentElement.scrollWidth <= vw };
})()`);
check('zoom 200% (640×450): toolbars do not overlap, dock and page fit horizontally', !zoom.overlap && zoom.dockInside && zoom.noHScroll, JSON.stringify(zoom));
await click('#board-menu > summary');
check('zoom 200%: board menu fits in the viewport (scrolls inside)', await evaluate(`(() => { const p = document.querySelector('#board-menu .popover__panel').getBoundingClientRect(); return p.left >= 0 && p.right <= innerWidth && p.bottom <= innerHeight; })()`));
await evaluate(`document.querySelector('#board-menu').open = false`);
await key('?', 'Slash', 191, SHIFT);
await sleep(200);
check('zoom 200%: dialogs fit the viewport', await evaluate(`(() => { const d = document.querySelector('dialog[open]').getBoundingClientRect(); return d.left >= 0 && d.right <= innerWidth && d.height <= innerHeight; })()`));
await shot('m6-zoom-200');
await esc();
await viewport(1440, 900);

// ═════════ 6. 활동 상징 (F-115) ═════════

await clearBoard();
await click('.dock__item[data-type="symbols"]');
await sleep(300);
let board = await savedBoard();
check('symbols: added with default "quiet" and Korean caption', board.widgets[0]?.state.symbol === 'quiet' && (await evaluate(`document.querySelector('${W('symbols')} .symbols__label').textContent`)) === '조용히');
check('symbols: face button has descriptive name', (await evaluate(`document.querySelector('${W('symbols')} .symbols__face').getAttribute('aria-label')`)) === '상징 바꾸기 (지금: 조용히)');
const labelPx = await evaluate(`parseFloat(getComputedStyle(document.querySelector('${W('symbols')} .symbols__label')).fontSize)`);
check('symbols: caption readable from afar (≥ 18px at default size)', labelPx >= 18, `${labelPx}px`);
await click(`${W('symbols')} .symbols__face`);
await sleep(250);
check('symbols: picker opens with focus on current symbol', await activeIs('.symbols__option[data-symbol="quiet"]'));
const cols = await evaluate(`getComputedStyle(document.querySelector('.symbols__grid')).gridTemplateColumns.split(' ').length`);
await key('ArrowRight', 'ArrowRight', 39);
await key('ArrowDown', 'ArrowDown', 40);
const expected = ['quiet', 'raise-hand', 'listen', 'solo', 'pair', 'group', 'write', 'read', 'present', 'think', 'tidy', 'break'][1 + cols];
check('symbols: arrow keys move through the grid (roving focus)', await activeIs(`.symbols__option[data-symbol="${expected}"]`), `${cols} cols → ${expected}`);
await enter();
await sleep(300);
board = await savedBoard();
check('symbols: Enter selects, panel closes, caption updates', board.widgets[0].state.symbol === expected && !(await evaluate(`!!document.querySelector('.w-panel')`)));
check('live: symbol change announced', (await evaluate(`document.querySelector('${W('symbols')} [aria-live]').textContent`)).length > 0);
await click(`${W('symbols')} .widget__settings`);
await sleep(200);
await click(`${W('symbols')} .w-panel input`);
await type('발표 준비');
await click(`${W('symbols')} .w-panel__header .w-btn`);
board = await savedBoard();
check('symbols: custom caption saved and shown', board.widgets[0].state.label === '발표 준비' && (await evaluate(`document.querySelector('${W('symbols')} .symbols__label').textContent`)) === '발표 준비');
await cdp('Page.reload');
await ready();
check('symbols: survives reload', (await evaluate(`document.querySelector('${W('symbols')} .symbols__label').textContent`)) === '발표 준비');
await setLocale('en');
await sleep(300);
await placeWidgets({ symbols: { r: [0.3, 0.2, 0.22, 0.42], state: { symbol: 'break', label: '' } } });
check('symbols: English default caption', (await evaluate(`document.querySelector('${W('symbols')} .symbols__label').textContent`)) === 'Break time');
await setLocale('ko');
await shot('m6-symbols');

// ═════════ 7. 위젯 모양 ═════════

await click('.dock__item[data-type="timer"]');
await click('#board-menu > summary');
await click('#widget-style [data-look="glass"]');
await click('#widget-style [data-accent="teal"]');
await evaluate(`document.querySelector('#board-menu').open = false`);
board = await savedBoard();
check('style: glass + teal saved on the board', board.widgetStyle?.look === 'glass' && board.widgetStyle?.accent === 'teal');
check('style: applied to canvas and widgets (accent top bar)', await evaluate(`(() => { const c = document.getElementById('canvas'); const w = document.querySelector('.widget'); return c.dataset.look === 'glass' && c.dataset.accent === 'teal' && getComputedStyle(w).borderTopWidth === '5px'; })()`));
check('style: menu buttons expose state (aria-pressed)', await evaluate(`document.querySelector('#widget-style [data-accent="teal"]').getAttribute('aria-pressed') === 'true' && document.querySelector('#widget-style [data-look="glass"]').getAttribute('aria-pressed') === 'true'`));
await shot('m6-style-glass-teal');
await cdp('Page.reload');
await ready();
check('style: survives reload', await evaluate(`document.getElementById('canvas').dataset.look === 'glass'`));
await click('#board-menu > summary');
await click('#widget-style [data-look="outline"]');
await evaluate(`document.querySelector('#board-menu').open = false; document.getElementById('canvas').focus()`);
await key('z', 'KeyZ', 90, CTRL);
board = await savedBoard();
check('style: change can be undone', board.widgetStyle?.look === 'glass');
await setTheme('contrast');
await sleep(300);
check('style: ignored in high-contrast theme', await evaluate(`getComputedStyle(document.querySelector('.widget')).borderTopWidth !== '5px'`));
await setTheme('light');

// 공유 링크에 그대로
await click('#board-menu > summary');
await click('#board-menu [data-action="share"]');
let link = '';
for (let i = 0; i < 30 && !link; i += 1) { link = await evaluate(`document.getElementById('share-link')?.value ?? ''`); await sleep(100); }
await esc();
await cdp('Page.navigate', { url: link });
for (let i = 0; i < 30 && !(await evaluate(`!!document.querySelector('dialog[open]')`)); i += 1) await sleep(100);
await click('dialog[open] .button--primary');
board = await savedBoard();
check('style: share link carries widget style', board.widgetStyle?.look === 'glass' && board.widgetStyle?.accent === 'teal');

// ═════════ 8. M4 이월: 사진 배경 위 안내 문구, 시스템 테마 전환 시 그리기 색 ═════════

const IMG_DIR = join(OUT_DIR, 'm6-images');
mkdirSync(IMG_DIR, { recursive: true });
const PHOTO = join(IMG_DIR, 'busy.png');
writeFileSync(PHOTO, makePng(400, 300, (x, y) => ((x >> 4) + (y >> 4)) % 2 ? [20, 20, 20] : [240, 240, 240]));
await clearBoard();
{
  const { root } = await cdp('DOM.getDocument', { depth: -1, pierce: false });
  const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: '#background-file' });
  await cdp('DOM.setFileInputFiles', { nodeId, files: [PHOTO] });
  await sleep(1200);
}
const chip = await evaluate(`(() => { const t = document.querySelector('.canvas__empty-title'); const s = getComputedStyle(t); return { image: document.getElementById('canvas').hasAttribute('data-image'), bg: s.backgroundColor, color: s.color }; })()`);
check('image background: empty-state text sits on a theme-colored panel', chip.image && chip.bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(chip));
await shot('m6-image-empty-state');

await clearBoard();
await setTheme('system');
await click('.dock__item[data-type="draw"]');
await placeWidgets({ draw: { r: [0.3, 0.2, 0.4, 0.5], state: { strokes: [{ c: 'ink', w: 'l', p: [0, 5000, 10000, 5000] }], aspect: 1.5 } } });
const inkPixel = () => evaluate(`(() => { const c = document.querySelector('${W('draw')} canvas'); const g = c.getContext('2d'); const d = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data; return d[0] + d[1] + d[2]; })()`);
await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await sleep(300);
const lightInk = await inkPixel();
await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await sleep(300);
const darkInk = await inkPixel();
check('draw: "ink" strokes redraw when the OS switches dark mode (system theme)', lightInk < 200 && darkInk > 500, `light ${lightInk} → dark ${darkInk}`);
await cdp('Emulation.setEmulatedMedia', { features: [] });
await setTheme('light');

b.finish();
