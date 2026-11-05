/**
 * 진입점: 첫 화면 문구·테마를 먼저 그리고(작은 모듈만 사용) 앱 본체(app.js)는 그 뒤에 불러온다.
 * 위젯이 늘어 모듈이 많아져도 첫 화면 표시(LCP)가 전체 로딩을 기다리지 않게 하기 위함 (M4).
 */
import { createI18n, detectLocale } from './core/i18n.js';
import { messages, FALLBACK_LOCALE } from './locales/index.js';
import { translateDom } from './ui/i18n-dom.js';

/** core/persistence.js와 같은 키 (여기서는 무거운 모듈을 불러오지 않으려고 직접 적음) */
const SETTINGS_KEY = 'classboardkit:settings';
const BOARDS_KEY_PREFIX = 'classboardkit:v';

function earlyPaint() {
  /** @type {any} */
  let saved = null;
  let hasBoards = false;
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    for (let i = 0; i < localStorage.length; i += 1) {
      if (localStorage.key(i)?.startsWith(BOARDS_KEY_PREFIX)) hasBoards = true;
    }
  } catch {
    // 저장소를 못 쓰거나 손상 → 앱 본체가 처리
  }
  const supported = Object.keys(messages);
  const locale = supported.includes(saved?.locale)
    ? saved.locale
    : detectLocale(navigator.languages ?? [navigator.language], supported, FALLBACK_LOCALE);
  const i18n = createI18n({ messages, locale, fallback: FALLBACK_LOCALE });
  document.documentElement.lang = locale;
  if (['light', 'dark', 'contrast'].includes(saved?.theme)) {
    document.documentElement.setAttribute('data-theme', saved.theme);
  }
  translateDom(document, i18n.t);
  // 저장된 보드가 있으면 빈 보드 안내는 앱이 판단할 때까지 숨김 (위젯이 있는 보드에서 깜박임 방지)
  if (hasBoards) {
    const empty = document.getElementById('canvas-empty');
    if (empty) empty.hidden = true;
  }
}

earlyPaint();
import('./app.js');
