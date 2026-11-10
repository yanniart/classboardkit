// M7 E2E
//   1부 (언어): 4개 언어 × 점검 상태 전부에서 글자 넘침 0 · axe 심각 위반 0 · 템플릿 6종 생성
//     · 첫 화면 언어(저장값/브라우저 감지) · 복수형 문구 · 일본어 글꼴 · 번역 제안 링크
//   2부 (생태계): tools/new-widget.mjs로 만든 위젯이 실제 앱에서 동작 (임시 복사본 + 포트 8768 — 저장소는 그대로)
// 실행: 정적 서버(8765) 실행 후 `node tools/e2e/m7.mjs` (~6분). M7_LOCALES=es,ja 로 일부만 가능
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWidget } from '../new-widget.mjs';
import { APP_URL, launch, sleep } from './harness.mjs';
import { AXE_AVAILABLE, axe, severe, summarize } from './a11y.mjs';
import { auditStates } from './a11y-states.mjs';
import { flattenMessages } from '../../src/core/i18n.js';
import { messages } from '../../src/locales/index.js';
import { TEMPLATES } from '../../src/templates/index.js';

const LOCALES = (process.env.M7_LOCALES ?? 'en,es,ja,ko').split(',');
const BOARDS_KEY = 'classboardkit:v1:boards';
const msg = Object.fromEntries(Object.entries(messages).map(([k, v]) => [k, flattenMessages(v)]));
/** 문자열 또는 복수형의 other */
const text = (locale, key) => {
  const v = msg[locale].get(key);
  return typeof v === 'string' ? v : v?.other;
};

const b = await launch({ lang: 'en' });
const { evaluate, click, check, shot, viewport, cdp, ready } = b;

/**
 * 글자 넘침: 가로로 내용이 상자보다 넓은 요소. 줄임표(…) 처리된 요소는 따로 모은다.
 * 독 라벨은 줄임표도 실패 (독 폭 예산 — M7 공통 규칙).
 */
const OVERFLOW_JS = (include) => `(() => {
  const root = ${include ? `document.querySelector(${JSON.stringify(include)})` : 'document'};
  if (!root) return { over: [], cut: [] };
  const sels = '.dock__label, .menu-button, .widget__title, button, summary, .field__label, label, .w-btn__text, .dialog__title, .dialog__message, .template-card__name, .notice, h2, h3, th, td, .scoreboard__name, a';
  const over = [], cut = [];
  for (const el of root.querySelectorAll(sels)) {
    if (!el.getClientRects().length || el.clientWidth === 0) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || el.closest('[hidden], [aria-hidden="true"]')) continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    // 스크롤 영역 자체(목록 등)는 넘침이 아님
    if (['auto', 'scroll'].includes(s.overflowX)) continue;
    const item = (el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName.toLowerCase())
      + ': ' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40) + ' (' + el.scrollWidth + '>' + el.clientWidth + ')';
    (s.textOverflow === 'ellipsis' && !el.matches('.dock__label') ? cut : over).push(item);
  }
  return { over: [...new Set(over)], cut: [...new Set(cut)] };
})()`;

const setLocale = (v) => evaluate(`(() => { const s = document.getElementById('setting-locale'); s.value = '${v}'; s.dispatchEvent(new Event('change')); })()`);

/** 보드 데이터를 지우고 언어만 저장한 채 새로 시작 */
async function freshStart(locale) {
  // 앱이 페이지를 떠날 때 저장하므로 먼저 빈 페이지로 나간 뒤 저장소를 지운다
  await cdp('Page.navigate', { url: 'about:blank' });
  await sleep(300);
  await cdp('Storage.clearDataForOrigin', { origin: new URL(APP_URL).origin, storageTypes: 'local_storage,indexeddb' });
  await cdp('Page.navigate', { url: APP_URL });
  await ready();
  // 설정은 UI로 바꾼다 (언어만 담은 객체는 검증에서 거부됨). 헤드리스 Edge는 새로고침 뒤
  // navigator.languages가 OS 언어로 바뀌므로 "감지"가 아니라 "저장된 언어" 경로를 검사하는 셈
  await setLocale(locale);
  await sleep(700);
  await cdp('Page.reload');
  await ready();
}

await viewport(1440, 900);
await cdp('Page.navigate', { url: APP_URL });
await ready();

// ═════════ 1. 언어 메뉴 · 첫 화면 ═════════
const options = await evaluate(`[...document.querySelectorAll('#setting-locale option')].map(o => o.value + ':' + o.textContent)`);
check('language menu: en · es · ja · ko in code order, own names', options.join('|') === 'en:English|es:Español|ja:日本語|ko:한국어', options.join('|'));
const help = await evaluate(`(() => { const a = document.getElementById('translation-help'); return a && { href: a.href, target: a.target, rel: a.rel, text: a.textContent }; })()`);
check('language menu: "suggest a translation" link to the issue template', help?.href.includes('issues/new?template=translation.md') && help.target === '_blank' && help.rel.includes('noopener') && help.text === text('en', 'settings.translationHelp'), JSON.stringify(help));

for (const locale of LOCALES) {
  await freshStart(locale);
  // 첫 화면 경로(earlyPaint)와 앱 본체가 같은 언어로 그렸는지
  const first = await evaluate(`({ lang: document.documentElement.lang, label: document.querySelector('[data-i18n="settings.language"]').textContent, empty: document.querySelector('.canvas__empty-title').textContent, dock: document.querySelectorAll('.dock__label').length })`);
  check(`${locale}: html lang + first paint in the saved language`, first.lang === locale && first.label === text(locale, 'settings.language') && first.empty === text(locale, 'board.empty.title'), JSON.stringify(first));
}

// 일본어 글꼴: 한국어 글꼴이 먼저 오지 않음
await freshStart('ja');
const jaFont = await evaluate(`getComputedStyle(document.body).fontFamily`);
check('ja: font stack prefers Japanese fonts over Korean ones', jaFont.indexOf('Yu Gothic UI') > -1 && jaFont.indexOf('Yu Gothic UI') < jaFont.indexOf('system-ui') && jaFont.indexOf('Malgun Gothic') === -1, jaFont);

// ═════════ 2. 복수형 ═════════
await freshStart('es');
await click('.dock__item[data-type="groups"]');
await sleep(300);
const pluralState = async (items) => {
  await sleep(700);
  await evaluate(`(() => { const bs = JSON.parse(localStorage.getItem('${BOARDS_KEY}')); for (const bd of bs) for (const w of bd.widgets) if (w.type === 'groups') Object.assign(w.state, { items: ${JSON.stringify(items)}, result: [] }); localStorage.setItem('${BOARDS_KEY}', JSON.stringify(bs)); })()`);
  await cdp('Page.reload');
  await ready();
  return evaluate(`document.querySelector('.widget[data-type="groups"] .widget__body').textContent`);
};
const one = await pluralState(['Ana']);
const many = await pluralState(['Ana', 'Luis']);
check('es plural: "1 nombre" vs "2 nombres" in the group maker', one.includes('1 nombre') && !one.includes('1 nombres') && many.includes('2 nombres'), `${one.slice(0, 60)} / ${many.slice(0, 60)}`);
await setLocale('en');
await sleep(300);
const enOne = await pluralState(['Ana']);
check('en plural: "1 name" (no "(s)")', enOne.includes('1 name') && !enOne.includes('1 names') && !enOne.includes('(s)'), enOne.slice(0, 60));

// 언어 전환: 위젯을 다시 그리고(제목·시계 날짜가 새 언어), 실행 취소 기록은 유지 (M5 결정)
await freshStart('en');
await click('.dock__item[data-type="clock"]');
await sleep(300);
await setLocale('ja');
await sleep(400);
const switched = await evaluate(`({ title: document.querySelector('.widget[data-type="clock"] .widget__title').textContent, date: document.querySelector('.clock__date')?.textContent ?? '', undo: !document.getElementById('undo-button').disabled })`);
check('language switch: widgets re-render in the new language (ctx.locale), undo history kept', switched.title === text('ja', 'widget.clock.title') && /[月日]/.test(switched.date) && switched.undo, JSON.stringify(switched));
await click('#undo-button');
await sleep(300);
check('language switch: undo still removes the widget added before the switch', (await evaluate(`document.querySelectorAll('.widget[data-type="clock"]').length`)) === 0);

// ═════════ 3. 언어별 점검 상태: 넘침 · axe · 스크린샷 ═════════
for (const locale of LOCALES) {
  await freshStart(locale);
  const overflowAll = [];
  const cutAll = [];
  const axeFails = [];
  let states = 0;
  for await (const state of auditStates(b)) {
    states += 1;
    const { over, cut } = await evaluate(OVERFLOW_JS(state.include));
    for (const o of over) overflowAll.push(`[${state.name}] ${o}`);
    for (const c of cut) cutAll.push(`[${state.name}] ${c}`);
    // 한국어 axe는 m6가 40개 상태 전부 검사 → 여기서는 다른 언어만
    if (AXE_AVAILABLE && locale !== 'ko') {
      const v = severe(await axe(b, { include: state.include }));
      if (v.length) axeFails.push(`[${state.name}] ${summarize(v)}`);
    }
    if (state.name === 'filled widgets: light') await shot(`m7-${locale}-widgets`);
    if (state.name === 'template dialog') await shot(`m7-${locale}-templates`);
    if (state.name === 'settings popover') await shot(`m7-${locale}-settings`);
  }
  check(`${locale}: no text overflow in ${states} states (toolbar · dock · menus · dialogs · widgets · settings)`, overflowAll.length === 0, overflowAll.slice(0, 8).join(' | '));
  if (cutAll.length) console.log(`  info ${locale}: ${cutAll.length} ellipsized (by design): ${cutAll.slice(0, 6).join(' | ')}`);
  if (AXE_AVAILABLE && locale !== 'ko') check(`${locale}: axe — no serious/critical violations in ${states} states`, axeFails.length === 0, axeFails.slice(0, 4).join(' | '));
}

// ═════════ 4. 언어별 템플릿 6종 생성 ═════════
for (const locale of LOCALES) {
  await freshStart(locale);
  const made = [];
  for (const tpl of TEMPLATES) {
    await click('#board-menu > summary');
    await click('#board-menu [data-action="template"]');
    await sleep(400);
    await click(`dialog[open] [data-template="${tpl.id}"]`);
    await sleep(500);
    const r = await evaluate(`({ n: document.querySelectorAll('.widget').length, ...(${OVERFLOW_JS()}) })`);
    made.push({ id: tpl.id, ok: r.n === tpl.widgets.length && r.over.length === 0, detail: `${r.n}/${tpl.widgets.length} ${r.over.join(', ')}` });
    if (tpl.id === TEMPLATES[0].id) await shot(`m7-${locale}-template-${tpl.id}`);
  }
  const bad = made.filter((m) => !m.ok);
  check(`${locale}: 6 templates create boards with all widgets and no overflow`, bad.length === 0, bad.map((m) => `${m.id}: ${m.detail}`).join(' | '));
}

// 태블릿 폭(768px)에서 독·툴바 넘침 — 가장 긴 언어(es)와 ja
await viewport(768, 1024);
for (const locale of LOCALES.filter((l) => l === 'es' || l === 'ja')) {
  await freshStart(locale);
  const { over } = await evaluate(OVERFLOW_JS());
  const dockFits = await evaluate(`(() => { const d = document.getElementById('dock'); return d.scrollWidth <= d.clientWidth + 1 || getComputedStyle(d.querySelector('.dock__items')).overflowX !== 'visible'; })()`);
  check(`${locale}: 768px tablet — no overflow, dock fits or scrolls`, over.length === 0 && dockFits, over.join(' | '));
  await shot(`m7-${locale}-tablet`);
}
await viewport(1440, 900);

// 브라우저 언어 감지 (저장값 없음): 지역 코드 → 기본 언어, 미지원 → 영어
for (const [browserLang, want] of [['es-419', 'es'], ['ja', 'ja'], ['pt-BR', 'en']]) {
  const other = await launch({ lang: browserLang });
  await other.cdp('Page.navigate', { url: APP_URL });
  await other.ready();
  const got = await other.evaluate(`({ lang: document.documentElement.lang, title: document.querySelector('.canvas__empty-title').textContent })`);
  check(`browser language ${browserLang} → ${want}`, got.lang === want && got.title === text(want, 'board.empty.title'), JSON.stringify(got));
  other.close();
}

// ═════════ 5. 위젯 생성기: 만든 위젯이 앱에서 동작 ═════════
{
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const tmp = mkdtempSync(join(tmpdir(), 'cbk-gen-app-'));
  for (const p of ['index.html', 'manifest.webmanifest', 'sw.js', 'src', 'assets']) cpSync(join(ROOT, p), join(tmp, p), { recursive: true });
  const { created } = createWidget({ root: tmp, type: 'e2e-counter', title: 'E2E counter', stamp: false, log: () => {} });
  check('generator: creates widget files in a copy of the app', created.length === 4, created.join(', '));
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(tmp, path.endsWith('/') ? `${path}index.html` : path));
    if (!file.startsWith(tmp) || !existsSync(file) || statSync(file).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise((r) => server.listen(8768, '127.0.0.1', r));
  try {
    await cdp('Page.navigate', { url: 'http://127.0.0.1:8768/' });
    await ready();
    const W = '.widget[data-type="e2e-counter"]';
    const dockLast = await evaluate(`[...document.querySelectorAll('.dock__item')].at(-1)?.dataset.type`);
    check('generator: new widget is the last dock item', dockLast === 'e2e-counter', dockLast);
    await click('.dock__item[data-type="e2e-counter"]');
    await sleep(300);
    const value = () => evaluate(`document.querySelector('${W} .e2e-counter__value')?.textContent`);
    const v0 = await value();
    await click(`${W} .w-btn--primary`);
    await sleep(200);
    const v1 = await value();
    await click(`${W} .widget__settings`);
    await sleep(200);
    const incLabel = text(await evaluate('document.documentElement.lang'), 'common.increase');
    await click(`${W} .w-panel button[aria-label="${incLabel}"]`); // 단계 1 → 2
    await sleep(150);
    await evaluate(`document.querySelector('${W} .w-panel .w-panel__header button')?.click()`);
    await sleep(150);
    await click(`${W} .w-btn--primary`);
    await sleep(200);
    const v2 = await value();
    const said = await evaluate(`document.querySelector('${W} [aria-live="polite"]')?.textContent ?? ''`);
    check('generator: widget counts, settings change the step, result is announced', v0 === '0' && v1 === '1' && Number(v2) > 2 && /3|4/.test(said), `${v0} → ${v1} → ${v2}, said "${said}"`);
    await sleep(700);
    const savedState = await evaluate(`(() => { const bs = JSON.parse(localStorage.getItem('${BOARDS_KEY}')); return bs.flatMap(x => x.widgets).find(w => w.type === 'e2e-counter')?.state; })()`);
    check('generator: state is saved as JSON', savedState?.count === Number(v2), JSON.stringify(savedState));
    await click(`${W} .widget__remove`);
    await sleep(300);
    check('generator: widget can be removed', (await evaluate(`document.querySelectorAll('${W}').length`)) === 0);
  } finally {
    server.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

b.finish();
