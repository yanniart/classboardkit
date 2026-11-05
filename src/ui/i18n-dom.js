// 정적 마크업 번역 — 첫 화면(main.js)과 셸(shell.js)이 함께 쓴다 (의존성 없음)

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
