/**
 * 실행 취소·다시 실행 버튼과 단축키 (F-014).
 * - Ctrl/⌘+Z = 실행 취소, Ctrl+Shift+Z · Ctrl+Y · ⌘⇧Z = 다시 실행
 * - 입력 요소·contenteditable·위젯 설정 패널·대화상자 안에서는 브라우저 기본 동작(글자 단위 취소)을 그대로 둔다
 *
 * @param {{
 *   root: HTMLElement,
 *   store: ReturnType<typeof import('../core/store.js').createStore>,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 *   actions: ReturnType<typeof import('./actions.js').createActions>,
 * }} deps
 */
export function mountUndoControls({ root, store, i18n, actions }) {
  const undoButton = /** @type {HTMLButtonElement} */ (root.querySelector('#undo-button'));
  const redoButton = /** @type {HTMLButtonElement} */ (root.querySelector('#redo-button'));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function render() {
    undoButton.disabled = !actions.canUndo();
    redoButton.disabled = !actions.canRedo();
    const undoLabel = i18n.t('history.undo');
    const redoLabel = i18n.t('history.redo');
    undoButton.setAttribute('aria-label', undoLabel);
    redoButton.setAttribute('aria-label', redoLabel);
    undoButton.title = `${undoLabel} (${isMac ? '⌘Z' : 'Ctrl+Z'})`;
    redoButton.title = `${redoLabel} (${isMac ? '⌘⇧Z' : 'Ctrl+Y'})`;
  }

  undoButton.addEventListener('click', () => actions.undo());
  redoButton.addEventListener('click', () => actions.redo());

  /** @param {EventTarget | null} target */
  function keepNativeUndo(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .w-panel, dialog'),
    );
  }

  document.addEventListener('keydown', (event) => {
    if (event.isComposing || event.altKey) return;
    const mod = isMac ? event.metaKey : event.ctrlKey;
    if (!mod) return;
    // 한글 자판 등에서도 동작하도록 물리 키(code) 기준
    const isZ = event.code === 'KeyZ';
    const isY = event.code === 'KeyY' && !event.shiftKey && !isMac;
    if (!isZ && !isY) return;
    if (keepNativeUndo(event.target) || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    if (isY || event.shiftKey) actions.redo();
    else actions.undo();
  });

  actions.onChange(render);
  store.subscribe((next, prev) => {
    if (next.settings.locale !== prev.settings.locale) render();
  });
  render();
}
