import { h } from '../../ui/dom.js';
import { button, createSettingsPanel, prefersReducedMotion, stepper, liveRegion } from '../shared/ui.js';
import { MAX_DICE, MIN_DICE, createDiceState, pipCells, roll, rollValues, setCount, total } from './dice-logic.js';

/** 굴리는 연출 길이와 면이 바뀌는 간격 */
const ROLL_MS = 600;
const ROLL_STEP_MS = 80;

/** @param {number} value 0이면 빈 면 */
function face(value) {
  const cells = pipCells(value);
  return h(
    'span',
    { className: 'dice__face', dataset: { value: String(value) } },
    Array.from({ length: 9 }, (_, i) => h('span', { className: cells.includes(i) ? 'dice__pip' : 'dice__cell' })),
  );
}

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'dice',
  version: 1,
  icon: 'dice',
  titleKey: 'widget.dice.title',
  defaultSize: { w: 0.3, h: 0.36 },
  minSize: { w: 0.14, h: 0.2 },
  styleUrl: new URL('./dice.css', import.meta.url).href,
  createState: createDiceState,

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;
    /** @type {ReturnType<typeof setInterval> | null} */
    let rolling = null;

    // 주사위 영역 자체를 눌러도 굴린다
    const tray = h('button', { className: 'dice__tray', attrs: { type: 'button' } });
    const sum = h('p', { className: 'dice__sum' });
    const rollButton = button({ variant: 'primary', iconName: 'dice', text: t('widget.dice.roll'), onClick: doRoll });
    const root = h('div', { className: 'dice' }, [tray, sum, h('div', { className: 'w-row' }, [rollButton])]);
    tray.addEventListener('click', doRoll);
    container.append(root);
    const live = liveRegion(container);

    /** @param {number[]} values */
    function showFaces(values) {
      tray.replaceChildren(...values.map(face));
    }

    function stopRolling() {
      if (rolling !== null) clearInterval(rolling);
      rolling = null;
      root.classList.remove('is-rolling');
    }

    function doRoll() {
      if (rolling !== null) return;
      const reduced = prefersReducedMotion();
      if (!reduced) {
        // 연출: 잠깐 무작위 면을 보여 준 뒤 실제 결과 표시 (결과는 바로 저장)
        root.classList.add('is-rolling');
        const startedAt = Date.now();
        rolling = setInterval(() => {
          if (Date.now() - startedAt >= ROLL_MS) {
            stopRolling();
            paint();
            announce();
            return;
          }
          showFaces(rollValues(state.count));
        }, ROLL_STEP_MS);
      }
      ctx.setState((s) => roll(s));
      if (reduced) announce();
    }

    /** 굴린 결과를 낭독기에 한 번 (연출이 끝난 뒤) */
    function announce() {
      live.say(
        state.count > 1
          ? t('widget.dice.announce', { values: state.values.join(', '), n: total(state.values) })
          : t('widget.dice.announceOne', { n: state.values[0] ?? 0 }),
      );
    }

    function paint() {
      const rolled = state.values.length === state.count;
      root.dataset.count = String(state.count);
      if (rolling === null) {
        showFaces(rolled ? state.values : Array.from({ length: state.count }, () => 0));
        tray.classList.toggle('is-placeholder', !rolled);
        sum.hidden = !rolled || state.count < 2;
        sum.textContent = t('widget.dice.total', { n: total(state.values) });
      }
      tray.setAttribute(
        'aria-label',
        rolled ? `${t('widget.dice.roll')} (${state.values.join(', ')})` : t('widget.dice.roll'),
      );
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.dice.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        body.append(
          stepper({
            label: t('widget.dice.count'),
            value: state.count,
            min: MIN_DICE,
            max: MAX_DICE,
            decLabel: t('common.decrease'),
            incLabel: t('common.increase'),
            onChange: (n) => ctx.setState((s) => setCount(s, n)),
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
        stopRolling();
        root.remove();
      },
    };
  },
};
