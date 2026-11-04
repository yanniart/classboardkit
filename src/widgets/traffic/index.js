import { h } from '../../ui/dom.js';
import { createSettingsPanel, field, textInput } from '../shared/ui.js';

export const LIGHTS = /** @type {const} */ (['red', 'yellow', 'green']);
export const MAX_LABEL_LENGTH = 40;

/**
 * labels가 빈 문자열이면 언어별 기본 문구를 표시한다.
 * @typedef {{ light: 'red' | 'yellow' | 'green', labels: { red: string, yellow: string, green: string } }} TrafficState
 */

/** @returns {TrafficState} */
export function createTrafficState() {
  return { light: 'red', labels: { red: '', yellow: '', green: '' } };
}

/** @param {TrafficState} s @param {string} light @returns {TrafficState} */
export function setLight(s, light) {
  if (!LIGHTS.includes(/** @type {any} */ (light)) || s.light === light) return s;
  return { ...s, light: /** @type {any} */ (light) };
}

/** @param {TrafficState} s @param {'red' | 'yellow' | 'green'} light @param {string} label @returns {TrafficState} */
export function setLabel(s, light, label) {
  const clean = label.slice(0, MAX_LABEL_LENGTH);
  if (s.labels[light] === clean) return s;
  return { ...s, labels: { ...s.labels, [light]: clean } };
}

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'traffic',
  version: 1,
  icon: 'traffic',
  titleKey: 'widget.traffic.title',
  defaultSize: { w: 0.18, h: 0.5 },
  minSize: { w: 0.1, h: 0.18 },
  styleUrl: new URL('./traffic.css', import.meta.url).href,
  createState: createTrafficState,

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;

    /** @param {'red' | 'yellow' | 'green'} light */
    const labelOf = (light) => state.labels[light].trim() || t(`widget.traffic.default.${light}`);

    const lamps = LIGHTS.map((light) => {
      const lamp = h('button', {
        className: 'traffic__lamp',
        dataset: { light },
        attrs: { type: 'button' },
      });
      lamp.addEventListener('click', () => ctx.setState((s) => setLight(s, light)));
      return lamp;
    });
    const housing = h('div', { className: 'traffic__housing', attrs: { role: 'group', 'aria-label': t('widget.traffic.title') } }, lamps);
    const label = h('p', { className: 'traffic__label', attrs: { 'aria-live': 'polite' } });
    const root = h('div', { className: 'traffic' }, [housing, label]);
    container.append(root);

    function paint() {
      root.dataset.light = state.light;
      lamps.forEach((lamp, i) => {
        const light = LIGHTS[i];
        const on = state.light === light;
        lamp.setAttribute('aria-pressed', String(on));
        lamp.setAttribute('aria-label', `${t(`color.${light}`)}: ${labelOf(light)}`);
        lamp.classList.toggle('is-on', on);
      });
      label.textContent = labelOf(state.light);
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.traffic.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        body.append(
          ...LIGHTS.map((light) =>
            field(
              t(`color.${light}`),
              textInput({
                label: t(`color.${light}`),
                value: state.labels[light],
                placeholder: t(`widget.traffic.default.${light}`),
                maxLength: MAX_LABEL_LENGTH,
                onInput: (v) => ctx.setState((s) => setLabel(s, light, v)),
              }),
            ),
          ),
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
