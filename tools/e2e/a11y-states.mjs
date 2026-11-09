// 접근성 점검 상태 목록 (M6 계획 3-0). a11y-audit.mjs와 m6.mjs가 함께 쓴다.
// 각 상태를 화면에 만든 뒤 { name, include? }를 내보낸다 (include: 그 영역만 검사).
import { sleep } from './harness.mjs';

const BOARDS_KEY = 'classboardkit:v1:boards';

/** 위젯 14종을 겹치지 않는 5×3 격자로 (저장 데이터 직접 수정 후 새로고침) */
async function addAllWidgets(b) {
  const types = await b.evaluate(`[...document.querySelectorAll('.dock__item')].map(x => x.dataset.type)`);
  for (const t of types) await b.click(`.dock__item[data-type="${t}"]`);
  await sleep(700);
  await b.evaluate(`(() => {
    const boards = JSON.parse(localStorage.getItem('${BOARDS_KEY}'));
    const s = JSON.parse(localStorage.getItem('classboardkit:settings'));
    const bd = boards.find(x => x.id === s.activeBoardId);
    bd.widgets = bd.widgets.map((w, i) => ({ ...w, x: (i % 5) * 0.2, y: 0.09 + Math.floor(i / 5) * 0.255, w: 0.2, h: 0.245, z: i + 1 }));
    localStorage.setItem('${BOARDS_KEY}', JSON.stringify(boards));
  })()`);
  await b.cdp('Page.reload');
  await b.ready();
  return types;
}

/** 위젯 state를 실제 사용처럼 채운다 */
async function fillWidgets(b) {
  await sleep(700);
  await b.evaluate(`(() => {
    const names = ['김민수', '이서연', '박지호', '최하은', '정우진', '강도윤', '윤서아', '임하준'];
    const boards = JSON.parse(localStorage.getItem('${BOARDS_KEY}'));
    for (const bd of boards) for (const w of bd.widgets) {
      const s = w.state;
      if (w.type === 'randomizer') Object.assign(s, { items: names, picked: ['김민수'], history: ['김민수', '이서연'] });
      if (w.type === 'groups') Object.assign(s, { items: names, n: 4, result: [names.slice(0, 2), names.slice(2, 4), names.slice(4, 6), names.slice(6)] });
      if (w.type === 'scoreboard') s.teams = ['red', 'blue', 'green', 'orange', 'purple', 'teal', 'pink', 'yellow'].map((c, i) => ({ id: 't' + (i + 1), name: '', color: c, score: i * 3 }));
      if (w.type === 'text') Object.assign(s, { content: '오늘의 목표', color: 'red' });
      if (w.type === 'dice') s.values = [3, 5];
      if (w.type === 'qr') s.text = 'https://example.com';
      if (w.type === 'countdown') s.title = '체육대회';
      if (w.type === 'traffic') s.light = 'red';
    }
    localStorage.setItem('${BOARDS_KEY}', JSON.stringify(boards));
  })()`);
  await b.cdp('Page.reload');
  await b.ready();
  await sleep(500);
}

const setLocale = (b, v) => b.evaluate(`(() => { const s = document.getElementById('setting-locale'); s.value = '${v}'; s.dispatchEvent(new Event('change')); })()`);
const setTheme = (b, v) => b.evaluate(`(() => { const s = document.getElementById('setting-theme'); s.value = '${v}'; s.dispatchEvent(new Event('change')); })()`);
const closeAll = (b) => b.evaluate(`(() => { document.querySelectorAll('details[open]').forEach(d => d.open = false); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.notice').forEach(n => n.remove()); })()`);

/** @param {any} b 하네스 */
export async function* auditStates(b) {
  yield { name: 'empty board' };

  const types = await addAllWidgets(b);
  yield { name: '14 widgets' };

  // 내용이 채워진 위젯 (색·결과 문구까지 검사) — 테마 3종
  await fillWidgets(b);
  for (const theme of ['light', 'dark', 'contrast']) {
    await setTheme(b, theme);
    await sleep(300);
    yield { name: `filled widgets: ${theme}` };
  }
  await setTheme(b, 'light');
  for (const light of ['yellow', 'green']) {
    await b.click(`.widget[data-type="traffic"] .traffic__lamp[data-light="${light}"]`);
    yield { name: `traffic: ${light}`, include: '.widget[data-type="traffic"]' };
  }
  for (const color of ['blue', 'green', 'orange', 'purple']) {
    await b.evaluate(`(() => {
      const boards = JSON.parse(localStorage.getItem('${BOARDS_KEY}'));
      for (const bd of boards) for (const w of bd.widgets) if (w.type === 'text') w.state.color = '${color}';
      localStorage.setItem('${BOARDS_KEY}', JSON.stringify(boards));
    })()`);
    await b.cdp('Page.reload');
    await b.ready();
    yield { name: `text color: ${color}`, include: '.widget[data-type="text"]' };
  }

  // 위젯별 설정 패널
  for (const t of types) {
    const sel = `.widget[data-type="${t}"]`;
    const has = await b.evaluate(`!!document.querySelector('${sel} .widget__settings')`);
    if (!has) continue;
    await b.click(`${sel} .widget__settings`);
    await sleep(200);
    yield { name: `settings: ${t}`, include: sel };
    await b.evaluate(`document.querySelector('${sel} .w-panel .w-panel__header button')?.click()`);
    await sleep(100);
  }

  await b.click('#board-menu > summary');
  await sleep(150);
  yield { name: 'board menu', include: '#board-menu' };
  await closeAll(b);

  await b.click('#settings > summary');
  await sleep(150);
  yield { name: 'settings popover', include: '#settings' };
  await closeAll(b);

  await b.click('#board-menu > summary');
  await b.click('#board-menu [data-action="template"]');
  await sleep(400);
  yield { name: 'template dialog', include: 'dialog[open]' };
  await closeAll(b);

  await b.click('#board-menu > summary');
  await b.click('#board-menu [data-action="share"]');
  await sleep(900);
  yield { name: 'share dialog', include: 'dialog[open]' };
  await closeAll(b);

  await b.click('#board-menu > summary');
  await b.click('#board-menu [data-action="delete"]');
  await sleep(200);
  yield { name: 'confirm dialog', include: 'dialog[open]' };
  await closeAll(b);

  await b.click('.widget[data-type="text"] .widget__remove');
  await sleep(200);
  yield { name: 'notice with undo action' };
  await b.click('.notice .notice__action');
  await closeAll(b);

  for (const theme of ['dark', 'contrast']) {
    await setTheme(b, theme);
    await sleep(300);
    yield { name: `theme: ${theme}` };
  }
  await setTheme(b, 'light');

  // 위젯 모양 (M6) — 모양·강조색 조합 × 라이트·다크
  for (const [look, accent] of [['glass', 'red'], ['outline', 'orange'], ['glass', 'purple']]) {
    for (const theme of ['light', 'dark']) {
      await b.evaluate(`(() => {
        const boards = JSON.parse(localStorage.getItem('${BOARDS_KEY}'));
        for (const bd of boards) bd.widgetStyle = { look: '${look}', accent: '${accent}' };
        localStorage.setItem('${BOARDS_KEY}', JSON.stringify(boards));
      })()`);
      await b.cdp('Page.reload');
      await b.ready();
      await setTheme(b, theme);
      await sleep(300);
      yield { name: `widget style ${look}+${accent}: ${theme}` };
    }
  }
  await setTheme(b, 'light');

  await b.viewport(768, 1024, true);
  await sleep(400);
  yield { name: '768px portrait' };
  await b.viewport(1440, 900);

  await setLocale(b, 'en');
  await sleep(300);
  yield { name: 'english' };
  await setLocale(b, 'ko');
  await sleep(200);
}
