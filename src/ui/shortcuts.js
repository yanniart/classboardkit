import { openContentDialog } from './dialog.js';
import { h } from './dom.js';

/**
 * 키보드 접근성 보조 (M6): 단축키 도움말(? 키·설정 버튼), "위젯 독으로 건너뛰기" 링크.
 *
 * @param {{
 *   root: HTMLElement,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 * }} deps
 */
export function mountShortcuts({ root, i18n }) {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const mod = isMac ? '⌘' : 'Ctrl';

  /** [키 묶음, 설명 키] — 키 이름은 번역하지 않는다 */
  const rows = () => [
    [['Tab', 'Shift+Tab'], 'shortcuts.next'],
    [['← ↑ → ↓'], 'shortcuts.move'],
    [['Alt + ← ↑ → ↓'], 'shortcuts.resize'],
    [['Delete'], 'shortcuts.remove'],
    [[`${mod}+Z`], 'shortcuts.undo'],
    [isMac ? ['⌘+Shift+Z'] : ['Ctrl+Y', 'Ctrl+Shift+Z'], 'shortcuts.redo'],
    [['Esc'], 'shortcuts.close'],
    [['?'], 'shortcuts.help'],
  ];

  let open = false;
  async function showHelp() {
    if (open) return;
    open = true;
    const { t } = i18n;
    await openContentDialog({
      title: t('shortcuts.title'),
      closeLabel: t('common.close'),
      className: 'shortcuts-dialog',
      build(body) {
        const list = h(
          'dl',
          { className: 'shortcuts' },
          rows().flatMap(([keys, label]) => [
            h('dt', {}, /** @type {string[]} */ (keys).flatMap((k, i) => [i > 0 ? document.createTextNode(' / ') : null, h('kbd', { text: k })])),
            h('dd', { text: t(/** @type {string} */ (label)) }),
          ]),
        );
        body.append(list, h('p', { className: 'dialog__message', text: t('shortcuts.hint') }));
      },
    });
    open = false;
  }

  /** @param {EventTarget | null} target */
  const isEditable = (target) =>
    target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));

  document.addEventListener('keydown', (event) => {
    if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (isEditable(event.target) || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    void showHelp();
  });

  root.querySelector('#shortcuts-open')?.addEventListener('click', () => {
    /** @type {HTMLDetailsElement | null} */ (root.querySelector('#settings'))?.removeAttribute('open');
    void showHelp();
  });

  // 건너뛰기: 첫 독 항목으로 포커스 (독이 접혀 있으면 펼치기 버튼)
  root.querySelector('#skip-to-dock')?.addEventListener('click', () => {
    /** @type {HTMLElement | null} */ (root.querySelector('.dock__item:not([hidden]), .dock__toggle'))?.focus();
  });

  return { showHelp };
}
