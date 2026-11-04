import { h, icon } from '../../ui/dom.js';
import { button } from '../shared/ui.js';
import {
  MAX_LAPS,
  createStopwatchState,
  formatStopwatch,
  getElapsed,
  lap,
  lapDurations,
  pause,
  reset,
  start,
} from './stopwatch-logic.js';

/** 1/100초 표시를 위해 약 20fps로 갱신 */
const TICK_MS = 50;

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'stopwatch',
  version: 1,
  icon: 'stopwatch',
  titleKey: 'widget.stopwatch.title',
  defaultSize: { w: 0.28, h: 0.4 },
  minSize: { w: 0.14, h: 0.18 },
  styleUrl: new URL('./stopwatch.css', import.meta.url).href,
  createState: createStopwatchState,

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;
    /** @type {ReturnType<typeof setInterval> | null} */
    let interval = null;

    const main = h('span', { className: 'stopwatch__main' });
    const fraction = h('span', { className: 'stopwatch__fraction' });
    const display = h('div', { className: 'stopwatch__display', attrs: { role: 'timer', 'aria-live': 'off' } }, [
      main,
      fraction,
    ]);

    const primary = button({
      variant: 'primary',
      text: ' ',
      onClick: () => {
        const now = Date.now();
        ctx.setState((s) => (s.status === 'running' ? pause(s, now) : start(s, now)));
      },
    });
    const lapButton = button({
      iconName: 'flag',
      text: t('widget.stopwatch.lap'),
      onClick: () => ctx.setState((s) => lap(s, Date.now())),
    });
    const resetButton = button({
      iconName: 'reset',
      text: t('widget.stopwatch.reset'),
      onClick: () => ctx.setState((s) => reset(s)),
    });
    const laps = h('ol', { className: 'stopwatch__laps', attrs: { 'aria-label': t('widget.stopwatch.laps') } });

    const root = h('div', { className: 'stopwatch' }, [
      display,
      h('div', { className: 'w-row' }, [primary, lapButton, resetButton]),
      laps,
    ]);
    container.append(root);

    let last = '';
    function paintTime() {
      const { main: m, fraction: f } = formatStopwatch(getElapsed(state, Date.now()));
      if (m + f === last) return;
      last = m + f;
      main.textContent = m;
      fraction.textContent = f;
    }

    let renderedLaps = /** @type {number[] | null} */ (null);
    function paintLaps() {
      if (renderedLaps === state.laps) return;
      renderedLaps = state.laps;
      const durations = lapDurations(state.laps);
      // 최신 랩이 위로
      laps.replaceChildren(
        ...durations
          .map((d, i) => {
            const { main: m, fraction: f } = formatStopwatch(d);
            return h('li', { className: 'stopwatch__lap' }, [
              h('span', { text: t('widget.stopwatch.lapN', { n: i + 1 }) }),
              h('span', { className: 'stopwatch__lap-time', text: m + f }),
            ]);
          })
          .reverse(),
      );
      laps.hidden = state.laps.length === 0;
    }

    function paint() {
      root.dataset.status = state.status;
      const running = state.status === 'running';
      const key = running ? 'widget.stopwatch.pause' : state.status === 'paused' ? 'widget.stopwatch.resume' : 'widget.stopwatch.start';
      primary.replaceChildren(icon(running ? 'pause' : 'play'), h('span', { className: 'w-btn__text', text: t(key) }));
      lapButton.hidden = !running;
      lapButton.disabled = state.laps.length >= MAX_LAPS;
      resetButton.hidden = running;
      resetButton.disabled = state.status === 'idle';
      paintTime();
      paintLaps();
    }

    function sync() {
      if (state.status === 'running' && interval === null) interval = setInterval(paintTime, TICK_MS);
      if (state.status !== 'running' && interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    }

    paint();
    sync();

    return {
      update(next) {
        state = next;
        paint();
        sync();
      },
      destroy() {
        if (interval !== null) clearInterval(interval);
        root.remove();
      },
    };
  },
};
