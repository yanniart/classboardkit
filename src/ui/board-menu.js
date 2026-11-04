import {
  addBoard,
  deleteBoard,
  duplicateBoard,
  getActiveBoard,
  renameBoard,
  setActiveBoard,
  setBackground,
} from '../core/board-ops.js';
import { BACKGROUND_PRESETS, resolveBackground } from '../core/backgrounds.js';
import { openDialog } from './dialog.js';
import { h, icon } from './dom.js';

/**
 * 보드 메뉴 (F-004 보드 관리, F-006 배경).
 *
 * @param {{
 *   root: HTMLElement,
 *   store: ReturnType<typeof import('../core/store.js').createStore>,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 * }} deps
 */
export function mountBoardMenu({ root, store, i18n }) {
  const el = {
    details: /** @type {HTMLDetailsElement} */ (root.querySelector('#board-menu')),
    name: /** @type {HTMLElement} */ (root.querySelector('#board-name')),
    list: /** @type {HTMLElement} */ (root.querySelector('#board-list')),
    swatches: /** @type {HTMLElement} */ (root.querySelector('#background-swatches')),
    actions: /** @type {HTMLElement} */ (root.querySelector('#board-actions')),
  };
  const { t } = i18n;
  const close = () => (el.details.open = false);

  /** 대화상자 버튼 공통 라벨 */
  const buttons = () => ({ cancelLabel: t('dialog.cancel') });

  /** "보드 n" 형식의 겹치지 않는 새 이름 */
  function nextBoardName() {
    const names = new Set(store.getState().boards.map((b) => b.name));
    for (let n = store.getState().boards.length + 1; ; n += 1) {
      const name = t('board.newName', { n });
      if (!names.has(name)) return name;
    }
  }

  const actions = {
    async new() {
      close();
      store.update((s) => addBoard(s, nextBoardName()));
    },
    async rename() {
      const board = getActiveBoard(store.getState());
      if (!board) return;
      close();
      const name = await openDialog({
        title: t('board.renameTitle'),
        input: { value: board.name, label: t('board.nameLabel') },
        confirmLabel: t('dialog.save'),
        ...buttons(),
      });
      if (typeof name === 'string') store.update((s) => renameBoard(s, board.id, name));
    },
    async duplicate() {
      const board = getActiveBoard(store.getState());
      if (!board) return;
      close();
      store.update((s) => duplicateBoard(s, board.id, t('board.copyName', { name: board.name })));
    },
    async delete() {
      const board = getActiveBoard(store.getState());
      if (!board) return;
      close();
      const ok = await openDialog({
        title: t('board.deleteTitle'),
        message: t('board.deleteMessage', { name: board.name, count: board.widgets.length }),
        confirmLabel: t('dialog.delete'),
        danger: true,
        ...buttons(),
      });
      if (ok) store.update((s) => deleteBoard(s, board.id, t('board.defaultName')));
    },
  };

  el.actions.addEventListener('click', (event) => {
    const button = /** @type {HTMLElement} */ (event.target).closest('[data-action]');
    const action = button && /** @type {HTMLElement} */ (button).dataset.action;
    if (action && action in actions) void actions[/** @type {keyof typeof actions} */ (action)]();
  });

  function renderList() {
    const state = store.getState();
    const active = getActiveBoard(state);
    el.list.replaceChildren(
      ...state.boards.map((board) => {
        const current = board.id === active?.id;
        const button = h(
          'button',
          {
            className: 'board-menu__item',
            attrs: { type: 'button', ...(current ? { 'aria-current': 'true' } : {}) },
          },
          [
            h('span', { className: 'board-menu__item-name', text: board.name }),
            h('span', { className: 'board-menu__item-count', text: String(board.widgets.length) }),
            current ? icon('check') : null,
          ],
        );
        button.addEventListener('click', () => {
          store.update((s) => setActiveBoard(s, board.id));
          close();
        });
        return h('li', {}, [button]);
      }),
    );
  }

  function renderSwatches() {
    const board = getActiveBoard(store.getState());
    const current = board ? resolveBackground(board.background).preset?.key : null;
    el.swatches.replaceChildren(
      ...BACKGROUND_PRESETS.map((preset) => {
        const label = t(`background.${preset.key}`);
        const swatch = h('button', {
          className: `swatch${preset.key === 'default' ? ' swatch--default' : ''}`,
          attrs: { type: 'button', 'aria-label': label, title: label, 'aria-pressed': String(preset.key === current) },
        });
        if (preset.css) swatch.style.background = preset.css;
        swatch.addEventListener('click', () => {
          const id = getActiveBoard(store.getState())?.id;
          if (id) store.update((s) => setBackground(s, id, { type: preset.type, value: preset.value }));
        });
        return swatch;
      }),
    );
  }

  function render() {
    const board = getActiveBoard(store.getState());
    el.name.textContent = board?.name ?? '';
    renderList();
    renderSwatches();
  }

  store.subscribe((next, prev) => {
    if (next.boards !== prev.boards || next.settings !== prev.settings) render();
  });
  render();
}
