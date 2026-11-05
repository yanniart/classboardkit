import { h } from '../../ui/dom.js';
import { button, createSettingsPanel, field, svg, textInput } from '../shared/ui.js';
import { MAX_CAPTION_LENGTH, MAX_TEXT_LENGTH, QUIET_ZONE, createQrState, displayCaption, encode, qrPath } from './qr-logic.js';
import { loadQrCodegen } from './qr-loader.js';

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'qr',
  version: 1,
  icon: 'qr',
  titleKey: 'widget.qr.title',
  defaultSize: { w: 0.24, h: 0.46 },
  minSize: { w: 0.12, h: 0.2 },
  styleUrl: new URL('./qr.css', import.meta.url).href,
  createState: createQrState,

  mount(container, ctx) {
    const { t } = ctx;
    /** @type {import('./qr-logic.js').QrState} */
    let state = ctx.state;
    let destroyed = false;
    /** 비동기 로드 중 상태가 바뀌면 마지막 것만 그린다 */
    let paintSeq = 0;

    const path = svg('path', { fill: '#000000' });
    const code = svg('svg', { class: 'qr__code', role: 'img', 'shape-rendering': 'crispEdges' }, [
      svg('rect', { width: '100%', height: '100%', fill: '#ffffff' }),
      path,
    ]);
    const caption = h('p', { className: 'qr__caption' });
    // 정사각형 유지: 상자(컨테이너) 안에서 짧은 변에 맞춤
    const box = h('div', { className: 'qr__box' }, [code]);
    const view = h('div', { className: 'qr__view' }, [box, caption]);
    const message = h('p', { className: 'qr__message' });
    const editButton = button({ variant: 'primary', iconName: 'pencil', text: t('widget.qr.edit'), onClick: () => panel.open() });
    const empty = h('div', { className: 'w-empty qr__empty' }, [message, editButton]);
    const root = h('div', { className: 'qr' }, [view, empty]);
    container.append(root);

    /** @param {string} key @param {boolean} [isError] */
    function showMessage(key, isError = false) {
      view.hidden = true;
      empty.hidden = false;
      message.textContent = t(key);
      message.classList.toggle('is-error', isError);
    }

    async function paint() {
      const seq = ++paintSeq;
      if (!state.text.trim()) {
        showMessage('widget.qr.empty');
        return;
      }
      let lib;
      try {
        lib = await loadQrCodegen();
      } catch (error) {
        console.info('[qr] library unavailable', error);
        if (!destroyed && seq === paintSeq) showMessage('widget.qr.error.load', true);
        return;
      }
      if (destroyed || seq !== paintSeq) return;
      const result = encode(lib, state.text, state.ecc);
      if (!result.ok) {
        showMessage(result.error === 'too-long' ? 'widget.qr.error.tooLong' : 'widget.qr.empty', result.error === 'too-long');
        return;
      }
      const total = result.qr.size + QUIET_ZONE * 2;
      code.setAttribute('viewBox', `0 0 ${total} ${total}`);
      path.setAttribute('d', qrPath(result.qr));
      code.setAttribute('aria-label', t('widget.qr.label', { text: state.text.trim() }));
      code.dataset.size = String(result.qr.size);
      caption.textContent = displayCaption(state);
      caption.hidden = !caption.textContent;
      view.hidden = false;
      empty.hidden = true;
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.qr.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        const textarea = /** @type {HTMLTextAreaElement} */ (
          h('textarea', {
            className: 'w-textarea',
            attrs: {
              'aria-label': t('widget.qr.text'),
              placeholder: 'https://',
              rows: '4',
              maxlength: String(MAX_TEXT_LENGTH),
              spellcheck: 'false',
            },
          })
        );
        textarea.value = state.text;
        const count = h('span', { className: 'w-field__hint' });
        const syncCount = () => {
          count.textContent = t('widget.qr.count', { n: textarea.value.length, max: MAX_TEXT_LENGTH });
        };
        syncCount();
        textarea.addEventListener('input', () => {
          syncCount();
          const text = textarea.value.slice(0, MAX_TEXT_LENGTH);
          ctx.setState((s) => (s.text === text ? s : { ...s, text }));
        });
        body.append(
          h('div', { className: 'w-field' }, [h('span', { className: 'w-field__label', text: t('widget.qr.text') }), textarea, count]),
          field(
            t('widget.qr.caption'),
            textInput({
              label: t('widget.qr.caption'),
              value: state.caption,
              placeholder: t('widget.qr.captionPlaceholder'),
              maxLength: MAX_CAPTION_LENGTH,
              onInput: (v) => ctx.setState((s) => ({ ...s, caption: v.slice(0, MAX_CAPTION_LENGTH) })),
            }),
          ),
        );
      },
    });

    view.hidden = true;
    empty.hidden = true;
    paint();

    return {
      update(next) {
        const changed = next.text !== state.text || next.caption !== state.caption || next.ecc !== state.ecc;
        state = next;
        if (changed) paint();
      },
      openSettings: panel.open,
      destroy() {
        destroyed = true;
        root.remove();
      },
    };
  },
};
