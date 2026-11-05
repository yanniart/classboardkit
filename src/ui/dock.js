import { addWidget, getActiveBoard } from '../core/board-ops.js';
import { h, icon } from './dom.js';

/**
 * 위젯 독 (F-002): 위젯 추가 버튼과 접기/펼치기.
 *
 * @param {{
 *   dock: HTMLElement,
 *   store: ReturnType<typeof import('../core/store.js').createStore>,
 *   registry: ReturnType<typeof import('../core/registry.js').createRegistry>,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 *   onAdded: (widgetId: string) => void,
 * }} deps
 */
export function mountDock({ dock, store, registry, i18n, onAdded }) {
  const items = h('div', { className: 'dock__items' });
  const toggle = h('button', { className: 'dock__toggle', attrs: { type: 'button' } }, [icon('chevron-down')]);
  dock.replaceChildren(items, toggle);

  /** @param {import('../core/registry.js').WidgetDefinition} def */
  function add(def) {
    /** @type {string | null} */
    let widgetId = null;
    store.update((s) => {
      const board = getActiveBoard(s);
      if (!board) return s;
      const result = addWidget(s, board.id, def);
      widgetId = result.widgetId;
      return result.state;
    });
    if (widgetId) onAdded(widgetId);
  }

  toggle.addEventListener('click', () =>
    store.update((s) => ({ ...s, settings: { ...s.settings, dockCollapsed: !s.settings.dockCollapsed } })),
  );

  let renderedLocale = '';
  function render() {
    const { dockCollapsed } = store.getState().settings;
    dock.classList.toggle('is-collapsed', dockCollapsed);
    items.hidden = dockCollapsed;
    const toggleLabel = i18n.t(dockCollapsed ? 'dock.expand' : 'dock.collapse');
    toggle.setAttribute('aria-label', toggleLabel);
    toggle.setAttribute('title', toggleLabel);
    toggle.setAttribute('aria-expanded', String(!dockCollapsed));

    if (renderedLocale === i18n.locale) return;
    renderedLocale = i18n.locale;
    items.replaceChildren(
      ...registry.list().map((def) => {
        const name = i18n.t(def.titleKey);
        const button = h(
          'button',
          {
            className: 'dock__item',
            attrs: { type: 'button', 'aria-label': i18n.t('dock.add', { name }), title: i18n.t('dock.add', { name }) },
            dataset: { type: def.type },
          },
          [icon(def.icon), h('span', { className: 'dock__label', text: name })],
        );
        button.addEventListener('click', () => add(def));
        // 키보드로 이동할 때 가려진 항목이 보이도록
        button.addEventListener('focus', () => button.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
        return button;
      }),
    );
  }

  /** 가로로 넘칠 때 양 끝 fade 표시 (방향은 RTL이 없으므로 왼쪽→오른쪽 기준) */
  function updateOverflow() {
    const max = items.scrollWidth - items.clientWidth;
    items.classList.toggle('has-more-start', max > 1 && items.scrollLeft > 1);
    items.classList.toggle('has-more-end', max > 1 && items.scrollLeft < max - 1);
  }
  items.addEventListener('scroll', updateOverflow, { passive: true });
  new ResizeObserver(updateOverflow).observe(items);

  store.subscribe((next, prev) => {
    if (next.settings !== prev.settings) render();
  });
  render();
  updateOverflow();
}
