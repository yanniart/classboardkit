/**
 * 앱 공용 화면 낭독기 알림 (M6, TRD 2.2.4). 보이지 않는 status 영역 하나에 짧은 문구를 넣는다.
 * 알림 띠(#notices)는 눈에 보이는 안내, 이것은 낭독기 전용(키보드 이동 위치 등).
 */

/** 연속 입력(화살표 반복)은 마지막 값만 읽도록 기다리는 시간 */
const DEBOUNCE_MS = 300;

/** @param {HTMLElement} [root] */
export function createAnnouncer(root = document.body) {
  const el = document.createElement('p');
  el.className = 'sr-only';
  el.id = 'announcer';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  root.append(el);
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  return {
    /** @param {string} text */
    say(text) {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        el.textContent = '';
        // 비운 다음 프레임에 넣어야 같은 문구도 다시 읽힘
        requestAnimationFrame(() => (el.textContent = text));
        timer = null;
      }, DEBOUNCE_MS);
    },
  };
}
