import { THEMES } from '../core/schema.js';
import { h, iconButton } from './dom.js';

/**
 * 정적 마크업의 data-i18n 속성을 번역한다.
 * - data-i18n="key"            → textContent
 * - data-i18n-aria-label="key" → aria-label 속성
 * - data-i18n-title="key"      → title 속성
 *
 * @param {ParentNode} root
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 */
export function translateDom(root, t) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const { i18n: key = '', i18nParams } = /** @type {HTMLElement} */ (el).dataset;
    // data-i18n-params: 매개변수가 있는 문구(알림 등)를 언어 변경 시 다시 채우기 위한 JSON
    el.textContent = i18nParams ? t(key, JSON.parse(i18nParams)) : t(key);
  }
  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', t(/** @type {HTMLElement} */ (el).dataset.i18nAriaLabel ?? ''));
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.setAttribute('title', t(/** @type {HTMLElement} */ (el).dataset.i18nTitle ?? ''));
  }
}

/** 정보 알림 자동 닫힘 시간 (ms) */
const INFO_TIMEOUT = 6000;

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
     * 닫을 수 있는 알림을 띄운다. 같은 키의 알림은 새 내용으로 교체한다.
     * - error: 사용자가 닫을 때까지 유지 (빨간 띠)
     * - info: 액션이 없으면 INFO_TIMEOUT 뒤 자동으로 닫힘 (파란 띠)
     *
     * @param {string} messageKey i18n 키
     * @param {{
     *   type?: 'error' | 'info',
     *   params?: Record<string, string | number>,
     *   action?: { labelKey: string, onClick: () => void },
     * }} [options]
     */
    notify(messageKey, { type = 'error', params, action } = {}) {
      el.notices.querySelector(`[data-key="${CSS.escape(messageKey)}"]`)?.remove();
      const close = iconButton({ iconName: 'close', label: i18n.t('common.close'), className: 'notice__close' });
      close.dataset.i18nAriaLabel = 'common.close';
      const textDataset = { i18n: messageKey, ...(params ? { i18nParams: JSON.stringify(params) } : {}) };
      const actionButton = action
        ? h('button', {
            className: 'notice__action',
            text: i18n.t(action.labelKey),
            attrs: { type: 'button' },
            dataset: { i18n: action.labelKey },
          })
        : null;
      const notice = h('div', { className: `notice notice--${type}`, dataset: { key: messageKey, type } }, [
        h('p', { className: 'notice__text', text: i18n.t(messageKey, params), dataset: textDataset }),
        actionButton,
        close,
      ]);
      close.addEventListener('click', () => notice.remove());
      actionButton?.addEventListener('click', () => {
        notice.remove();
        action?.onClick();
      });
      el.notices.append(notice);
      if (type === 'info' && !action) setTimeout(() => notice.remove(), INFO_TIMEOUT);
    },
  };
}
