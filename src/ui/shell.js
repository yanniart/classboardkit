import { THEMES } from '../core/schema.js';
import { h, iconButton } from './dom.js';

/**
 * 정적 마크업의 data-i18n 속성을 번역한다.
 * - data-i18n="key"            → textContent
 * - data-i18n-aria-label="key" → aria-label 속성
 * - data-i18n-title="key"      → title 속성
 *
 * @param {ParentNode} root
 * @param {(key: string) => string} t
 */
export function translateDom(root, t) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(/** @type {HTMLElement} */ (el).dataset.i18n ?? '');
  }
  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', t(/** @type {HTMLElement} */ (el).dataset.i18nAriaLabel ?? ''));
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.setAttribute('title', t(/** @type {HTMLElement} */ (el).dataset.i18nTitle ?? ''));
  }
}

/** @param {string} theme */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/**
 * @param {HTMLSelectElement} select
 * @param {{ value: string, label: string }[]} options
 * @param {string} selected
 */
function fillSelect(select, options, selected) {
  select.replaceChildren(
    ...options.map(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = value === selected;
      return option;
    }),
  );
}

/**
 * 앱 셸: 언어·테마 설정, 정적 문구 번역, 알림.
 * 언어 변경 시 가장 먼저 i18n을 바꿔야 하므로 다른 UI 모듈보다 먼저 마운트한다.
 *
 * @param {{
 *   root: HTMLElement,
 *   store: ReturnType<typeof import('../core/store.js').createStore>,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 *   localeNames: Record<string, string>,
 * }} deps
 */
export function mountShell({ root, store, i18n, localeNames }) {
  const el = {
    locale: /** @type {HTMLSelectElement} */ (root.querySelector('#setting-locale')),
    theme: /** @type {HTMLSelectElement} */ (root.querySelector('#setting-theme')),
    notices: /** @type {HTMLElement} */ (root.querySelector('#notices')),
  };

  /** @param {Record<string, unknown>} patch */
  const updateSettings = (patch) => store.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  function render() {
    const { settings } = store.getState();
    const t = i18n.t;

    if (i18n.locale !== settings.locale) i18n.setLocale(settings.locale);
    document.documentElement.lang = i18n.locale;
    document.title = `${t('app.name')} · ${t('app.tagline')}`;
    translateDom(root, t);
    applyTheme(settings.theme);

    fillSelect(
      el.locale,
      i18n.supported.map((code) => ({ value: code, label: localeNames[code] ?? code })),
      i18n.locale,
    );
    fillSelect(
      el.theme,
      THEMES.map((value) => ({ value, label: t(`settings.themes.${value}`) })),
      settings.theme,
    );
  }

  el.locale.addEventListener('change', () => updateSettings({ locale: el.locale.value }));
  el.theme.addEventListener('change', () => updateSettings({ theme: el.theme.value }));

  store.subscribe((next, prev) => {
    if (next.settings !== prev.settings) render();
  });
  render();

  return {
    /**
     * 닫을 수 있는 알림을 띄운다. 같은 메시지는 중복 표시하지 않는다.
     * @param {string} messageKey i18n 키
     */
    notify(messageKey) {
      if (el.notices.querySelector(`[data-key="${CSS.escape(messageKey)}"]`)) return;
      const close = iconButton({ iconName: 'close', label: i18n.t('common.close'), className: 'notice__close' });
      close.dataset.i18nAriaLabel = 'common.close';
      const notice = h('div', { className: 'notice', dataset: { key: messageKey } }, [
        h('p', { className: 'notice__text', text: i18n.t(messageKey), dataset: { i18n: messageKey } }),
        close,
      ]);
      close.addEventListener('click', () => notice.remove());
      el.notices.append(notice);
    },
  };
}
