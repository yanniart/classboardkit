import { h } from '../../ui/dom.js';
import { createSettingsPanel, field, textInput, toggle } from '../shared/ui.js';
import {
  MAX_TITLE_LENGTH,
  createCountdownState,
  ddayLabel,
  formatClock,
  nextTickDelay,
  remaining,
  setTitle,
  withParts,
} from './countdown-logic.js';

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'countdown',
  version: 1,
  icon: 'hourglass',
  titleKey: 'widget.countdown.title',
  defaultSize: { w: 0.3, h: 0.34 },
  minSize: { w: 0.16, h: 0.18 },
  styleUrl: new URL('./countdown.css', import.meta.url).href,
  createState: () => createCountdownState(),

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timer = null;

    const badge = h('span', { className: 'countdown__badge' });
    const title = h('p', { className: 'countdown__title' });
    const days = h('p', { className: 'countdown__days' });
    const clock = h('p', { className: 'countdown__clock' });
    const status = h('p', { className: 'countdown__status' });
    const root = h('div', { className: 'countdown' }, [
      h('div', { className: 'countdown__head' }, [badge, title]),
      days,
      clock,
      status,
    ]);
    container.append(root);

    function schedule(/** @type {ReturnType<typeof remaining>} */ r, /** @type {Date} */ now) {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(paint, nextTickDelay(r, state.showSeconds, now));
    }

    function paint() {
      const now = new Date();
      const r = remaining(state.target, now);
      title.textContent = state.title.trim() || t('widget.countdown.untitled');
      badge.textContent = ddayLabel(state.target, now);
      root.classList.toggle('is-past', Boolean(r?.past));
      if (!r) {
        days.hidden = true;
        clock.hidden = false;
        clock.textContent = '--:--';
        status.hidden = true;
        schedule(r, now);
        return;
      }
      if (r.past) {
        days.hidden = true;
        clock.hidden = true;
        status.hidden = false;
        status.textContent = t('widget.countdown.past');
      } else {
        days.hidden = r.days < 1;
        days.textContent = t('widget.countdown.days', { n: r.days });
        clock.hidden = false;
        clock.textContent = formatClock(r, state.showSeconds || r.days < 1);
        status.hidden = true;
      }
      schedule(r, now);
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.countdown.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        const [date, time] = state.target.split('T');
        const dateInput = /** @type {HTMLInputElement} */ (
          h('input', { className: 'w-input', attrs: { type: 'date', 'aria-label': t('widget.countdown.date') } })
        );
        dateInput.value = date ?? '';
        const timeInput = /** @type {HTMLInputElement} */ (
          h('input', { className: 'w-input', attrs: { type: 'time', 'aria-label': t('widget.countdown.time') } })
        );
        timeInput.value = time ?? '';
        const onChange = () =>
          ctx.setState((s) => {
            const target = withParts(s.target, { date: dateInput.value, time: timeInput.value });
            return target === s.target ? s : { ...s, target };
          });
        dateInput.addEventListener('change', onChange);
        timeInput.addEventListener('change', onChange);
        body.append(
          field(
            t('widget.countdown.name'),
            textInput({
              label: t('widget.countdown.name'),
              value: state.title,
              placeholder: t('widget.countdown.placeholder'),
              maxLength: MAX_TITLE_LENGTH,
              onInput: (v) => ctx.setState((s) => setTitle(s, v)),
            }),
          ),
          field(t('widget.countdown.date'), dateInput),
          field(t('widget.countdown.time'), timeInput),
          toggle({
            label: t('widget.countdown.showSeconds'),
            checked: state.showSeconds,
            onChange: (on) => ctx.setState((s) => ({ ...s, showSeconds: on })),
          }),
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
        if (timer !== null) clearTimeout(timer);
        root.remove();
      },
    };
  },
};
