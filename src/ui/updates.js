/**
 * 서비스 워커 등록과 새 버전 알림 (F-010).
 * 새 sw.js가 설치되면 대기시키고, 사용자가 "새로고침"을 누르면 교체 후 다시 불러온다.
 * (수업 중 갑자기 새로고침되어 타이머 등이 끊기지 않도록 자동 교체하지 않는다)
 */

/**
 * 브라우저가 저장소를 임의로 정리하지 않도록 요청한다 (TRD 3, Safari 정리 정책 대응).
 * Firefox는 권한 창을 띄우므로 페이지 로드 때가 아니라 의미 있는 순간에만 호출한다
 * (홈 화면 앱으로 실행, 사용자가 백업을 내보냄).
 */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

/** 홈 화면(설치된 PWA)으로 실행 중인지 */
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  /** @type {{ standalone?: boolean }} */ (navigator).standalone === true;

/** 열린 탭에서 업데이트 확인 최소 간격 */
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

/**
 * @param {{ notify: ReturnType<typeof import('./shell.js').mountShell>['notify'] }} deps
 */
export function registerServiceWorker({ notify }) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const sw = navigator.serviceWorker;

  // 첫 설치(clients.claim)로 인한 controllerchange에는 새로고침하지 않는다
  const hadController = sw.controller !== null;
  let reloading = false;
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  /** @param {ServiceWorker} worker */
  const promptUpdate = (worker) =>
    notify('update.available', {
      type: 'info',
      action: { labelKey: 'update.reload', onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
    });

  sw.register('./sw.js')
    .then((registration) => {
      if (registration.waiting && sw.controller) promptUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && sw.controller) promptUpdate(worker);
        });
      });

      // 교실 탭은 며칠씩 열려 있을 수 있다 → 다시 보일 때 가끔 확인
      let lastCheck = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL) return;
        lastCheck = Date.now();
        registration.update().catch(() => {});
      });
    })
    .catch((error) => console.info('[sw] registration failed', error));
}
