import { h } from '../../ui/dom.js';
import { createSettingsPanel, segmented, svg, toggle } from '../shared/ui.js';
import { createClockState, formatClock, formatDate, handAngles, msUntilNextSecond } from './clock-logic.js';

/** 아날로그 시계 판 (12개 눈금 + 바늘 3개) */
function createFace() {
  const ticks = Array.from({ length: 12 }, (_, i) =>
    svg('line', {
      class: i % 3 === 0 ? 'clock__tick clock__tick--major' : 'clock__tick',
      x1: 50, y1: 6, x2: 50, y2: i % 3 === 0 ? 14 : 11,
      transform: `rotate(${i * 30} 50 50)`,
    }),
  );
  const hour = svg('line', { class: 'clock__hand clock__hand--hour', x1: 50, y1: 50, x2: 50, y2: 27 });
  const minute = svg('line', { class: 'clock__hand clock__hand--minute', x1: 50, y1: 50, x2: 50, y2: 15 });
  const second = svg('line', { class: 'clock__hand clock__hand--second', x1: 50, y1: 58, x2: 50, y2: 12 });
  const face = svg('svg', { class: 'clock__face', viewBox: '0 0 100 100', 'aria-hidden': 'true' }, [
    svg('circle', { class: 'clock__rim', cx: 50, cy: 50, r: 47 }),
    ...ticks,
    hour,
    minute,
    second,
    svg('circle', { class: 'clock__pin', cx: 50, cy: 50, r: 2.5 }),
  ]);
  return { face, hour, minute, second };
}

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'clock',
  version: 1,
  icon: 'clock',
  titleKey: 'widget.clock.title',
  defaultSize: { w: 0.26, h: 0.32 },
  minSize: { w: 0.12, h: 0.14 },
  styleUrl: new URL('./clock.css', import.meta.url).href,
  createState: createClockState,

  mount(container, ctx) {
    const { t } = ctx;
    const { locale } = ctx;
    let state = ctx.state;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timer = null;

    const time = h('span', { className: 'clock__time' });
    const period = h('span', { className: 'clock__period' });
    const digital = h('div', { className: 'clock__digital' }, [period, time]);
    const analog = createFace();
    const date = h('div', { className: 'clock__date' });
    // 화면 낭독기에는 매초 읽히지 않도록 시각 텍스트를 별도 제공
    const root = h('div', { className: 'clock', attrs: { role: 'img' } }, [digital, analog.face, date]);
    container.append(root);

    function paint() {
      const now = new Date();
      root.dataset.style = state.style;
      const { time: tt, period: pp } = formatClock(now, { locale, hour12: state.hour12, showSeconds: state.showSeconds });
      time.textContent = tt;
      period.textContent = pp;
      period.hidden = !pp;

      const a = handAngles(now);
      analog.hour.setAttribute('transform', `rotate(${a.hour} 50 50)`);
      analog.minute.setAttribute('transform', `rotate(${a.minute} 50 50)`);
      analog.second.setAttribute('transform', `rotate(${a.second} 50 50)`);
      analog.second.style.display = state.showSeconds ? '' : 'none';

      date.textContent = formatDate(now, locale);
      date.hidden = !state.showDate;
      root.setAttribute('aria-label', `${pp} ${tt}`.trim());
    }

    // 정각 초에 맞춰 갱신
    function schedule() {
      timer = setTimeout(() => {
        paint();
        schedule();
      }, msUntilNextSecond(Date.now()));
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.clock.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        body.append(
          segmented({
            label: t('widget.clock.style'),
            options: [
              { value: 'digital', label: t('widget.clock.digital') },
              { value: 'analog', label: t('widget.clock.analog') },
            ],
            value: state.style,
            onChange: (style) => ctx.setState((s) => ({ ...s, style })),
          }),
          toggle({ label: t('widget.clock.hour12'), checked: state.hour12, onChange: (hour12) => ctx.setState((s) => ({ ...s, hour12 })) }),
          toggle({ label: t('widget.clock.showSeconds'), checked: state.showSeconds, onChange: (showSeconds) => ctx.setState((s) => ({ ...s, showSeconds })) }),
          toggle({ label: t('widget.clock.showDate'), checked: state.showDate, onChange: (showDate) => ctx.setState((s) => ({ ...s, showDate })) }),
        );
      },
    });

    paint();
    schedule();

    return {
      update(next) {
        state = next;
        paint();
      },
      openSettings: panel.open,
      destroy() {
        if (timer !== null) clearTimeout(timer);
        root.remove();
      },
    };
  },
};
