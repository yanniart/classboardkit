import {
  addBoard,
  deleteBoard,
  duplicateBoard,
  getActiveBoard,
  importBoards,
  renameBoard,
  setActiveBoard,
  setBackground,
} from '../core/board-ops.js';
import { BACKGROUND_PRESETS, resolveBackground } from '../core/backgrounds.js';
import {
  MAX_IMPORT_SIZE,
  createExport,
  daysSince,
  exportFileName,
  bytesToBase64,
  parseImport,
  serializeExport,
  verifyAssets,
} from '../core/transfer.js';
import { openDialog } from './dialog.js';
import { requestPersistentStorage } from './updates.js';
import { ImagePrepareError, getAssetStore, getAssetUrl, storeImageFile } from './idb-assets.js';
import { referencedAssetIds } from '../core/assets.js';
import { h, icon } from './dom.js';

/** 가져오기 오류 코드 → 알림 메시지 키 */
const IMPORT_ERRORS = {
  'too-large': 'transfer.error.tooLarge',
  'not-json': 'transfer.error.notJson',
  'wrong-app': 'transfer.error.wrongApp',
  'newer-version': 'transfer.error.newerVersion',
  invalid: 'transfer.error.invalid',
  empty: 'transfer.error.empty',
};

/** 배경 이미지 오류 코드 → 알림 메시지 키 (이미지 위젯 문구 재사용) */
const BACKGROUND_ERRORS = {
  unsupported: 'widget.image.error.unsupported',
  type: 'widget.image.error.type',
  'too-large': 'widget.image.error.tooLarge',
  decode: 'widget.image.error.decode',
};

/**
 * 보드 메뉴 (F-004 보드 관리, F-005 내보내기/가져오기, F-006 배경).
 *
 * @param {{
 *   root: HTMLElement,
 *   store: ReturnType<typeof import('../core/store.js').createStore>,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 *   notify: ReturnType<typeof import('./shell.js').mountShell>['notify'],
 * }} deps
 */
export function mountBoardMenu({ root, store, i18n, notify }) {
  const el = {
    details: /** @type {HTMLDetailsElement} */ (root.querySelector('#board-menu')),
    name: /** @type {HTMLElement} */ (root.querySelector('#board-name')),
    list: /** @type {HTMLElement} */ (root.querySelector('#board-list')),
    swatches: /** @type {HTMLElement} */ (root.querySelector('#background-swatches')),
    actions: /** @type {HTMLElement} */ (root.querySelector('#board-actions')),
    transfer: /** @type {HTMLElement} */ (root.querySelector('#board-transfer')),
    backupStatus: /** @type {HTMLElement} */ (root.querySelector('#board-backup-status')),
    file: /** @type {HTMLInputElement} */ (root.querySelector('#import-file')),
    bgFile: /** @type {HTMLInputElement} */ (root.querySelector('#background-file')),
  };
  const { t } = i18n;
  const close = () => (el.details.open = false);

  /** 대화상자 버튼 공통 라벨 */
  const buttons = () => ({ cancelLabel: t('dialog.cancel') });

  /** "보드 n" 형식의 겹치지 않는 새 이름 */
  function nextBoardName() {
    const names = new Set(store.getState().boards.map((b) => b.name));
    for (let n = store.getState().boards.length + 1; ; n += 1) {
      const name = t('board.newName', { n });
      if (!names.has(name)) return name;
    }
  }

  const actions = {
    async new() {
      close();
      store.update((s) => addBoard(s, nextBoardName()));
    },
    async rename() {
      const board = getActiveBoard(store.getState());
      if (!board) return;
      close();
      const name = await openDialog({
        title: t('board.renameTitle'),
        input: { value: board.name, label: t('board.nameLabel') },
        confirmLabel: t('dialog.save'),
        ...buttons(),
      });
      if (typeof name === 'string') store.update((s) => renameBoard(s, board.id, name));
    },
    async duplicate() {
      const board = getActiveBoard(store.getState());
      if (!board) return;
      close();
      store.update((s) => duplicateBoard(s, board.id, t('board.copyName', { name: board.name })));
    },
    async delete() {
      const board = getActiveBoard(store.getState());
      if (!board) return;
      close();
      const ok = await openDialog({
        title: t('board.deleteTitle'),
        message: t('board.deleteMessage', { name: board.name, count: board.widgets.length }),
        confirmLabel: t('dialog.delete'),
        danger: true,
        ...buttons(),
      });
      if (ok) store.update((s) => deleteBoard(s, board.id, t('board.defaultName')));
    },
  };

  /**
   * JSON 파일을 내려받게 한다 (CSP img/blob 허용 범위 내 <a download>).
   * @param {any[]} boards
   * @param {string | null} name null이면 전체 내보내기
   */
  async function download(boards, name) {
    const { settings } = store.getState();
    const now = new Date();
    const assets = await collectAssets(boards);
    const data = createExport(boards, { now, assets, ...(name === null ? { settings } : {}) });
    const file = exportFileName(name, now);
    const url = URL.createObjectURL(new Blob([serializeExport(data)], { type: 'application/json' }));
    const link = h('a', { attrs: { href: url, download: file } });
    document.body.append(link);
    link.click();
    link.remove();
    // 일부 브라우저는 클릭 직후 해제하면 다운로드가 취소됨 → 잠시 뒤 해제
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    store.update((s) => ({ ...s, settings: { ...s.settings, lastExportAt: now.toISOString() } }));
    notify('transfer.exported', { type: 'info', params: { file } });
    requestPersistentStorage();
  }

  /**
   * 보드가 참조하는 이미지를 내보내기용 base64로 (M4 결정 D2). 저장소에 없는 이미지는 건너뜀
   * @param {any[]} boards
   */
  async function collectAssets(boards) {
    /** @type {Record<string, import('../core/transfer.js').ExportedAsset>} */
    const out = {};
    const ids = referencedAssetIds(boards);
    if (ids.size === 0) return out;
    const assets = await getAssetStore();
    if (!assets) return out;
    for (const id of ids) {
      const rec = await assets.get(id);
      if (!rec) continue;
      const data = bytesToBase64(new Uint8Array(await rec.blob.arrayBuffer()));
      out[id] = { type: rec.type, width: rec.width, height: rec.height, ...(rec.tone ? { tone: rec.tone } : {}), data };
    }
    return out;
  }

  /**
   * 가져온 이미지를 보드 반영 전에 저장 (내용 해시 확인 후). 실패하면 오류 키
   * @param {import('../core/transfer.js').ImportedAsset[]} imported
   * @returns {Promise<string | null>}
   */
  async function storeImportedAssets(imported) {
    if (imported.length === 0) return null;
    const problem = await verifyAssets(imported);
    if (problem) {
      console.info('[import]', problem);
      return IMPORT_ERRORS.invalid;
    }
    const assets = await getAssetStore();
    // 이미지를 저장할 수 없는 환경이면 보드만 가져온다 (이미지는 "저장할 수 없음" 표시)
    if (!assets) return null;
    for (const a of imported) {
      const id = await assets.put(new Blob([a.bytes], { type: a.type }), a);
      if (id !== a.id) return IMPORT_ERRORS.invalid;
    }
    return null;
  }

  /** @param {File} file */
  async function importFile(file) {
    let text;
    try {
      // 크기 확인은 읽기 전에 먼저 (거대한 파일을 메모리에 올리지 않음)
      if (file.size > MAX_IMPORT_SIZE) {
        notify('transfer.error.tooLarge');
        return;
      }
      text = await file.text();
    } catch {
      notify('transfer.error.read');
      return;
    }
    const result = parseImport(text);
    if (!result.ok) {
      console.info('[import]', result.error, result.detail);
      notify(IMPORT_ERRORS[result.error]);
      return;
    }
    try {
      const assetError = await storeImportedAssets(result.assets);
      if (assetError) {
        notify(assetError);
        return;
      }
    } catch (error) {
      console.info('[import] could not store images', error);
      notify('transfer.error.read');
      return;
    }
    store.update((s) => importBoards(s, result.boards));
    notify('transfer.imported', { type: 'info', params: { n: result.boards.length } });
  }

  const transferActions = {
    async export() {
      const board = getActiveBoard(store.getState());
      if (!board) return;
      close();
      await download([board], board.name);
    },
    async exportAll() {
      close();
      await download(store.getState().boards, null);
    },
    async import() {
      close();
      el.file.click();
    },
  };

  el.file.addEventListener('change', () => {
    const file = el.file.files?.[0];
    // 같은 파일을 다시 고를 수 있도록 비운다
    el.file.value = '';
    if (file) void importFile(file);
  });

  /**
   * @param {HTMLElement} container
   * @param {Record<string, () => Promise<void>>} handlers
   */
  function delegate(container, handlers) {
    container.addEventListener('click', (event) => {
      const button = /** @type {HTMLElement} */ (event.target).closest('[data-action]');
      const action = button && /** @type {HTMLElement} */ (button).dataset.action;
      if (action && Object.hasOwn(handlers, action)) void handlers[action]();
    });
  }
  delegate(el.actions, actions);
  delegate(el.transfer, transferActions);

  function renderBackupStatus() {
    const days = daysSince(store.getState().settings.lastExportAt);
    el.backupStatus.textContent =
      days === null ? t('board.backup.never') : days === 0 ? t('board.backup.today') : t('board.backup.daysAgo', { n: days });
    // 백업한 적 없거나 2주 이상 지났으면 강조
    el.backupStatus.classList.toggle('board-menu__backup--stale', days === null || days >= 14);
  }

  function renderList() {
    const state = store.getState();
    const active = getActiveBoard(state);
    el.list.replaceChildren(
      ...state.boards.map((board) => {
        const current = board.id === active?.id;
        const button = h(
          'button',
          {
            className: 'board-menu__item',
            attrs: { type: 'button', ...(current ? { 'aria-current': 'true' } : {}) },
          },
          [
            h('span', { className: 'board-menu__item-name', text: board.name }),
            h('span', { className: 'board-menu__item-count', text: String(board.widgets.length) }),
            current ? icon('check') : null,
          ],
        );
        button.addEventListener('click', () => {
          store.update((s) => setActiveBoard(s, board.id));
          close();
        });
        return h('li', {}, [button]);
      }),
    );
  }

  function renderSwatches() {
    const board = getActiveBoard(store.getState());
    const current = board ? resolveBackground(board.background).preset?.key : null;
    el.swatches.replaceChildren(
      ...BACKGROUND_PRESETS.map((preset) => {
        const label = t(`background.${preset.key}`);
        const swatch = h('button', {
          className: `swatch${preset.key === 'default' ? ' swatch--default' : ''}`,
          attrs: { type: 'button', 'aria-label': label, title: label, 'aria-pressed': String(preset.key === current) },
        });
        if (preset.css) swatch.style.background = preset.css;
        swatch.addEventListener('click', () => {
          const id = getActiveBoard(store.getState())?.id;
          if (id) store.update((s) => setBackground(s, id, { type: preset.type, value: preset.value }));
        });
        return swatch;
      }),
      imageSwatch(board),
    );
  }

  /**
   * 사용자 이미지 배경 견본 (F-007): 선택 중이면 미리보기, 아니면 이미지 아이콘
   * @param {any} board
   */
  function imageSwatch(board) {
    const imageId = board ? resolveBackground(board.background).imageId : undefined;
    const label = t('background.image');
    const swatch = h(
      'button',
      {
        className: 'swatch swatch--image',
        attrs: { type: 'button', 'aria-label': label, title: label, 'aria-pressed': String(Boolean(imageId)) },
      },
      [icon('image')],
    );
    if (imageId) {
      getAssetUrl(imageId).then((entry) => {
        if (entry) swatch.style.backgroundImage = `url("${entry.url}")`;
      });
    }
    swatch.addEventListener('click', () => el.bgFile.click());
    return swatch;
  }

  el.bgFile.addEventListener('change', async () => {
    const file = el.bgFile.files?.[0];
    el.bgFile.value = '';
    const boardId = getActiveBoard(store.getState())?.id;
    if (!file || !boardId) return;
    try {
      const id = await storeImageFile(file);
      store.update((s) => setBackground(s, boardId, { type: 'image', value: id }));
    } catch (error) {
      console.info('[background] could not use image', error);
      const code = error instanceof ImagePrepareError ? error.code : 'decode';
      notify(BACKGROUND_ERRORS[/** @type {keyof typeof BACKGROUND_ERRORS} */ (code)] ?? BACKGROUND_ERRORS.decode);
    }
  });

  function render() {
    const board = getActiveBoard(store.getState());
    el.name.textContent = board?.name ?? '';
    renderList();
    renderSwatches();
    renderBackupStatus();
  }

  store.subscribe((next, prev) => {
    if (next.boards !== prev.boards || next.settings !== prev.settings) render();
  });
  render();
}
