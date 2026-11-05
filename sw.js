// ClassBoardKit 서비스 워커 (F-010 오프라인).
// - 설치 시 앱 파일 전부를 미리 캐시하고, 같은 출처 GET은 캐시 우선으로 응답한다.
// - 새 버전은 대기 상태로 두고, 페이지가 "새로고침" 알림에서 SKIP_WAITING을 보내면 교체한다.
// - PRECACHE·BUILD는 tools/sw-stamp.mjs가 생성한다 (직접 고치지 말 것, 테스트가 검증).

const VERSION = '0.2.0';
const BUILD = '8e817f22';
const CACHE = `cbk-v${VERSION}-${BUILD}`;
const CACHE_PREFIX = 'cbk-';

const PRECACHE = [
  './',
  'assets/favicon.svg',
  'assets/icons.svg',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/icon-maskable.svg',
  'assets/icons/icon.svg',
  'index.html',
  'manifest.webmanifest',
  'src/app.js',
  'src/core/assets.js',
  'src/core/backgrounds.js',
  'src/core/board-ops.js',
  'src/core/geometry.js',
  'src/core/i18n.js',
  'src/core/persistence.js',
  'src/core/registry.js',
  'src/core/schema.js',
  'src/core/store.js',
  'src/core/transfer.js',
  'src/core/utils/debounce.js',
  'src/core/utils/id.js',
  'src/core/utils/memory-storage.js',
  'src/core/utils/random.js',
  'src/core/utils/sound.js',
  'src/locales/en.js',
  'src/locales/index.js',
  'src/locales/ko.js',
  'src/main.js',
  'src/styles/app.css',
  'src/styles/base.css',
  'src/styles/tokens.css',
  'src/styles/widgets.css',
  'src/ui/board-menu.js',
  'src/ui/canvas.js',
  'src/ui/dialog.js',
  'src/ui/display-controls.js',
  'src/ui/dock.js',
  'src/ui/dom.js',
  'src/ui/i18n-dom.js',
  'src/ui/idb-assets.js',
  'src/ui/popover.js',
  'src/ui/shell.js',
  'src/ui/updates.js',
  'src/vendor/qrcodegen.js',
  'src/widgets/clock/clock-logic.js',
  'src/widgets/clock/clock.css',
  'src/widgets/clock/index.js',
  'src/widgets/countdown/countdown-logic.js',
  'src/widgets/countdown/countdown.css',
  'src/widgets/countdown/index.js',
  'src/widgets/dice/dice-logic.js',
  'src/widgets/dice/dice.css',
  'src/widgets/dice/index.js',
  'src/widgets/draw/draw-logic.js',
  'src/widgets/draw/draw.css',
  'src/widgets/draw/index.js',
  'src/widgets/groups/groups-logic.js',
  'src/widgets/groups/groups.css',
  'src/widgets/groups/index.js',
  'src/widgets/image/image.css',
  'src/widgets/image/index.js',
  'src/widgets/index.js',
  'src/widgets/noise/index.js',
  'src/widgets/noise/noise-logic.js',
  'src/widgets/noise/noise.css',
  'src/widgets/qr/index.js',
  'src/widgets/qr/qr-loader.js',
  'src/widgets/qr/qr-logic.js',
  'src/widgets/qr/qr.css',
  'src/widgets/randomizer/index.js',
  'src/widgets/randomizer/randomizer-logic.js',
  'src/widgets/randomizer/randomizer.css',
  'src/widgets/scoreboard/index.js',
  'src/widgets/scoreboard/scoreboard-logic.js',
  'src/widgets/scoreboard/scoreboard.css',
  'src/widgets/shared/list.js',
  'src/widgets/shared/ui.js',
  'src/widgets/stopwatch/index.js',
  'src/widgets/stopwatch/stopwatch-logic.js',
  'src/widgets/stopwatch/stopwatch.css',
  'src/widgets/text/index.js',
  'src/widgets/text/text.css',
  'src/widgets/timer/index.js',
  'src/widgets/timer/timer-logic.js',
  'src/widgets/timer/timer.css',
  'src/widgets/traffic/index.js',
  'src/widgets/traffic/traffic.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // HTTP 캐시를 거치지 않고 새로 받아 옛 파일이 섞이지 않게 한다
      await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // 쿼리 문자열은 무시 (예: ./?lang=ko → ./)
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch (error) {
        // 오프라인에서 앱 안의 다른 경로로 들어오면 첫 화면을 보여 준다
        if (request.mode === 'navigate') {
          const index = await cache.match('./');
          if (index) return index;
        }
        throw error;
      }
    })(),
  );
});
