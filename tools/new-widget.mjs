// 새 위젯 만들기 (M7 D5): node tools/new-widget.mjs <type> [--title "Name"] [--dry-run] [--no-stamp] [--root <dir>]
//
// 만드는 것: src/widgets/<type>/{index.js, <type>-logic.js, <type>.css}, tests/<type>.test.js
// 고치는 것: src/widgets/index.js(표식 주석 바로 위에 import 1줄 + 목록 1줄), src/locales/*.js(문구 자리), sw.js(sw-stamp)
// 결과는 바로 계약 검사·단위 테스트를 통과하는 "숫자 세기" 위젯 — 이것을 고쳐서 원하는 위젯으로 만든다.
// 가이드: docs/guides/new-widget.md
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TYPE_RE = /^[a-z][a-z0-9-]*$/;
export const IMPORT_MARKER = '// new-widget:imports';
export const LIST_MARKER = '// new-widget:list';

/** 'exit-ticket' → 'exitTicket' (JS 식별자) */
const camel = (type) => type.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
/** 'exit-ticket' → 'Exit ticket' */
const defaultTitle = (type) => type.charAt(0).toUpperCase() + type.slice(1).replaceAll('-', ' ');
/** 작은따옴표 JS 문자열 */
const q = (s) => `'${String(s).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

/** 언어별 문구 (영어 외는 영어를 그대로 두고 i18n-check 경고로 번역 필요를 알린다) */
function messageBlock(type, title) {
  return [
    `    ${/^[a-z][a-z0-9]*$/.test(type) ? type : q(type)}: {`,
    `      title: ${q(title)},`,
    `      add: 'Add {n}',`,
    `      reset: 'Reset',`,
    `      step: 'Step',`,
    `      announce: 'Count: {n}',`,
    `    },`,
  ].join('\n');
}

function indexSource(type) {
  const c = camel(type);
  return `import { h } from '../../ui/dom.js';
import { button, createSettingsPanel, liveRegion, stepper } from '../shared/ui.js';
import { MAX_STEP, MIN_STEP, add, create${cap(c)}State, reset, setStep } from './${type}-logic.js';

// 공개 모듈만 사용: ui/dom.js, widgets/shared/ui.js, widgets/shared/list.js, core/utils/random.js (ADR-0011)

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: '${type}',
  version: 1,
  icon: 'plus', // assets/icons.svg의 아이콘 id — 새 아이콘을 그렸다면 바꾸기
  titleKey: 'widget.${type}.title',
  defaultSize: { w: 0.26, h: 0.3 },
  minSize: { w: 0.14, h: 0.18 },
  styleUrl: new URL('./${type}.css', import.meta.url).href,
  createState: create${cap(c)}State,

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;

    const value = h('p', { className: '${type}__value', attrs: { 'aria-live': 'off' } });
    const addButton = button({
      variant: 'primary',
      iconName: 'plus',
      text: t('widget.${type}.add', { n: state.step }),
      onClick: () => change(add),
    });
    const resetButton = button({ iconName: 'reset', text: t('widget.${type}.reset'), onClick: () => change(reset) });
    const root = h('div', { className: '${type}' }, [value, h('div', { className: 'w-row' }, [addButton, resetButton])]);
    container.append(root);
    // 낭독기에는 사용자 조작의 최종 결과만 한 번 (TRD 2.2.4)
    const live = liveRegion(container);

    /** @param {(s: any) => any} op */
    function change(op) {
      const next = op(state);
      if (next === state) return;
      ctx.setState(next);
      live.say(t('widget.${type}.announce', { n: next.count }));
    }

    function paint() {
      value.textContent = new Intl.NumberFormat(ctx.locale).format(state.count);
      addButton.querySelector('.w-btn__text').textContent = t('widget.${type}.add', { n: state.step });
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.${type}.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        body.append(
          stepper({
            label: t('widget.${type}.step'),
            value: state.step,
            min: MIN_STEP,
            max: MAX_STEP,
            decLabel: t('common.decrease'),
            incLabel: t('common.increase'),
            onChange: (n) => ctx.setState((s) => setStep(s, n)),
          }),
        );
      },
    });

    paint();

    return {
      // setState 뒤 상태가 바뀌면 호출됨 (교체형 — 입력 중인 값은 스스로 비교해 지킬 것)
      update(next) {
        state = next;
        paint();
      },
      openSettings: panel.open,
      destroy() {
        live.destroy();
        root.remove();
      },
    };
  },
};
`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function logicSource(type) {
  const c = camel(type);
  return `// ${type} 위젯의 순수 로직 — DOM 없음, tests/${type}.test.js에서 검사
// state는 JSON으로 저장된다 (함수·Date·Map 금지). 바꿀 때는 새 객체를 반환 (setState는 교체형)

export const MIN_STEP = 1;
export const MAX_STEP = 10;

/** @typedef {{ count: number, step: number }} ${cap(c)}State */

/** @returns {${cap(c)}State} */
export function create${cap(c)}State() {
  return { count: 0, step: 1 };
}

/** @param {${cap(c)}State} s */
export function add(s) {
  return { ...s, count: s.count + s.step };
}

/** @param {${cap(c)}State} s */
export function reset(s) {
  return s.count === 0 ? s : { ...s, count: 0 };
}

/** @param {${cap(c)}State} s @param {number} step */
export function setStep(s, step) {
  const next = Math.min(MAX_STEP, Math.max(MIN_STEP, Math.round(step)));
  return next === s.step ? s : { ...s, step: next };
}
`;
}

function cssSource(type) {
  return `/* ${type} 위젯 — 글자 크기는 위젯 크기에 비례 (cqmin), 색은 공개 토큰(--color-*, --team-*)만 */
.${type} {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3cqh;
  padding: 3cqmin;
}

.${type}__value {
  margin: 0;
  font-size: clamp(2rem, 28cqmin, 9rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
`;
}

function testSource(type) {
  const c = camel(type);
  return `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetDefinition } from '../src/core/registry.js';
import { flattenMessages } from '../src/core/i18n.js';
import { messages } from '../src/locales/index.js';
import def from '../src/widgets/${type}/index.js';
import { MAX_STEP, add, create${cap(c)}State, reset, setStep } from '../src/widgets/${type}/${type}-logic.js';

test('${type}: definition satisfies the widget contract', () => {
  assert.deepEqual(validateWidgetDefinition(def), []);
  for (const [code, tree] of Object.entries(messages)) {
    assert.ok(flattenMessages(tree).has(def.titleKey), \`\${code}: \${def.titleKey}\`);
  }
});

test('${type}: state is JSON-safe and operations replace it', () => {
  const s = create${cap(c)}State();
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  const next = add(s);
  assert.notEqual(next, s);
  assert.equal(next.count, 1);
  assert.equal(add(setStep(s, 5)).count, 5);
  assert.equal(reset(next).count, 0);
  assert.equal(reset(s), s, 'no change → same reference');
  assert.equal(setStep(s, 99).step, MAX_STEP);
});
`;
}

/**
 * @param {{ root: string, type: string, title?: string, dryRun?: boolean, stamp?: boolean, log?: (s: string) => void }} options
 * @returns {{ created: string[], changed: string[] }}
 */
export function createWidget({ root, type, title = defaultTitle(type), dryRun = false, stamp = true, log = console.log }) {
  if (!TYPE_RE.test(type)) throw new Error(`"${type}" is not a valid type — use lowercase letters, digits and "-" (e.g. exit-ticket)`);
  const widgetsDir = join(root, 'src', 'widgets');
  const dir = join(widgetsDir, type);
  const indexPath = join(widgetsDir, 'index.js');
  if (existsSync(dir)) throw new Error(`src/widgets/${type}/ already exists`);
  const indexSrc = readFileSync(indexPath, 'utf8');
  if (!indexSrc.includes(IMPORT_MARKER) || !indexSrc.includes(LIST_MARKER)) {
    throw new Error(`src/widgets/index.js has no "${IMPORT_MARKER}" / "${LIST_MARKER}" markers`);
  }
  if (new RegExp(`from '\\./${type}/index\\.js'`).test(indexSrc)) throw new Error(`"${type}" is already registered`);

  const localesDir = join(root, 'src', 'locales');
  const localeFiles = readdirSync(localesDir).filter((f) => /^[a-z]{2}(-[A-Za-z0-9]+)?\.js$/.test(f));
  for (const f of localeFiles) {
    const src = readFileSync(join(localesDir, f), 'utf8');
    if ((src.match(/^ {2}widget: \{$/gm) ?? []).length !== 1) throw new Error(`${f}: expected one "  widget: {" block`);
    if (new RegExp(`^ {4}['"]?${type}['"]?: \\{`, 'm').test(src)) throw new Error(`${f}: widget.${type} messages already exist`);
  }

  const files = {
    [join(dir, 'index.js')]: indexSource(type),
    [join(dir, `${type}-logic.js`)]: logicSource(type),
    [join(dir, `${type}.css`)]: cssSource(type),
    [join(root, 'tests', `${type}.test.js`)]: testSource(type),
  };
  const id = camel(type);
  // 표식 줄 "위"에 넣는다 → 여러 위젯을 만들어도 만든 순서대로 쌓이고 표식은 맨 끝에 남음
  const lineWith = (marker) => new RegExp(`^( *)(.*${marker.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}.*)$`, 'm');
  const nextIndex = indexSrc
    .replace(lineWith(IMPORT_MARKER), (m, indent) => `${indent}import ${id} from './${type}/index.js';\n${m}`)
    .replace(lineWith(LIST_MARKER), (m, indent) => `${indent}${id},\n${m}`);

  const rel = (p) => relative(root, p).replaceAll('\\', '/');
  const created = Object.keys(files).map(rel);
  const changed = [rel(indexPath), ...localeFiles.map((f) => `src/locales/${f}`)];
  log(`${dryRun ? '[dry-run] ' : ''}new widget "${type}" (${title})`);
  for (const p of created) log(`  + ${p}`);
  for (const p of changed) log(`  ~ ${p}`);
  if (dryRun) return { created, changed };

  mkdirSync(dir, { recursive: true });
  for (const [p, src] of Object.entries(files)) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, src);
  }
  writeFileSync(indexPath, nextIndex);
  for (const f of localeFiles) {
    const p = join(localesDir, f);
    writeFileSync(p, readFileSync(p, 'utf8').replace(/^ {2}widget: \{$/m, (m) => `${m}\n${messageBlock(type, title)}`));
  }
  if (stamp) {
    const r = spawnSync(process.execPath, [join(root, 'tools', 'sw-stamp.mjs')], { cwd: root, encoding: 'utf8' });
    log(`  ${r.stdout.trim() || r.stderr.trim()}`);
  }
  log(`
Next:
  1. node --test                      (the new tests/${type}.test.js passes as is)
  2. node tools/i18n-check.mjs        (shows the new texts as "same as en" → translate es/ja/ko)
  3. edit src/widgets/${type}/ — guide: docs/guides/new-widget.md
  4. node tools/sw-stamp.mjs after every change, then try it in the app`);
  return { created, changed };
}

// CLI
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const value = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const positional = args.filter((a, i) => !a.startsWith('--') && !['--title', '--root'].includes(args[i - 1]));
  const type = positional[0];
  if (!type || flag('--help')) {
    console.log('usage: node tools/new-widget.mjs <type> [--title "Name"] [--dry-run] [--no-stamp] [--root <dir>]');
    process.exit(type ? 0 : 1);
  }
  try {
    createWidget({
      root: resolve(value('--root') ?? join(dirname(fileURLToPath(import.meta.url)), '..')),
      type,
      title: value('--title'),
      dryRun: flag('--dry-run'),
      stamp: !flag('--no-stamp'),
    });
  } catch (error) {
    console.error(`new-widget: ${error.message}`);
    process.exit(1);
  }
}
