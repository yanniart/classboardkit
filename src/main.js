import { createStore } from './core/store.js';
import { createDefaultData } from './core/schema.js';
import { loadData, saveData, startAutoSave } from './core/persistence.js';
import { createI18n, detectLocale } from './core/i18n.js';
import { createMemoryStorage } from './core/utils/memory-storage.js';
import { unlockAudio } from './core/utils/sound.js';
import { messages, localeNames, FALLBACK_LOCALE } from './locales/index.js';
import { createDefaultRegistry } from './widgets/index.js';
import { mountShell } from './ui/shell.js';
import { mountBoardMenu } from './ui/board-menu.js';
import { mountDisplayControls } from './ui/display-controls.js';
import { isStandalone, registerServiceWorker, requestPersistentStorage } from './ui/updates.js';
import { mountCanvas } from './ui/canvas.js';
import { mountDock } from './ui/dock.js';
import { installPopoverBehavior } from './ui/popover.js';

/** 저장 문제 유형 → 알림 메시지 키 */
const ISSUE_MESSAGES = {
  corrupt: 'storage.corrupt',
  invalid: 'storage.invalid',
  'newer-version': 'storage.newerVersion',
  quota: 'storage.quota',
  write: 'storage.write',
};

/**
 * localStorage 사용 가능 여부를 실제 쓰기로 확인한다.
 * (사생활 보호 모드·차단 시 접근만으로 예외가 나거나 쓰기가 실패할 수 있음)
 */
function resolveStorage() {
  try {
    const storage = window.localStorage;
    const probe = '__classboardkit_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return { storage, persistent: true };
  } catch {
    return { storage: createMemoryStorage(), persistent: false };
  }
}

/** 위젯별 스타일시트를 한 번씩 로드한다 (CSP: 같은 출처 <link>만 허용) */
function loadWidgetStyles(registry) {
  for (const def of registry.list()) {
    if (!def.styleUrl) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = def.styleUrl;
    document.head.append(link);
  }
}

function boot() {
  const root = document.getElementById('app');
  const canvas = document.getElementById('canvas');
  const emptyState = document.getElementById('canvas-empty');
  const dock = document.getElementById('dock');
  if (!root || !canvas || !emptyState || !dock) throw new Error('App markup is incomplete');

  const initialLocale = detectLocale(
    navigator.languages ?? [navigator.language],
    Object.keys(messages),
    FALLBACK_LOCALE,
  );
  const i18n = createI18n({
    messages,
    locale: initialLocale,
    fallback: FALLBACK_LOCALE,
    onMissing: (key, locale) => console.warn(`[i18n] missing "${key}" for "${locale}"`),
  });

  const { storage, persistent } = resolveStorage();
  const { data, issues } = loadData({
    storage,
    createDefault: () =>
      createDefaultData({ boardName: i18n.t('board.defaultName'), locale: initialLocale }),
  });

  // 저장된 언어가 더 이상 지원되지 않으면 감지된 언어로 대체
  if (!i18n.supported.includes(data.settings.locale)) data.settings.locale = initialLocale;

  const registry = createDefaultRegistry();
  loadWidgetStyles(registry);

  const store = createStore({ boards: data.boards, settings: data.settings });

  // 셸이 먼저 구독해야 언어 변경이 다른 모듈보다 먼저 반영된다
  const shell = mountShell({ root, store, i18n, localeNames });
  mountBoardMenu({ root, store, i18n, notify: shell.notify });
  mountDisplayControls({ root, store, i18n, notify: shell.notify });
  const board = mountCanvas({ canvas, emptyState, store, registry, i18n });
  mountDock({ dock, store, registry, i18n, onAdded: (id) => board.focusWidget(id) });
  installPopoverBehavior(root);

  if (!persistent) shell.notify('storage.unavailable');
  for (const issue of issues) shell.notify(ISSUE_MESSAGES[issue.type]);

  const autoSave = startAutoSave({
    storage,
    store,
    onIssue: (issue) => shell.notify(ISSUE_MESSAGES[issue.type]),
  });

  // 최초 실행·복구 직후 상태를 바로 기록 (변경 이벤트를 기다리지 않음)
  if (persistent) {
    const issue = saveData(storage, store.getState());
    if (issue) shell.notify(ISSUE_MESSAGES[issue.type]);
  }

  // 자동재생 정책: 첫 사용자 제스처에서 오디오 활성화 (타이머 종료음)
  document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

  // 탭 전환·종료 직전 대기 중인 저장을 즉시 실행
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autoSave.flush();
  });
  window.addEventListener('pagehide', () => autoSave.flush());

  // 오프라인 지원: 앱이 정상 시작된 뒤에 등록 (첫 화면 로딩과 경쟁하지 않게)
  registerServiceWorker({ notify: shell.notify });
  if (persistent && isStandalone()) requestPersistentStorage();
}

boot();
