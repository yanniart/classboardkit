import { h } from '../../ui/dom.js';
import { IMAGE_TYPES, isAssetId } from '../../core/assets.js';
import { ImagePrepareError, getAssetStore, getAssetUrl, storeImageFile } from '../../ui/idb-assets.js';
import { button, createSettingsPanel, field, segmented, textInput } from '../shared/ui.js';

export const MAX_ALT_LENGTH = 120;

/**
 * @typedef {{ assetId: string | null, fit: 'contain' | 'cover', alt: string }} ImageState
 */

/** @returns {ImageState} */
export function createImageState() {
  return { assetId: null, fit: 'contain', alt: '' };
}

/** 오류 코드 → 문구 키 */
const ERROR_KEYS = {
  unsupported: 'widget.image.error.unsupported',
  type: 'widget.image.error.type',
  'too-large': 'widget.image.error.tooLarge',
  decode: 'widget.image.error.decode',
};

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'image',
  version: 1,
  icon: 'image',
  titleKey: 'widget.image.title',
  defaultSize: { w: 0.32, h: 0.4 },
  minSize: { w: 0.1, h: 0.14 },
  styleUrl: new URL('./image.css', import.meta.url).href,
  createState: createImageState,

  mount(container, ctx) {
    const { t } = ctx;
    /** @type {ImageState} */
    let state = ctx.state;
    let destroyed = false;
    /** 마지막으로 표시를 요청한 이미지 (비동기 응답 순서 보호) */
    let shownId = /** @type {string | null | undefined} */ (undefined);

    const fileInput = /** @type {HTMLInputElement} */ (
      h('input', { className: 'image__file', attrs: { type: 'file', accept: IMAGE_TYPES.join(','), tabindex: '-1', 'aria-hidden': 'true' } })
    );
    const img = /** @type {HTMLImageElement} */ (h('img', { className: 'image__img', attrs: { draggable: 'false' } }));
    const message = h('p', { className: 'image__message' });
    const error = h('p', { className: 'image__error', attrs: { role: 'status' } });
    const pickButton = button({ variant: 'primary', iconName: 'image', text: t('widget.image.choose'), onClick: () => fileInput.click() });
    const empty = h('div', { className: 'w-empty image__empty' }, [message, pickButton]);
    const root = h('div', { className: 'image' }, [img, empty, error, fileInput]);
    container.append(root);

    /** @param {string | null} key */
    function showError(key) {
      error.textContent = key ? t(key) : '';
      error.hidden = !key;
    }

    /** @param {File | Blob | null | undefined} file */
    async function useFile(file) {
      if (!file) return;
      showError(null);
      root.classList.add('is-busy');
      try {
        const id = await storeImageFile(file);
        if (!destroyed) ctx.setState((s) => ({ ...s, assetId: id }));
      } catch (e) {
        const code = e instanceof ImagePrepareError ? e.code : 'decode';
        console.info('[image] could not use file', e);
        if (!destroyed) showError(ERROR_KEYS[/** @type {keyof typeof ERROR_KEYS} */ (code)] ?? ERROR_KEYS.decode);
      } finally {
        root.classList.remove('is-busy');
      }
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      useFile(file);
    });

    // 끌어 놓기
    root.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      root.classList.add('is-dragover');
    });
    root.addEventListener('dragleave', () => root.classList.remove('is-dragover'));
    root.addEventListener('drop', (e) => {
      e.preventDefault();
      root.classList.remove('is-dragover');
      useFile(e.dataTransfer?.files?.[0]);
    });

    // 붙여넣기: 위젯(또는 안쪽 요소)에 포커스가 있을 때
    const frame = /** @type {HTMLElement | null} */ (container.closest('.widget'));
    /** @param {ClipboardEvent} e */
    const onPaste = (e) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      useFile(file);
    };
    frame?.addEventListener('paste', onPaste);

    /** @param {'empty' | 'missing' | 'unavailable' | 'image'} mode */
    function setMode(mode) {
      root.dataset.mode = mode;
      img.hidden = mode !== 'image';
      empty.hidden = mode === 'image';
      if (mode === 'image') return;
      message.textContent = t(`widget.image.${mode}`);
      pickButton.hidden = mode === 'unavailable';
    }

    async function paint() {
      img.style.objectFit = state.fit;
      img.alt = state.alt;
      const id = isAssetId(state.assetId) ? state.assetId : null;
      if (id === shownId) return;
      shownId = id;
      if (!id) {
        setMode((await getAssetStore()) ? 'empty' : 'unavailable');
        return;
      }
      const entry = await getAssetUrl(id);
      if (destroyed || shownId !== id) return;
      if (!entry) {
        setMode((await getAssetStore()) ? 'missing' : 'unavailable');
        return;
      }
      img.src = entry.url;
      setMode('image');
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.image.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        body.append(
          segmented({
            label: t('widget.image.fit'),
            options: [
              { value: 'contain', label: t('widget.image.contain') },
              { value: 'cover', label: t('widget.image.cover') },
            ],
            value: state.fit,
            onChange: (fit) => ctx.setState((s) => ({ ...s, fit })),
          }),
          field(
            t('widget.image.alt'),
            textInput({
              label: t('widget.image.alt'),
              value: state.alt,
              placeholder: t('widget.image.altPlaceholder'),
              maxLength: MAX_ALT_LENGTH,
              onInput: (v) => ctx.setState((s) => ({ ...s, alt: v.slice(0, MAX_ALT_LENGTH) })),
            }),
            t('widget.image.altHint'),
          ),
          button({ iconName: 'image', text: t('widget.image.replace'), onClick: () => fileInput.click() }),
        );
      },
    });

    showError(null);
    img.hidden = true;
    empty.hidden = true;
    paint();

    return {
      update(next) {
        state = next;
        paint();
      },
      openSettings: panel.open,
      destroy() {
        destroyed = true;
        frame?.removeEventListener('paste', onPaste);
        // object URL은 세션 캐시(getAssetUrl)가 관리 — 같은 이미지를 다른 위젯·배경이 쓸 수 있음
        root.remove();
      },
    };
  },
};
