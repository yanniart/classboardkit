// M1 E2E: 캔버스·보드 관리 (드래그·리사이즈·키보드·터치·보드 CRUD·복원)
// 실행: 정적 서버를 띄운 뒤 `node tools/e2e/m1.mjs`
import { APP_URL, launch, sleep } from './harness.mjs';

const b = await launch({ lang: 'ko' });
const { cdp, evaluate, click, drag, touchDrag, key, shot, viewport, saved, settings, check } = b;

await viewport(1280, 800);
await cdp('Page.navigate', { url: APP_URL });
await sleep(1200);

// 1. 초기 상태
check('empty state visible', await evaluate(`!document.getElementById('canvas-empty').hidden`));
check('dock has 8 widget buttons', (await evaluate(`document.querySelectorAll('.dock__item').length`)) === 8);

// 2. 위젯 추가 (독 클릭)
await click('.dock__item[data-type="timer"]');
await click('.dock__item[data-type="text"]');
let boards = await saved();
await sleep(700);
boards = await saved();
check('2 widgets added & saved', boards[0].widgets.length === 2, JSON.stringify(boards[0].widgets.map((w) => w.type)));
check('empty state hidden', await evaluate(`document.getElementById('canvas-empty').hidden`));
check('new widget focused', await evaluate(`document.activeElement?.dataset?.type === 'text'`));

// 3. 마우스 드래그 이동
const timerBefore = boards[0].widgets.find((w) => w.type === 'timer');
await drag('.widget[data-type="timer"] .widget__bar', -256, -160);
await sleep(700);
boards = await saved();
const timerAfter = boards[0].widgets.find((w) => w.type === 'timer');
check('mouse drag moves widget', Math.abs(timerAfter.x - (timerBefore.x - 0.2)) < 0.005 && Math.abs(timerAfter.y - (timerBefore.y - 0.2)) < 0.005,
  `${timerBefore.x},${timerBefore.y} → ${timerAfter.x},${timerAfter.y}`);
check('dragged widget brought to front', timerAfter.z > boards[0].widgets.find((w) => w.type === 'text').z);

// 4. 크기 조절
const textBefore = boards[0].widgets.find((w) => w.type === 'text');
await drag('.widget[data-type="text"] .widget__resize', 128, 80);
await sleep(700);
boards = await saved();
const textAfter = boards[0].widgets.find((w) => w.type === 'text');
check('resize grows widget', Math.abs(textAfter.w - (textBefore.w + 0.1)) < 0.005 && Math.abs(textAfter.h - (textBefore.h + 0.1)) < 0.005,
  `${textBefore.w}x${textBefore.h} → ${textAfter.w}x${textAfter.h}`);
await drag('.widget[data-type="text"] .widget__resize', -2000, -2000);
await sleep(700);
boards = await saved();
const textMin = boards[0].widgets.find((w) => w.type === 'text');
check('resize respects minSize', textMin.w === 0.12 && textMin.h === 0.1, `${textMin.w}x${textMin.h}`);
await drag('.widget[data-type="text"] .widget__resize', 300, 150);

// 5. 텍스트 입력
await click('.text-widget__input');
await cdp('Input.insertText', { text: '모둠 활동 15분' });
await sleep(700);
boards = await saved();
check('text typed & saved', boards[0].widgets.find((w) => w.type === 'text').state.content === '모둠 활동 15분');

await click('.widget[data-type="text"] .text-widget__tool[aria-label="글자 크게"]');
await sleep(600);
boards = await saved();
check('text size up', boards[0].widgets.find((w) => w.type === 'text').state.size === 'l');

// 6. 타이머: +1분, 시작, 진행
await click('.widget[data-type="timer"] .timer__adjust button:nth-child(4)');
await click('.widget[data-type="timer"] .w-btn--primary');
await sleep(2300);
const display = await evaluate(`document.querySelector('.timer__display').textContent`);
check('timer counts down from 06:00', ['05:57', '05:58'].includes(display), display);
boards = await saved();
const timerState = boards[0].widgets.find((w) => w.type === 'timer').state;
check('running timer saved with endAt', timerState.status === 'running' && typeof timerState.endAt === 'number');

// 7. 키보드: 프레임 포커스 후 화살표 이동, Alt+화살표 크기
await evaluate(`document.querySelector('.widget[data-type="timer"]').focus()`);
const kbBefore = (await saved())[0].widgets.find((w) => w.type === 'timer');
await key('ArrowRight', 'ArrowRight', 39);
await key('ArrowDown', 'ArrowDown', 40, 8); // Shift
await key('ArrowRight', 'ArrowRight', 39, 1); // Alt
await sleep(700);
const kbAfter = (await saved())[0].widgets.find((w) => w.type === 'timer');
check('keyboard move/resize', Math.abs(kbAfter.x - kbBefore.x - 0.01) < 1e-6 && Math.abs(kbAfter.y - kbBefore.y - 0.05) < 1e-6 && Math.abs(kbAfter.w - kbBefore.w - 0.01) < 1e-6,
  `x ${kbBefore.x}→${kbAfter.x}, y ${kbBefore.y}→${kbAfter.y}, w ${kbBefore.w}→${kbAfter.w}`);

// 8. 배경 변경
await click('#board-menu > summary');
check('board menu opens', await evaluate(`document.getElementById('board-menu').open`));
await click('.swatch[aria-label="숲"]');
await sleep(600);
check('background saved', JSON.stringify((await saved())[0].background) === '{"type":"gradient","value":"forest"}');
await shot('m1-desktop');

// 9. 새 보드 → 이름 변경 → 원래 보드로 전환
await click('[data-action="new"]');
await sleep(600);
boards = await saved();
check('new board created & active', boards.length === 2 && (await settings()).activeBoardId === boards[1].id, boards.map((b) => b.name).join(','));
check('new board empty state', await evaluate(`!document.getElementById('canvas-empty').hidden && document.querySelectorAll('.widget').length === 0`));
await click('#board-menu > summary');
await click('[data-action="rename"]');
check('rename dialog open', await evaluate(`!!document.querySelector('dialog.dialog[open]')`));
await cdp('Input.insertText', { text: '금요일 3교시' });
await key('Enter', 'Enter', 13);
await sleep(600);
boards = await saved();
check('board renamed', boards[1].name === '금요일 3교시', boards[1].name);
check('chip shows name', (await evaluate(`document.getElementById('board-name').textContent`)) === '금요일 3교시');

// 10. 복제
await click('#board-menu > summary');
await click('.board-menu__item:first-child');
await sleep(300);
await click('#board-menu > summary');
await click('[data-action="duplicate"]');
await sleep(600);
boards = await saved();
check('duplicate inserted after source', boards.length === 3 && boards[1].widgets.length === 2 && boards[1].name.includes('사본'), boards.map((b) => b.name).join(','));

// 11. 삭제 (취소 → 확인)
await click('#board-menu > summary');
await click('[data-action="delete"]');
await click('dialog .button:not(.button--danger)');
check('delete cancelled', (await saved()).length === 3);
await click('#board-menu > summary');
await click('[data-action="delete"]');
await click('dialog .button--danger');
await sleep(600);
boards = await saved();
check('board deleted', boards.length === 2 && !boards.some((b) => b.name.includes('사본')));

// 12. 원래 보드로 전환 후 새로고침 → 복원
await click('#board-menu > summary');
await click('.board-menu__item:first-child');
await sleep(600);
await cdp('Page.reload');
await sleep(1500);
check('widgets restored after reload', (await evaluate(`document.querySelectorAll('.widget').length`)) === 2);
check('text restored', (await evaluate(`document.querySelector('.text-widget__input').value`)) === '모둠 활동 15분');
const afterReload = await evaluate(`document.querySelector('.timer__display').textContent`);
check('running timer continues after reload', /^05:[0-5]\d$/.test(afterReload) && afterReload < '05:57', afterReload);
check('background restored', (await evaluate(`document.getElementById('canvas').style.background`)).includes('gradient'));

// 13. 위젯 삭제 버튼
await click('.widget[data-type="text"] .widget__remove');
await sleep(600);
check('widget removed', (await saved())[0].widgets.length === 1);

// 14. 독 접기
await click('.dock__toggle');
await sleep(400);
check('dock collapsed & saved', (await settings()).dockCollapsed === true && (await evaluate(`document.querySelector('.dock__items').hidden`)));
await click('.dock__toggle');

// 15. 언어 전환 → 위젯 다시 마운트, 문구 영어
await evaluate(`(() => { const s = document.getElementById('setting-locale'); s.value = 'en'; s.dispatchEvent(new Event('change')); })()`);
await sleep(300);
check('locale switch updates widget text', (await evaluate(`document.querySelector('.widget__title').textContent`)) === 'Timer');
check('timer survives locale switch', (await evaluate(`document.querySelector('.timer').dataset.status`)) === 'running');

// 16. 태블릿(터치) — 세로 820x1180
await viewport(820, 1180, true);
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await click('.dock__item[data-type="text"]');
await sleep(600);
const touchBefore = (await saved())[0].widgets.find((w) => w.type === 'text');
await touchDrag('.widget[data-type="text"] .widget__bar', 82, 118);
await sleep(700);
const touchAfter = (await saved())[0].widgets.find((w) => w.type === 'text');
check('touch drag moves widget', Math.abs(touchAfter.x - touchBefore.x - 0.1) < 0.005 && Math.abs(touchAfter.y - touchBefore.y - 0.1) < 0.005,
  `${touchBefore.x},${touchBefore.y} → ${touchAfter.x},${touchAfter.y}`);
await shot('m1-tablet');

// 17. 다크 테마 스크린샷
await viewport(1280, 800);
await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
await evaluate(`(() => { const s = document.getElementById('setting-theme'); s.value = 'dark'; s.dispatchEvent(new Event('change')); })()`);
await click('#board-menu > summary');
await click('.swatch[aria-label="Default"]');
await key('Escape', 'Escape', 27);
await sleep(300);
await shot('m1-dark');

b.finish();
