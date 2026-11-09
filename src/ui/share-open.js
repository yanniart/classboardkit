import { decodeShare } from '../core/share.js';
import { parseImport } from '../core/transfer.js';
import { addBoardsOp } from '../core/undoable.js';
import { decompress, isShareSupported } from './share-codec.js';
import { openDialog } from './dialog.js';

/**
 * 공유 링크 열기 (F-012, M5 결정 D6). 링크를 여는 것만으로는 데이터가 바뀌지 않고, 확인 후 새 보드로 추가한다.
 * 결과와 관계없이 주소의 #share=…는 먼저 지운다 (새로고침해도 다시 묻지 않게).
 *
 * @param {{
 *   encoded: string,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 *   notify: ReturnType<typeof import('./shell.js').mountShell>['notify'],
 *   actions: ReturnType<typeof import('./actions.js').createActions>,
 * }} deps
 */
export async function openSharedLink({ encoded, i18n, notify, actions }) {
  const { t } = i18n;
  history.replaceState(history.state, '', `${location.pathname}${location.search}`);

  if (!isShareSupported()) {
    notify('share.error.unsupported');
    return;
  }

  const decoded = await decodeShare(encoded, decompress);
  if (!decoded.ok) {
    console.info('[share]', decoded.error, decoded.detail);
    notify(decoded.error === 'newer-version' ? 'transfer.error.newerVersion' : 'share.error.invalid');
    return;
  }
  const result = parseImport(decoded.text);
  if (!result.ok) {
    console.info('[share]', result.error, result.detail);
    notify(result.error === 'newer-version' ? 'transfer.error.newerVersion' : 'share.error.invalid');
    return;
  }

  // 공유 링크는 보드 1개 (ADR-0008). 이미지는 포함되지 않으므로 assets는 무시
  const [board] = result.boards;
  const ok = await openDialog({
    title: t('share.open.title'),
    message: t('share.open.message', { name: board.name, count: board.widgets.length }),
    confirmLabel: t('share.open.confirm'),
    cancelLabel: t('dialog.cancel'),
  });
  if (!ok) return;
  actions.perform((s) => addBoardsOp(s, [board]));
  notify('share.added', { type: 'info', params: { name: board.name } });
}
