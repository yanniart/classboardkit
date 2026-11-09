import { h } from '../../ui/dom.js';
import { createSettingsPanel, field, liveRegion, svg, textInput } from '../shared/ui.js';
import {
  MAX_LABEL_LENGTH,
  SYMBOLS,
  createSymbolsState,
  displaySymbol,
  moveIndex,
  setLabel,
  setSymbol,
} from './symbols-logic.js';

/** @param {string} key */
const symbolGraphic = (key, className) =>
  svg('svg', { class: className, viewBox: '0 0 48 48', 'aria-hidden': 'true', focusable: 'false' }, [
    svg('use', { href: `assets/symbols.svg#sym-${key}` }),
  ]);

/**
 * 활동 상징 (F-115, M6): 지금 할 활동을 큰 그림 + 문구로. 그림을 누르면 고르기.
 * @type {import('../../core/registry.js').WidgetDefinition}
 */
export default {
  type: 'symbols',
  version: 1,
  icon: 'symbol',
  titleKey: 'widget.symbols.title',
  defaultSize: { w: 0.22, h: 0.42 },
  minSize: { w: 0.1, h: 0.18 },
  styleUrl: new URL('./symbols.css', import.meta.url).href,
  createState: createSymbolsState,

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;

    const nameOf = (/** @type {string} */ key) => t(`widget.symbols.name.${key}`);
    const labelOf = () => state.label.trim() || nameOf(displaySymbol(state));

    const face = h('button', { className: 'symbols__face', attrs: { type: 'button' } });
    const label = h('p', { className: 'symbols__label' });
    const root = h('div', { className: 'symbols' }, [face, label]);
    container.append(root);
    const live = liveRegion(container);

    /** @type {string} */
    let paintedSymbol = '';
    function paint() {
      const key = displaySymbol(state);
      root.dataset.symbol = key;
      if (paintedSymbol !== key) {
        face.replaceChildren(symbolGraphic(key, 'symbols__graphic'));
        paintedSymbol = key;
      }
      label.textContent = labelOf();
      face.setAttribute('aria-label', t('widget.symbols.change', { name: labelOf() }));
    }

    /** @param {string} key */
    function choose(key) {
      const before = state.symbol;
      ctx.setState((s) => setSymbol(s, key));
      if (state.symbol !== before) live.say(labelOf());
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.symbols.title') }),
      doneLabel: t('dialog.done'),
      build(body, close) {
        // 고르기 격자: 화살표로 이동하는 단일 탭 정지점 (roving tabindex)
        const current = () => SYMBOLS.indexOf(displaySymbol(state));
        const options = SYMBOLS.map((key, i) => {
          const b = h('button', {
            className: 'symbols__option',
            attrs: { type: 'button', 'aria-pressed': String(i === current()), tabindex: i === current() ? '0' : '-1' },
            dataset: { symbol: key },
          }, [symbolGraphic(key, 'symbols__option-graphic'), h('span', { text: nameOf(key) })]);
          b.addEventListener('click', () => {
            choose(key);
            close();
          });
          return b;
        });
        const grid = h('div', { className: 'symbols__grid', attrs: { role: 'group', 'aria-label': t('widget.symbols.pick') } }, options);
        grid.addEventListener('keydown', (event) => {
          const from = options.indexOf(/** @type {any} */ (event.target));
          if (from === -1) return;
          const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
          const to = moveIndex(from, event.key, options.length, cols);
          if (to === from) return;
          event.preventDefault();
          options[from].tabIndex = -1;
          options[to].tabIndex = 0;
          options[to].focus();
        });

        const input = textInput({
          label: t('widget.symbols.label'),
          value: state.label,
          placeholder: nameOf(displaySymbol(state)),
          maxLength: MAX_LABEL_LENGTH,
          onInput: (v) => ctx.setState((s) => setLabel(s, v)),
        });
        body.append(field(t('widget.symbols.pick'), grid), field(t('widget.symbols.label'), input, t('widget.symbols.labelHint')));
        // 패널을 열면 지금 상징에 포커스 (createSettingsPanel은 첫 버튼에 포커스하므로 다시 지정)
        queueMicrotask(() => options[current()]?.focus());
      },
    });
    face.addEventListener('click', () => panel.open());

    paint();

    return {
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
