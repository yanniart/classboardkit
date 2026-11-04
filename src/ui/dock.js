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
        return button;
      }),
    );
  }

  store.subscribe((next, prev) => {
    if (next.settings !== prev.settings) render();
  });
  render();
}
