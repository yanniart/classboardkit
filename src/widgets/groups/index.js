import { h } from '../../ui/dom.js';
import { button, createSettingsPanel, listEditor, segmented, stepper, liveRegion } from '../shared/ui.js';
import { parseItems } from '../shared/list.js';
import { MAX_N, MIN_N, createGroupsState, groupCount, regroup, setItems, setRule } from './groups-logic.js';

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'groups',
  version: 1,
  icon: 'groups',
  titleKey: 'widget.groups.title',
  defaultSize: { w: 0.44, h: 0.48 },
  minSize: { w: 0.18, h: 0.2 },
  styleUrl: new URL('./groups.css', import.meta.url).href,
  createState: createGroupsState,

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;
    // 이름 수·모둠 수는 각각 복수형 문구 → ready/summary에 끼워 넣음 (M7 D2)
    const namesText = (n) => t('widget.list.count', { n });
    const groupsText = (n) => t('widget.groups.count', { n });

    // 모둠이 많으면 스크롤 → 키보드로도 스크롤할 수 있게 포커스 가능 (WCAG 2.1.1)
    const grid = h('div', {
      className: 'groups__grid',
      attrs: { tabindex: '0', role: 'group', 'aria-label': t('widget.groups.title') },
    });
    const regroupButton = button({
      variant: 'primary',
      iconName: 'shuffle',
      text: t('widget.groups.regroup'),
      onClick: () => {
        announceNext = true;
        ctx.setState((s) => regroup(s));
      },
    });
    const summary = h('p', { className: 'groups__summary' });
    const view = h('div', { className: 'groups' }, [
      h('div', { className: 'groups__toolbar' }, [summary, regroupButton]),
      grid,
    ]);

    const emptyText = h('p');
    const emptyAction = button({ variant: 'primary', text: ' ', onClick: () => {} });
    const empty = h('div', { className: 'w-empty' }, [emptyText, emptyAction]);
    container.append(view, empty);
    const live = liveRegion(container);
    /** 모둠을 만들거나 다시 섞은 직후에만 결과 요약을 알림 */
    let announceNext = false;

    function paint() {
      const hasItems = state.items.length > 0;
      const hasResult = state.result.length > 0;
      view.hidden = !hasResult;
      empty.hidden = hasResult;

      if (!hasResult) {
        emptyText.textContent = hasItems
          ? t('widget.groups.ready', { names: namesText(state.items.length), groups: groupsText(groupCount(state.items.length, state.by, state.n)) })
          : t('widget.groups.empty');
        emptyAction.replaceChildren(h('span', { className: 'w-btn__text', text: t(hasItems ? 'widget.groups.make' : 'widget.list.edit') }));
        emptyAction.onclick = hasItems
          ? () => {
              announceNext = true;
              ctx.setState((s) => regroup(s));
            }
          : () => panel.open();
        return;
      }

      summary.textContent = t('widget.groups.summary', { names: namesText(state.items.length), groups: groupsText(state.result.length) });
      if (announceNext) live.say(summary.textContent);
      announceNext = false;
      grid.style.setProperty('--group-count', String(state.result.length));
      grid.replaceChildren(
        ...state.result.map((members, i) =>
          h('section', { className: 'groups__card', dataset: { index: String(i % 8) } }, [
            h('h2', { className: 'groups__name', text: t('widget.groups.groupName', { n: i + 1 }) }),
            h('ul', { className: 'groups__members' }, members.map((m) => h('li', { text: m }))),
          ]),
        ),
      );
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.groups.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        const nLabel = () => t(state.by === 'count' ? 'widget.groups.countLabel' : 'widget.groups.sizeLabel');
        const nField = stepper({
          label: nLabel(),
          value: state.n,
          min: MIN_N,
          max: MAX_N,
          decLabel: t('common.decrease'),
          incLabel: t('common.increase'),
          onChange: (n) => ctx.setState((s) => setRule(s, s.by, n)),
        });
        body.append(
          listEditor({
            label: t('widget.list.label'),
            items: state.items,
            placeholder: t('widget.list.placeholder'),
            countText: (n) => t('widget.list.count', { n }),
            parse: parseItems,
            onChange: (items) => ctx.setState((s) => setItems(s, items)),
          }),
          segmented({
            label: t('widget.groups.by'),
            options: [
              { value: 'count', label: t('widget.groups.byCount') },
              { value: 'size', label: t('widget.groups.bySize') },
            ],
            value: state.by,
            onChange: (by) => {
              ctx.setState((s) => setRule(s, by, s.n));
              const label = nField.querySelector('.w-field__label');
              if (label) label.textContent = nLabel();
            },
          }),
          nField,
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
        view.remove();
        empty.remove();
      },
    };
  },
};
