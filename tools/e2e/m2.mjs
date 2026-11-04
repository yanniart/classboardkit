// M2 E2E: 위젯 8종 실제 조작 검증 (설정 패널·뽑기·편성·점수·복원·언어)
// 실행: 정적 서버를 띄운 뒤 `node tools/e2e/m2.mjs`
import { APP_URL, launch, sleep } from './harness.mjs';

const b = await launch({ lang: 'ko' });
const { evaluate, click, type, check, shot, viewport, cdp, key, saved } = b;

const widget = async (type) => (await saved())[0].widgets.find((w) => w.type === type);
const W = (t) => `.widget[data-type="${t}"]`;
const SAVE_WAIT = 650;

await viewport(1440, 900);
await cdp('Page.navigate', { url: APP_URL });
await sleep(1200);

// 1. 독에서 8종 추가
const types = await evaluate(`[...document.querySelectorAll('.dock__item')].map(b => b.dataset.type)`);
check('dock lists 8 widgets in order', types.join(',') === 'timer,stopwatch,clock,randomizer,groups,scoreboard,traffic,text', types.join(','));
for (const t of types) await click(`.dock__item[data-type="${t}"]`);
await sleep(SAVE_WAIT);
check('8 widgets added', (await saved())[0].widgets.length === 8);

// 2. 겹치지 않게 배치한 뒤 새로고침 (저장된 데이터 직접 수정)
const layout = {
  timer: [0.01, 0.08, 0.24, 0.42], stopwatch: [0.26, 0.08, 0.22, 0.42], clock: [0.49, 0.08, 0.2, 0.42],
  traffic: [0.7, 0.08, 0.12, 0.42], text: [0.83, 0.08, 0.16, 0.42],
  randomizer: [0.01, 0.52, 0.24, 0.37], groups: [0.26, 0.52, 0.4, 0.37], scoreboard: [0.67, 0.52, 0.32, 0.37],
};
await evaluate(`(() => {
  const L = ${JSON.stringify(layout)};
  const boards = JSON.parse(localStorage.getItem('classboardkit:v1:boards'));
  boards[0].widgets = boards[0].widgets.map(w => { const [x, y, ww, hh] = L[w.type]; return { ...w, x, y, w: ww, h: hh }; });
  localStorage.setItem('classboardkit:v1:boards', JSON.stringify(boards));
})()`);
await cdp('Page.reload');
await sleep(1200);
check('layout applied after reload', (await widget('groups')).w === 0.4);

const gears = await evaluate(`[...document.querySelectorAll('.widget')].filter(w => w.querySelector('.widget__settings')).map(w => w.dataset.type).sort().join(',')`);
check('settings button on 7 widgets (not stopwatch)', gears === 'clock,groups,randomizer,scoreboard,text,timer,traffic', gears);

// 3. 타이머: 빠른 설정 1분 → 원형 모드
await click(`${W('timer')} .widget__settings`);
check('timer settings panel opens', await evaluate(`!!document.querySelector('${W('timer')} .w-panel')`));
await click(`${W('timer')} .w-panel .w-seg .w-btn:first-child`); // 1분
await sleep(SAVE_WAIT);
check('timer preset 1 min (panel closes)', (await widget('timer')).state.durationMs === 60000 && !(await evaluate(`!!document.querySelector('${W('timer')} .w-panel')`)));
check('timer display 01:00', (await evaluate(`document.querySelector('${W('timer')} .timer__display').textContent`)) === '01:00');
await click(`${W('timer')} .widget__settings`);
await click(`${W('timer')} .w-panel .w-seg__opt:nth-child(2)`); // 원형
await click(`${W('timer')} .w-panel__header .w-btn`); // 완료
await sleep(SAVE_WAIT);
check('timer visual mode', (await widget('timer')).state.mode === 'visual' &&
  (await evaluate(`getComputedStyle(document.querySelector('${W('timer')} .timer__ring')).display`)) === 'block');
await click(`${W('timer')} .w-btn--primary`);
await sleep(1500);
const offset = Number(await evaluate(`document.querySelector('${W('timer')} .timer__ring-value').getAttribute('stroke-dashoffset')`));
check('timer ring shrinks while running', offset > 0.5 && offset < 5, String(offset));

// 4. 스톱워치: 시작 → 랩 → 정지
await click(`${W('stopwatch')} .w-btn--primary`);
await sleep(1200);
await click(`${W('stopwatch')} .w-btn:nth-child(2)`); // 랩
await sleep(300);
await click(`${W('stopwatch')} .w-btn--primary`); // 정지
await sleep(SAVE_WAIT);
const sw = await widget('stopwatch');
check('stopwatch elapsed & lap', sw.state.status === 'paused' && sw.state.elapsedMs > 1300 && sw.state.laps.length === 1,
  `${sw.state.elapsedMs}ms, laps ${sw.state.laps}`);
check('stopwatch lap list rendered', (await evaluate(`document.querySelectorAll('${W('stopwatch')} .stopwatch__lap').length`)) === 1);

// 5. 시계: 아날로그 + 12시간
await click(`${W('clock')} .widget__settings`);
await click(`${W('clock')} .w-panel .w-seg__opt:nth-child(2)`);
await click(`${W('clock')} .w-panel .w-toggle:nth-of-type(1) input`);
await click(`${W('clock')} .w-panel__header .w-btn`);
await sleep(SAVE_WAIT);
const clock = await widget('clock');
check('clock analog + 12h saved', clock.state.style === 'analog' && clock.state.hour12 === true, JSON.stringify(clock.state));
check('clock analog face visible', (await evaluate(`getComputedStyle(document.querySelector('${W('clock')} .clock__face')).display`)) === 'block');

// 6. 랜덤 뽑기: 빈 상태 → 명단 입력 → 3번 뽑기 → 모두 뽑음
check('randomizer empty state', await evaluate(`!document.querySelector('${W('randomizer')} .w-empty').hidden`));
await click(`${W('randomizer')} .w-empty .w-btn`);
await click(`${W('randomizer')} .w-textarea`);
await type('김민수\n이서연\n박지호\n김민수');
await sleep(SAVE_WAIT);
check('randomizer names parsed (dup removed)', (await widget('randomizer')).state.items.join(',') === '김민수,이서연,박지호');
await click(`${W('randomizer')} .w-panel__header .w-btn`);
const picks = [];
for (let i = 0; i < 3; i += 1) {
  await click(`${W('randomizer')} .w-btn--primary`);
  await sleep(1200);
  picks.push(await evaluate(`document.querySelector('${W('randomizer')} .randomizer__result').textContent`));
}
check('3 picks are all different', new Set(picks).size === 3, picks.join(','));
check('pick disabled when all picked', await evaluate(`document.querySelector('${W('randomizer')} .w-btn--primary').disabled`));
check('all-picked message', (await evaluate(`document.querySelector('${W('randomizer')} .randomizer__meta').textContent`)) === '모두 뽑았어요');
await click(`${W('randomizer')} .w-row .w-btn:nth-child(2)`); // 처음부터
await sleep(SAVE_WAIT);
check('reset picked', (await widget('randomizer')).state.picked.length === 0);

// 7. 모둠 편성: 10명 → 4모둠 → 모둠당 3명으로 변경
await click(`${W('groups')} .w-empty .w-btn`);
await click(`${W('groups')} .w-textarea`);
await type(Array.from({ length: 10 }, (_, i) => `학생${i + 1}`).join('\n'));
await click(`${W('groups')} .w-panel__header .w-btn`);
await sleep(200);
await click(`${W('groups')} .w-empty .w-btn`); // 모둠 만들기
await sleep(SAVE_WAIT);
let g = (await widget('groups')).state;
check('4 groups of 10', g.result.length === 4 && g.result.flat().length === 10, g.result.map((x) => x.length).join('/'));
check('group cards rendered', (await evaluate(`document.querySelectorAll('${W('groups')} .groups__card').length`)) === 4);
await click(`${W('groups')} .widget__settings`);
await click(`${W('groups')} .w-panel .w-seg__opt:nth-child(2)`); // 모둠당 인원
await click(`${W('groups')} .w-panel .w-stepper .w-btn:first-child`); // 4 → 3
await click(`${W('groups')} .w-panel__header .w-btn`);
await click(`${W('groups')} .w-empty .w-btn`);
await sleep(SAVE_WAIT);
g = (await widget('groups')).state;
check('size mode: max 3 per group', g.by === 'size' && g.n === 3 && g.result.length === 4 && Math.max(...g.result.map((x) => x.length)) === 3,
  `${g.by} ${g.n}: ${g.result.map((x) => x.length).join('/')}`);
check('still 8 widgets (no stray clicks)', (await saved())[0].widgets.length === 8);

// 8. 점수판: +1 두 번, 팀 3개, 이름 변경
await click(`${W('scoreboard')} .scoreboard__team:first-child .w-btn--primary`);
await click(`${W('scoreboard')} .scoreboard__team:first-child .w-btn--primary`);
await sleep(SAVE_WAIT);
check('team 1 score 2 & leader', (await widget('scoreboard')).state.teams[0].score === 2 &&
  (await evaluate(`document.querySelector('${W('scoreboard')} .scoreboard__team:first-child').classList.contains('is-leader')`)));
await click(`${W('scoreboard')} .widget__settings`);
await click(`${W('scoreboard')} .w-panel .w-stepper .w-btn:last-child`);
await click(`${W('scoreboard')} .w-panel .w-input`);
await type('호랑이');
await click(`${W('scoreboard')} .w-panel__header .w-btn`);
await sleep(SAVE_WAIT);
const sb = (await widget('scoreboard')).state;
check('3 teams, team 1 renamed', sb.teams.length === 3 && sb.teams[0].name === '호랑이', sb.teams.map((t) => t.name || '-').join(','));
check('team names shown', (await evaluate(`[...document.querySelectorAll('${W('scoreboard')} .scoreboard__name')].map(n => n.textContent).join(',')`)) === '호랑이,2팀,3팀');

// 9. 신호등
await click(`${W('traffic')} .traffic__lamp[data-light="green"]`);
await sleep(SAVE_WAIT);
check('traffic green + default label', (await widget('traffic')).state.light === 'green' &&
  (await evaluate(`document.querySelector('${W('traffic')} .traffic__label').textContent`)) === '자유롭게 대화');

// 10. 텍스트 색
await click(`${W('text')} .text-widget__input`);
await type('발표 준비');
await click(`${W('text')} .widget__settings`);
await click(`${W('text')} .w-panel .w-color:nth-child(2)`); // 빨강
await click(`${W('text')} .w-panel__header .w-btn`);
await sleep(SAVE_WAIT);
check('text colour red', (await widget('text')).state.color === 'red');

// 11. Esc로 설정 패널 닫기
await click(`${W('clock')} .widget__settings`);
await key('Escape', 'Escape', 27);
check('Esc closes settings panel', !(await evaluate(`!!document.querySelector('${W('clock')} .w-panel')`)));

// 12. 새로고침 후 전부 복원
await shot('m2-desktop-ko');
await cdp('Page.reload');
await sleep(1500);
check('8 widgets restored', (await evaluate(`document.querySelectorAll('.widget').length`)) === 8);
check('groups restored', (await evaluate(`document.querySelectorAll('${W('groups')} .groups__card').length`)) === 4);
check('scoreboard restored', (await evaluate(`document.querySelector('${W('scoreboard')} .scoreboard__score').textContent`)) === '2');
check('timer still running after reload', (await evaluate(`document.querySelector('${W('timer')} .timer').dataset.status`)) === 'running');

// 13. 영어 전환
await evaluate(`(() => { const s = document.getElementById('setting-locale'); s.value = 'en'; s.dispatchEvent(new Event('change')); })()`);
await sleep(300);
check('English titles', (await evaluate(`[...document.querySelectorAll('.widget__title')].map(t => t.textContent).join(',')`)).includes('Group maker'));
check('English default team names', (await evaluate(`[...document.querySelectorAll('${W('scoreboard')} .scoreboard__name')].map(n => n.textContent).join(',')`)) === '호랑이,Team 2,Team 3');
await shot('m2-desktop-en');

// 14. 다크 테마 / 태블릿
await evaluate(`(() => { const s = document.getElementById('setting-theme'); s.value = 'dark'; s.dispatchEvent(new Event('change')); })()`);
await sleep(300);
await shot('m2-dark');
await viewport(1180, 820, true);
await sleep(300);
await shot('m2-tablet-landscape');

b.finish();
