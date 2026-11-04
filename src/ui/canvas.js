import {
  bringToFront,
  getActiveBoard,
  removeWidget,
  replaceWidget,
  setWidgetRect,
  setWidgetState,
} from '../core/board-ops.js';
import { moveRect, resizeRect } from '../core/geometry.js';
import { prepareWidget } from '../core/registry.js';
import { resolveBackground } from '../core/backgrounds.js';
import { h, iconButton } from './dom.js';

/** 정의를 찾을 수 없는 위젯의 최소 크기 */
const FALLBACK_MIN = { w: 0.1, h: 0.1 };
/** 키보드 이동·크기 조절 단위 */
const KEY_STEP = 0.01;
const KEY_STEP_LARGE = 0.05;

/**
 * @typedef {{
 *   frame: HTMLElement,
 *   instance: { update: (state: any) => void, destroy: () => void, openSettings?: () => void } | null,
 *   widget: any,
 *   minSize: { w: number, h: number },
 * }} Entry
 */

/** @param {HTMLElement} frame @param {{ x: number, y: number, w: number, h: number }} r */
function applyRect(frame, r) {
  frame.style.left = `${r.x * 100}%`;
  frame.style.top = `${r.y * 100}%`;
  frame.style.width = `${r.w * 100}%`;
  frame.style.height = `${r.h * 100}%`;
}

/**
 * 보드 캔버스: 위젯 프레임 렌더링, 드래그·리사이즈·키보드 조작 (F-001).
 *
 * @param {{
 *   canvas: HTMLElement,
 *   emptyState: HTMLElement,
 *   store: ReturnType<typeof import('../core/store.js').createStore>,
 *   registry: ReturnType<typeof import('../core/registry.js').createRegistry>,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 * }} deps
 */
export function mountCanvas({ canvas, emptyState, store, registry, i18n }) {
  /** @type {Map<string, Entry>} */
  const entries = new Map();
  /** @type {string | null} */
  let renderedBoardId = null;
  let renderedLocale = '';
  /** 드래그 중인 위젯 ID — 렌더가 위치를 덮어쓰지 않도록 */
  /** @type {string | null} */
  let gestureId = null;

  const boardId = () => getActiveBoard(store.getState())?.id ?? null;

  /** @param {(state: any, boardId: string) => any} fn */
  function commit(fn) {
    const id = boardId();
    if (id) store.update((s) => fn(s, id));
  }

  /** @param {any} widget */
  function createEntry(widget) {
    const def = registry.get(widget.type);
    const prepared = prepareWidget(def, widget);
    const title =
      prepared.status === 'unsupported'
        ? i18n.t('widget.unknown', { type: widget.type })
        : i18n.t(/** @type {any} */ (def).titleKey);

    const removeButton = iconButton({
      iconName: 'close',
      label: i18n.t('widget.remove', { name: title }),
      className: 'widget__action widget__remove',
    });
    const bar = h('header', { className: 'widget__bar' }, [
      h('span', { className: 'widget__title', text: title }),
      removeButton,
    ]);
    const body = h('div', { className: 'widget__body' });
    const handle = h('div', { className: 'widget__resize', attrs: { 'aria-hidden': 'true' } });
    const frame = h(
      'section',
      {
        className: 'widget',
        attrs: {
          tabindex: '0',
          'aria-label': title,
          'aria-roledescription': i18n.t('widget.roleDescription'),
        },
        dataset: { id: widget.id, type: widget.type },
      },
      [bar, body, handle],
    );

    /** @type {Entry} */
    const entry = {
      frame,
      instance: null,
      widget,
      minSize: def?.minSize ?? FALLBACK_MIN,
    };

    if (prepared.status === 'unsupported') {
      frame.classList.add('widget--unsupported');
      body.append(h('p', { className: 'widget__unsupported', text: i18n.t('widget.unsupportedBody') }));
    } else {
      if (prepared.status === 'migrated') {
        // 렌더 도중 상태를 바꾸지 않도록 다음 마이크로태스크에서 저장
        queueMicrotask(() => commit((s, id) => replaceWidget(s, id, prepared.widget)));
      }
      entry.instance = /** @type {any} */ (def).mount(body, {
        state: prepared.widget.state,
        t: i18n.t,
        setState: (next) => commit((s, id) => setWidgetState(s, id, widget.id, next)),
      });
    }

    // 위젯이 설정 화면을 제공하면 제목 막대에 설정 버튼 추가
    const instance = entry.instance;
    if (instance?.openSettings) {
      const settingsButton = iconButton({
        iconName: 'sliders',
        label: i18n.t('widget.settings', { name: title }),
        className: 'widget__action widget__settings',
      });
      settingsButton.addEventListener('click', () => instance.openSettings?.());
      bar.insertBefore(settingsButton, removeButton);
    }

    removeButton.addEventListener('click', () => commit((s, id) => removeWidget(s, id, widget.id)));

    // 어디를 눌러도 맨 앞으로
    frame.addEventListener('pointerdown', () => commit((s, id) => bringToFront(s, id, widget.id)), {
      capture: true,
    });
    frame.addEventListener('focusin', () => commit((s, id) => bringToFront(s, id, widget.id)));

    bar.addEventListener('pointerdown', (event) => {
      if (/** @type {Element} */ (event.target).closest('button')) return;
      startGesture(event, entry, 'move', bar);
    });
    handle.addEventListener('pointerdown', (event) => startGesture(event, entry, 'resize', handle));
    frame.addEventListener('keydown', (event) => onFrameKeydown(event, entry));

    return entry;
  }

  /**
   * @param {PointerEvent} event
   * @param {Entry} entry
   * @param {'move' | 'resize'} kind
   * @param {HTMLElement} target
   */
  function startGesture(event, entry, kind, target) {
    if (event.button !== 0 || gestureId !== null) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const { x, y, w, h: height } = entry.widget;
    const start = { x, y, w, h: height };
    const origin = { px: event.clientX, py: event.clientY };
    let rect = start;

    gestureId = entry.widget.id;
    target.setPointerCapture(event.pointerId);
    entry.frame.classList.add(kind === 'move' ? 'is-moving' : 'is-resizing');

    /** @param {PointerEvent} e */
    const onMove = (e) => {
      const dx = (e.clientX - origin.px) / bounds.width;
      const dy = (e.clientY - origin.py) / bounds.height;
      rect = kind === 'move' ? moveRect(start, dx, dy) : resizeRect(start, dx, dy, entry.minSize);
      applyRect(entry.frame, rect);
    };

    /** @param {PointerEvent} e */
    const end = (e) => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      entry.frame.classList.remove('is-moving', 'is-resizing');
      gestureId = null;
      if (e.type === 'pointercancel') {
        applyRect(entry.frame, start);
        return;
      }
      commit((s, id) => setWidgetRect(s, id, entry.widget.id, rect));
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  /**
   * 프레임에 포커스가 있을 때: 화살표 = 이동, Alt+화살표 = 크기, Shift = 큰 단위, Delete = 삭제
   * @param {KeyboardEvent} event
   * @param {Entry} entry
   */
  function onFrameKeydown(event, entry) {
    if (event.target !== entry.frame) return; // 위젯 내부 입력은 건드리지 않음
    const id = entry.widget.id;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      commit((s, b) => removeWidget(s, b, id));
      return;
    }

    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!dir) return;
    event.preventDefault();
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const [dx, dy] = [dir[0] * step, dir[1] * step];
    const { x, y, w, h: height } = entry.widget;
    const start = { x, y, w, h: height };
    const rect = event.altKey ? resizeRect(start, dx, dy, entry.minSize) : moveRect(start, dx, dy);
    commit((s, b) => setWidgetRect(s, b, id, rect));
  }

  /** @param {Entry} entry */
  function destroyEntry(entry) {
    entry.instance?.destroy();
    entry.frame.remove();
  }

  function destroyAll() {
    for (const entry of entries.values()) destroyEntry(entry);
    entries.clear();
  }

  function render() {
    const board = getActiveBoard(store.getState());
    if (!board) {
      destroyAll();
      return;
    }

    // 보드 전환·언어 변경 시 전부 다시 마운트 (위젯 내부 문구 갱신)
    if (board.id !== renderedBoardId || i18n.locale !== renderedLocale) {
      destroyAll();
      renderedBoardId = board.id;
      renderedLocale = i18n.locale;
    }

    const bg = resolveBackground(board.background);
    canvas.style.background = bg.css ?? '';
    canvas.dataset.tone = bg.tone;

    const seen = new Set();
    for (const widget of board.widgets) {
      seen.add(widget.id);
      let entry = entries.get(widget.id);
      if (!entry) {
        entry = createEntry(widget);
        entries.set(widget.id, entry);
        canvas.append(entry.frame);
      } else if (entry.widget.state !== widget.state) {
        entry.instance?.update(widget.state);
      }
      entry.widget = widget;
      if (gestureId !== widget.id) applyRect(entry.frame, widget);
      entry.frame.style.zIndex = String(widget.z);
    }

    for (const [id, entry] of entries) {
      if (!seen.has(id)) {
        const hadFocus = entry.frame.contains(document.activeElement);
        destroyEntry(entry);
        entries.delete(id);
        if (hadFocus) canvas.focus();
      }
    }

    emptyState.hidden = board.widgets.length > 0;
  }

  store.subscribe((next, prev) => {
    if (next.boards !== prev.boards || next.settings !== prev.settings) render();
  });
  render();

  return {
    /** @param {string} widgetId */
    focusWidget(widgetId) {
      entries.get(widgetId)?.frame.focus();
    },
  };
}
