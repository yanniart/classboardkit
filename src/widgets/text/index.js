import { h, iconButton } from '../../ui/dom.js';
import { createSettingsPanel, field, segmented } from '../shared/ui.js';

export const TEXT_SIZES = /** @type {const} */ (['s', 'm', 'l', 'xl']);
export const TEXT_ALIGNS = /** @type {const} */ (['left', 'center', 'right']);
/** 'default'는 테마 글자색 */
export const TEXT_COLORS = /** @type {const} */ (['default', 'red', 'blue', 'green', 'orange', 'purple']);
export const MAX_LENGTH = 2000;

/**
 * @param {string} size
 * @param {1 | -1} direction
 */
export function stepSize(size, direction) {
  const i = TEXT_SIZES.indexOf(/** @type {any} */ (size));
  const next = Math.min(Math.max((i === -1 ? 1 : i) + direction, 0), TEXT_SIZES.length - 1);
  return TEXT_SIZES[next];
}

/** @param {string} align */
export function nextAlign(align) {
  const i = TEXT_ALIGNS.indexOf(/** @type {any} */ (align));
  return TEXT_ALIGNS[(i + 1) % TEXT_ALIGNS.length];
}

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'text',
  version: 1,
  icon: 'text',
  titleKey: 'widget.text.title',
  defaultSize: { w: 0.32, h: 0.24 },
  minSize: { w: 0.12, h: 0.1 },
  styleUrl: new URL('./text.css', import.meta.url).href,
  // color는 M2에서 추가된 선택 필드 — 없으면 'default'로 취급 (마이그레이션 불필요)
  createState: () => ({ content: '', size: 'm', align: 'center', color: 'default' }),

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;

    const input = /** @type {HTMLTextAreaElement} */ (
      h('textarea', {
        className: 'text-widget__input',
        attrs: {
          'aria-label': t('widget.text.title'),
          placeholder: t('widget.text.placeholder'),
          maxlength: String(MAX_LENGTH),
          spellcheck: 'false',
        },
      })
    );
    input.value = state.content;
    input.addEventListener('input', () => {
      const content = input.value;
      ctx.setState((s) => (s.content === content ? s : { ...s, content }));
    });

    const smaller = iconButton({ iconName: 'minus', label: t('widget.text.smaller'), className: 'text-widget__tool' });
    const larger = iconButton({ iconName: 'plus', label: t('widget.text.larger'), className: 'text-widget__tool' });
    const align = iconButton({ iconName: 'align', label: t('widget.text.align'), className: 'text-widget__tool' });
    smaller.addEventListener('click', () => ctx.setState((s) => ({ ...s, size: stepSize(s.size, -1) })));
    larger.addEventListener('click', () => ctx.setState((s) => ({ ...s, size: stepSize(s.size, 1) })));
    align.addEventListener('click', () => ctx.setState((s) => ({ ...s, align: nextAlign(s.align) })));

    const root = h('div', { className: 'text-widget' }, [
      input,
      h('div', { className: 'text-widget__tools' }, [smaller, larger, align]),
    ]);
    container.append(root);

    function paint() {
      root.dataset.size = state.size;
      root.dataset.align = state.align;
      root.dataset.color = state.color ?? 'default';
      smaller.disabled = state.size === TEXT_SIZES[0];
      larger.disabled = state.size === TEXT_SIZES[TEXT_SIZES.length - 1];
      // 입력 중에는 커서가 튀지 않도록 덮어쓰지 않는다
      if (input.value !== state.content && document.activeElement !== input) {
        input.value = state.content;
      }
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.text.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        const colors = h(
          'div',
          { className: 'w-colors', attrs: { role: 'group', 'aria-label': t('widget.text.color') } },
          TEXT_COLORS.map((color) => {
            const sw = h('button', {
              className: 'w-color',
              attrs: {
                type: 'button',
                'aria-label': t(`color.${color}`),
                title: t(`color.${color}`),
                'aria-pressed': String((state.color ?? 'default') === color),
              },
            });
            sw.style.setProperty('--swatch', color === 'default' ? 'var(--color-text)' : `var(--team-${color})`);
            sw.addEventListener('click', () => {
              for (const other of colors.children) other.setAttribute('aria-pressed', String(other === sw));
              ctx.setState((s) => ({ ...s, color }));
            });
            return sw;
          }),
        );
        body.append(
          segmented({
            label: t('widget.text.size'),
            options: TEXT_SIZES.map((v) => ({ value: v, label: v.toUpperCase() })),
            value: state.size,
            onChange: (size) => ctx.setState((s) => ({ ...s, size })),
          }),
          segmented({
            label: t('widget.text.align'),
            options: TEXT_ALIGNS.map((v) => ({ value: v, label: t(`widget.text.align_${v}`) })),
            value: state.align,
            onChange: (a) => ctx.setState((s) => ({ ...s, align: a })),
          }),
          field(t('widget.text.color'), colors),
        );
      },
    });

    paint();

    return {
      update(next) {
        state = next;
        paint();
      },
      openSettings: panel.open,
      destroy() {
        root.remove();
      },
    };
  },
};
