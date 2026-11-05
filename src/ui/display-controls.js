/**
 * 전체 화면·화면 켜두기 (F-009).
 * 지원하지 않는 브라우저에서는 버튼을 숨긴다 (기능 감지).
 */

/** @typedef {Document & { webkitFullscreenEnabled?: boolean, webkitFullscreenElement?: Element | null, webkitExitFullscreen?: () => Promise<void> | void }} PrefixedDocument */
/** @typedef {HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }} PrefixedElement */

const doc = /** @type {PrefixedDocument} */ (document);

/** iPadOS Safari 등은 webkit 접두어만 지원할 수 있다 */
const fullscreenEnabled = () => Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
const fullscreenElement = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

async function enterFullscreen() {
  const el = /** @type {PrefixedElement} */ (document.documentElement);
  if (el.requestFullscreen) await el.requestFullscreen();
  else await el.webkitRequestFullscreen?.();
}

async function exitFullscreen() {
  if (doc.exitFullscreen) await doc.exitFullscreen();
  else await doc.webkitExitFullscreen?.();
}

/**
 * @param {{
 *   root: HTMLElement,
 *   store: ReturnType<typeof import('../core/store.js').createStore>,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 *   notify: ReturnType<typeof import('./shell.js').mountShell>['notify'],
 * }} deps
 */
export function mountDisplayControls({ root, store, i18n, notify }) {
  const fullscreenButton = /** @type {HTMLButtonElement} */ (root.querySelector('#fullscreen-toggle'));
  const awakeButton = /** @type {HTMLButtonElement} */ (root.querySelector('#keep-awake-toggle'));
  const { t } = i18n;

  // ── 전체 화면 ──
  function renderFullscreen() {
    const active = fullscreenElement() !== null;
    const label = t(active ? 'display.exitFullscreen' : 'display.fullscreen');
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.setAttribute('aria-label', label);
    fullscreenButton.title = label;
    fullscreenButton.querySelector('use')?.setAttribute('href', `assets/icons.svg#${active ? 'minimize' : 'maximize'}`);
  }

  if (fullscreenEnabled()) {
    fullscreenButton.hidden = false;
    fullscreenButton.addEventListener('click', async () => {
      try {
        if (fullscreenElement()) await exitFullscreen();
        else await enterFullscreen();
      } catch (error) {
        // 사용자 제스처 없음·권한 정책 등 — 상태만 다시 맞춘다
        console.info('[fullscreen]', error);
      }
      renderFullscreen();
    });
    document.addEventListener('fullscreenchange', renderFullscreen);
    document.addEventListener('webkitfullscreenchange', renderFullscreen);
  }

  // ── 화면 켜두기 (Wake Lock) ──
  // 설정(settings.keepAwake)은 저장하고, 실제 잠금은 세션마다 다시 요청한다.
  /** @type {WakeLockSentinel | null} */
  let sentinel = null;
  const wanted = () => store.getState().settings.keepAwake === true;

  async function acquire() {
    if (sentinel || !wanted() || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        // 탭 숨김 등으로 시스템이 해제함 → visible 시 재요청
        sentinel = null;
      });
    } catch (error) {
      // 저전력 모드·사용자 제스처 없음 등. 제스처 없이 실패한 경우는 다음 제스처에서 재시도
      console.info('[wakeLock]', error);
      return error;
    }
    return null;
  }

  async function release() {
    const current = sentinel;
    sentinel = null;
    await current?.release().catch(() => {});
  }

  function renderAwake() {
    const label = t('display.keepAwake');
    awakeButton.setAttribute('aria-pressed', String(wanted()));
    awakeButton.setAttribute('aria-label', label);
    awakeButton.title = label;
  }

  if ('wakeLock' in navigator) {
    awakeButton.hidden = false;
    awakeButton.addEventListener('click', async () => {
      const next = !wanted();
      store.update((s) => ({ ...s, settings: { ...s.settings, keepAwake: next } }));
      if (next) {
        const error = await acquire();
        if (error) notify('display.keepAwakeFailed');
      } else {
        await release();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void acquire();
    });
    // 저장된 설정이 켜져 있으면 첫 사용자 제스처에서 요청 (일부 브라우저는 제스처 필요)
    if (wanted()) {
      void acquire();
      document.addEventListener('pointerdown', () => void acquire(), { once: true, capture: true });
    }
  }

  store.subscribe((next, prev) => {
    if (next.settings !== prev.settings) {
      renderFullscreen();
      renderAwake();
    }
  });
  renderFullscreen();
  renderAwake();
}
