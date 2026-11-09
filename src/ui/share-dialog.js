import {
  boardHasImages,
  boardHasNames,
  buildSharePayload,
  buildShareUrl,
  encodeShare,
  shareLengthStatus,
} from '../core/share.js';
import { compress } from './share-codec.js';
import { openContentDialog } from './dialog.js';
import { h } from './dom.js';
import { svg } from '../widgets/shared/ui.js';
import { loadQrCodegen } from '../widgets/qr/qr-loader.js';
import { QUIET_ZONE, qrPath } from '../widgets/qr/qr-logic.js';

/**
 * 공유 링크 대화상자 (F-012, ADR-0008). 보드 메뉴가 열 때 동적으로 불러온다.
 *
 * @param {{
 *   board: any,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 *   onExport: () => void,
 * }} deps onExport: 링크가 너무 길 때 "파일로 내보내기"
 */
export function openShareDialog({ board, i18n, onExport }) {
  const { t } = i18n;
  return openContentDialog({
    title: t('share.title', { name: board.name }),
    closeLabel: t('common.close'),
    className: 'share-dialog',
    build(body, done) {
      const hasNames = boardHasNames(board);
      const exclude = /** @type {HTMLInputElement} */ (
        h('input', { attrs: { type: 'checkbox', id: 'share-exclude-names' } })
      );
      exclude.checked = true;

      const link = /** @type {HTMLInputElement} */ (
        h('input', {
          className: 'field__control share__link',
          attrs: { type: 'text', readonly: '', id: 'share-link', 'aria-label': t('share.linkLabel') },
        })
      );
      const length = h('span', { className: 'share__length' });
      const status = h('p', { className: 'share__status', attrs: { role: 'status', 'aria-live': 'polite' } });
      const copyButton = h('button', {
        className: 'button button--primary',
        text: t('share.copy'),
        attrs: { type: 'button', id: 'share-copy' },
      });
      const nativeButton =
        typeof navigator.share === 'function'
          ? h('button', { className: 'button', text: t('share.native'), attrs: { type: 'button', id: 'share-native' } })
          : null;
      const linkBox = h('div', { className: 'share__link-box' }, [
        link,
        h('div', { className: 'share__row' }, [length, h('span', { className: 'share__spacer' }), nativeButton, copyButton]),
      ]);
      const qrBox = h('div', { className: 'share__qr', attrs: { hidden: '' } });
      const tooLongBox = h('div', { className: 'share__too-long', attrs: { hidden: '' } });

      // append(null)은 "null" 글자를 넣으므로 걸러서 넣는다
      const parts = [
        hasNames
          ? h('label', { className: 'share__option' }, [exclude, h('span', { text: t('share.excludeNames') })])
          : null,
        boardHasImages(board) ? h('p', { className: 'share__note', text: t('share.imagesExcluded') }) : null,
        linkBox,
        status,
        qrBox,
        tooLongBox,
        h('p', { className: 'share__privacy', text: t('share.privacy') }),
      ];
      body.append(...parts.filter((x) => x !== null));

      let seq = 0;
      async function generate() {
        const mine = (seq += 1);
        status.textContent = t('share.working');
        const payload = buildSharePayload(board, { excludeNames: exclude.checked });
        const url = buildShareUrl(location.href, await encodeShare(payload, compress));
        if (mine !== seq) return;
        const info = shareLengthStatus(url);
        status.textContent = '';
        length.textContent = t('share.length', { n: info.length.toLocaleString(i18n.locale) });
        linkBox.hidden = info.tooLong;
        tooLongBox.hidden = !info.tooLong;
        link.value = info.tooLong ? '' : url;
        if (info.tooLong) {
          const exportButton = h('button', {
            className: 'button button--primary',
            text: t('share.exportInstead'),
            attrs: { type: 'button' },
          });
          exportButton.addEventListener('click', () => {
            done(null);
            onExport();
          });
          tooLongBox.replaceChildren(
            h('p', { text: t('share.tooLong', { n: info.length.toLocaleString(i18n.locale) }) }),
            exportButton,
          );
        }
        await renderQr(info.qr ? url : null, mine);
      }

      /** @param {string | null} url @param {number} mine */
      async function renderQr(url, mine) {
        if (!url) {
          qrBox.hidden = true;
          qrBox.replaceChildren();
          return;
        }
        try {
          const lib = await loadQrCodegen();
          if (mine !== seq) return;
          const qr = lib.QrCode.encodeText(url, lib.QrCode.Ecc.LOW);
          const size = qr.size + QUIET_ZONE * 2;
          qrBox.replaceChildren(
            svg('svg', {
              class: 'share__qr-code',
              viewBox: `0 0 ${size} ${size}`,
              role: 'img',
              'aria-label': t('share.qrLabel'),
              'shape-rendering': 'crispEdges',
            }, [svg('rect', { width: '100%', height: '100%', fill: '#ffffff' }), svg('path', { d: qrPath(qr), fill: '#000000' })]),
          );
          qrBox.hidden = false;
        } catch (error) {
          // QR은 부가 기능 — 실패해도 링크는 쓸 수 있음
          console.info('[share] QR unavailable', error);
          qrBox.hidden = true;
        }
      }

      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(link.value);
          status.textContent = t('share.copied');
        } catch {
          link.focus();
          link.select();
          status.textContent = t('share.copyFailed');
        }
      });
      nativeButton?.addEventListener('click', () => {
        navigator.share({ title: board.name, url: link.value }).catch(() => {});
      });
      link.addEventListener('focus', () => link.select());
      exclude.addEventListener('change', () => void generate());

      void generate();
    },
  });
}
