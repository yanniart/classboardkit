import { h, icon } from '../../ui/dom.js';
import { playChime } from '../../core/utils/sound.js';
import { button, createSettingsPanel, field, segmented, svg, toggle } from '../shared/ui.js';
import {
  PRESET_MINUTES,
  URGENT_MS,
  adjustDuration,
  createTimerState,
  finish,
  formatMs,
  getProgress,
  getRemainingMs,
  isExpired,
  pause,
  reset,
  setDuration,
  start,
} from './timer-logic.js';

/** 진행 중 화면 갱신 주기. 백그라운드 탭에서는 브라우저가 늦추지만 endAt 기준이라 정확도는 유지된다 */
const TICK_MS = 200;

const ADJUSTMENTS = [
  { delta: -60_000, key: 'widget.timer.minusMinute', text: '−1:00' },
  { delta: -10_000, key: 'widget.timer.minusTenSeconds', text: '−0:10' },
  { delta: 10_000, key: 'widget.timer.plusTenSeconds', text: '+0:10' },
  { delta: 60_000, key: 'widget.timer.plusMinute', text: '+1:00' },
];

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'timer',
  version: 1,
  icon: 'timer',
  titleKey: 'widget.timer.title',
  defaultSize: { w: 0.3, h: 0.4 },
  minSize: { w: 0.14, h: 0.18 },
  styleUrl: new URL('./timer.css', import.meta.url).href,
  createState: createTimerState,

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;
    /** @type {ReturnType<typeof setInterval> | null} */
    let interval = null;

    const display = h('div', { className: 'timer__display', attrs: { role: 'timer', 'aria-live': 'off' } });
    const ringValue = svg('circle', {
      class: 'timer__ring-value', cx: 50, cy: 50, r: 45, pathLength: 100, 'stroke-dasharray': 100,
    });
    const ring = svg('svg', { class: 'timer__ring', viewBox: '0 0 100 100', 'aria-hidden': 'true' }, [
      svg('circle', { class: 'timer__ring-track', cx: 50, cy: 50, r: 45 }),
      ringValue,
    ]);
    const face = h('div', { className: 'timer__face' }, [ring, display]);
    const status = h('p', { className: 'timer__status', attrs: { 'aria-live': 'assertive' } });

    const adjustRow = h(
      'div',
      { className: 'w-row timer__adjust' },
      ADJUSTMENTS.map(({ delta, key, text }) =>
        button({ text, label: t(key), onClick: () => ctx.setState((s) => adjustDuration(s, delta)) }),
      ),
    );

    const primary = button({
      variant: 'primary',
      text: ' ',
      onClick: () => {
        const now = Date.now();
        ctx.setState((s) => (s.status === 'running' ? pause(s, now) : start(s, now)));
      },
    });
    const resetButton = button({
      iconName: 'reset',
      text: t('widget.timer.reset'),
      onClick: () => ctx.setState((s) => reset(s)),
    });

    const root = h('div', { className: 'timer' }, [
      face,
      status,
      adjustRow,
      h('div', { className: 'w-row' }, [primary, resetButton]),
    ]);
    container.append(root);

    let lastText = '';
    function paintTime() {
      const now = Date.now();
      const remaining = getRemainingMs(state, now);
      const text = formatMs(remaining);
      if (text !== lastText) {
        display.textContent = text;
        lastText = text;
      }
      ringValue.setAttribute('stroke-dashoffset', String(100 * (1 - getProgress(state, now))));
      root.dataset.urgent = String(state.status === 'running' && remaining <= URGENT_MS);
    }

    function paint() {
      root.dataset.status = state.status;
      root.dataset.mode = state.mode;
      paintTime();
      adjustRow.hidden = state.status !== 'idle';
      status.textContent = state.status === 'done' ? t('widget.timer.done') : '';

      const running = state.status === 'running';
      const labelKey = running
        ? 'widget.timer.pause'
        : state.status === 'paused'
          ? 'widget.timer.resume'
          : 'widget.timer.start';
      primary.replaceChildren(icon(running ? 'pause' : 'play'), h('span', { className: 'w-btn__text', text: t(labelKey) }));
      primary.disabled = state.status === 'idle' && state.durationMs <= 0;
      resetButton.disabled = state.status === 'idle';
    }

    function tick() {
      if (isExpired(state, Date.now())) {
        stopTicking();
        if (state.sound) playChime();
        ctx.setState((s) => finish(s));
        return;
      }
      paintTime();
    }

    function stopTicking() {
      if (interval !== null) clearInterval(interval);
      interval = null;
    }

    function syncTicking() {
      if (state.status === 'running') {
        if (interval === null) interval = setInterval(tick, TICK_MS);
        tick();
      } else {
        stopTicking();
      }
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.timer.title') }),
      doneLabel: t('dialog.done'),
      build(body, close) {
        const minutes = /** @type {HTMLInputElement} */ (
          h('input', { className: 'w-input timer__num', attrs: { type: 'number', min: '0', max: '99', inputmode: 'numeric', 'aria-label': t('widget.timer.minutes') } })
        );
        const seconds = /** @type {HTMLInputElement} */ (
          h('input', { className: 'w-input timer__num', attrs: { type: 'number', min: '0', max: '59', inputmode: 'numeric', 'aria-label': t('widget.timer.seconds') } })
        );
        const total = Math.round(state.durationMs / 1000);
        minutes.value = String(Math.floor(total / 60));
        seconds.value = String(total % 60);
        const applyInputs = () => {
          const m = Math.min(Math.max(Number(minutes.value) || 0, 0), 99);
          const s = Math.min(Math.max(Number(seconds.value) || 0, 0), 59);
          ctx.setState((prev) => setDuration(prev, (m * 60 + s) * 1000));
        };
        minutes.addEventListener('change', applyInputs);
        seconds.addEventListener('change', applyInputs);

        body.append(
          field(
            t('widget.timer.duration'),
            h('div', { className: 'timer__inputs' }, [
              minutes, h('span', { text: t('widget.timer.minutesUnit') }),
              seconds, h('span', { text: t('widget.timer.secondsUnit') }),
            ]),
          ),
          field(
            t('widget.timer.presets'),
            h(
              'div',
              { className: 'w-seg' },
              PRESET_MINUTES.map((m) =>
                button({
                  text: t('widget.timer.presetMinutes', { n: m }),
                  onClick: () => {
                    ctx.setState((s) => setDuration(s, m * 60_000));
                    close();
                  },
                }),
              ),
            ),
          ),
          segmented({
            label: t('widget.timer.display'),
            options: [
              { value: 'digital', label: t('widget.timer.modeDigital') },
              { value: 'visual', label: t('widget.timer.modeVisual') },
            ],
            value: state.mode,
            onChange: (mode) => ctx.setState((s) => ({ ...s, mode })),
          }),
          toggle({
            label: t('widget.timer.sound'),
            checked: state.sound,
            onChange: (sound) => ctx.setState((s) => ({ ...s, sound })),
          }),
        );
      },
    });

    paint();
    syncTicking();

    return {
      update(next) {
        state = next;
        paint();
        syncTicking();
      },
      openSettings: panel.open,
      destroy() {
        stopTicking();
        root.remove();
      },
    };
  },
};
