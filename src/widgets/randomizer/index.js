import { h } from '../../ui/dom.js';
import { pickOne } from '../../core/utils/random.js';
import { button, createSettingsPanel, listEditor, prefersReducedMotion, toggle, liveRegion } from '../shared/ui.js';
import { parseItems } from '../shared/list.js';
import {
  clearHistory,
  createRandomizerState,
  getAvailable,
  pick,
  resetPicked,
  setExcludePicked,
  setItems,
} from './randomizer-logic.js';

/** 뽑기 연출 길이와 이름 바뀌는 간격 */
const SPIN_MS = 1000;
const SPIN_STEP_MS = 70;

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'randomizer',
  version: 1,
  icon: 'shuffle',
  titleKey: 'widget.randomizer.title',
  defaultSize: { w: 0.3, h: 0.4 },
  minSize: { w: 0.14, h: 0.2 },
  styleUrl: new URL('./randomizer.css', import.meta.url).href,
  createState: createRandomizerState,

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;
    /** @type {ReturnType<typeof setInterval> | null} */
    let spin = null;

    // 연출 중 바뀌는 이름은 읽히지 않게 하고, 최종 결과만 live로 알림 (M6)
    const result = h('div', { className: 'randomizer__result' });
    const meta = h('p', { className: 'randomizer__meta' });
    const recent = h('p', { className: 'randomizer__recent' });
    const pickButton = button({ variant: 'primary', iconName: 'shuffle', text: t('widget.randomizer.pick'), onClick: doPick });
    const resetButton = button({
      iconName: 'reset',
      text: t('widget.randomizer.resetPicked'),
      onClick: () => ctx.setState((s) => resetPicked(s)),
    });
    const view = h('div', { className: 'randomizer' }, [
      result,
      meta,
      h('div', { className: 'w-row' }, [pickButton, resetButton]),
      recent,
    ]);
    const empty = h('div', { className: 'w-empty' }, [
      h('p', { text: t('widget.randomizer.empty') }),
      button({ variant: 'primary', iconName: 'pencil', text: t('widget.list.edit'), onClick: () => panel.open() }),
    ]);
    container.append(view, empty);
    const live = liveRegion(container);

    function stopSpin() {
      if (spin !== null) clearInterval(spin);
      spin = null;
      view.classList.remove('is-spinning');
    }

    function doPick() {
      if (spin !== null) return;
      const { state: next, value } = pick(state);
      if (value === null) return;
      const pool = getAvailable(state);
      ctx.setState(next);
      const announce = () => live.say(t('widget.randomizer.announce', { name: value }));
      if (prefersReducedMotion() || pool.length < 2) {
        paint();
        announce();
        return;
      }
      // 연출: 후보 이름을 빠르게 바꿔 보여준 뒤 결과 표시
      view.classList.add('is-spinning');
      const startedAt = Date.now();
      spin = setInterval(() => {
        if (Date.now() - startedAt >= SPIN_MS) {
          stopSpin();
          paint();
          announce();
          return;
        }
        result.textContent = pickOne(pool) ?? '';
      }, SPIN_STEP_MS);
    }

    function paint() {
      const hasItems = state.items.length > 0;
      view.hidden = !hasItems;
      empty.hidden = hasItems;
      if (!hasItems) return;

      const available = getAvailable(state).length;
      if (spin === null) {
        result.textContent = state.history[0]?.value ?? '?';
        result.classList.toggle('is-placeholder', state.history.length === 0);
      }
      meta.textContent = state.excludePicked
        ? available === 0
          ? t('widget.randomizer.allPicked')
          : t('widget.randomizer.remaining', { n: available, total: state.items.length })
        : t('widget.randomizer.total', { n: state.items.length });
      pickButton.disabled = available === 0;
      resetButton.hidden = !state.excludePicked || state.picked.length === 0;
      const prev = state.history.slice(1, 4).map((x) => x.value);
      recent.textContent = prev.length ? t('widget.randomizer.recent', { names: prev.join(' · ') }) : '';
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.randomizer.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        body.append(
          listEditor({
            label: t('widget.list.label'),
            items: state.items,
            placeholder: t('widget.list.placeholder'),
            countText: (n) => t('widget.list.count', { n }),
            parse: parseItems,
            onChange: (items) => ctx.setState((s) => setItems(s, items)),
          }),
          toggle({
            label: t('widget.randomizer.excludePicked'),
            checked: state.excludePicked,
            onChange: (on) => ctx.setState((s) => setExcludePicked(s, on)),
          }),
          button({
            iconName: 'trash',
            variant: 'danger',
            text: t('widget.randomizer.clearHistory'),
            onClick: () => ctx.setState((s) => clearHistory(s)),
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
        stopSpin();
        view.remove();
        empty.remove();
      },
    };
  },
};
