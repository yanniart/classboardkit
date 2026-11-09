import { h } from '../../ui/dom.js';
import { button, createSettingsPanel, field, stepper, textInput, liveRegion } from '../shared/ui.js';
import {
  MAX_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  TEAM_COLORS,
  addTeam,
  changeScore,
  createScoreboardState,
  leaders,
  removeTeam,
  renameTeam,
  resetScores,
  setTeamColor,
} from './scoreboard-logic.js';

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'scoreboard',
  version: 1,
  icon: 'trophy',
  titleKey: 'widget.scoreboard.title',
  defaultSize: { w: 0.44, h: 0.38 },
  minSize: { w: 0.2, h: 0.2 },
  styleUrl: new URL('./scoreboard.css', import.meta.url).href,
  createState: () => createScoreboardState(2),

  mount(container, ctx) {
    const { t } = ctx;
    let state = ctx.state;

    const root = h('div', { className: 'scoreboard' });
    container.append(root);
    const live = liveRegion(container);
    /** 버튼으로 점수를 바꾼 팀 — 다음 그리기에서 "1팀 5점"을 알림 */
    /** @type {string | null} */
    let announceTeam = null;

    /** @param {{ name: string }} team @param {number} index */
    const teamName = (team, index) => team.name || t('widget.scoreboard.teamN', { n: index + 1 });

    /** 팀 카드는 팀 구성이 바뀔 때만 다시 만들고, 점수는 제자리에서 갱신 */
    /** @type {Map<string, { card: HTMLElement, name: HTMLElement, score: HTMLElement }>} */
    let cards = new Map();
    let layoutKey = '';

    function build() {
      cards = new Map();
      // 4팀까지 한 줄, 5팀 이상은 2줄
      root.style.setProperty('--cols', String(state.teams.length <= 4 ? state.teams.length : Math.ceil(state.teams.length / 2)));
      root.replaceChildren(
        ...state.teams.map((team, i) => {
          const name = h('p', { className: 'scoreboard__name' });
          const score = h('p', { className: 'scoreboard__score' });
          const label = teamName(team, i);
          const card = h('section', { className: 'scoreboard__team', dataset: { color: team.color } }, [
            name,
            score,
            h('div', { className: 'scoreboard__buttons' }, [
              button({
                text: '−1',
                label: t('widget.scoreboard.minus', { name: label }),
                onClick: () => {
                  announceTeam = team.id;
                  ctx.setState((s) => changeScore(s, team.id, -1));
                },
              }),
              button({
                text: '+1',
                variant: 'primary',
                label: t('widget.scoreboard.plus', { name: label }),
                onClick: () => {
                  announceTeam = team.id;
                  ctx.setState((s) => changeScore(s, team.id, 1));
                },
              }),
            ]),
          ]);
          cards.set(team.id, { card, name, score });
          return card;
        }),
      );
    }

    function paint() {
      const key = state.teams.map((x) => `${x.id}:${x.color}:${x.name}`).join('|');
      if (key !== layoutKey) {
        layoutKey = key;
        build();
      }
      const top = leaders(state);
      state.teams.forEach((team, i) => {
        const c = cards.get(team.id);
        if (!c) return;
        c.name.textContent = teamName(team, i);
        c.score.textContent = String(team.score);
        c.card.classList.toggle('is-leader', top.has(team.id));
        if (announceTeam === team.id) live.say(t('widget.scoreboard.announce', { team: teamName(team, i), n: team.score }));
      });
      announceTeam = null;
    }

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.scoreboard.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        const teamFields = h('div', { className: 'scoreboard__settings-teams' });

        const renderTeamFields = () => {
          teamFields.replaceChildren(
            ...state.teams.map((team, i) => {
              const swatches = h(
                'div',
                { className: 'w-colors', attrs: { role: 'group', 'aria-label': t('widget.scoreboard.color') } },
                TEAM_COLORS.map((color) => {
                  const sw = h('button', {
                    className: 'w-color',
                    attrs: {
                      type: 'button',
                      'aria-label': t(`color.${color}`),
                      title: t(`color.${color}`),
                      'aria-pressed': String(team.color === color),
                    },
                  });
                  sw.style.setProperty('--swatch', `var(--team-${color})`);
                  sw.addEventListener('click', () => {
                    for (const other of swatches.children) other.setAttribute('aria-pressed', String(other === sw));
                    ctx.setState((s) => setTeamColor(s, team.id, color));
                  });
                  return sw;
                }),
              );
              return field(
                t('widget.scoreboard.teamN', { n: i + 1 }),
                h('div', { className: 'scoreboard__team-edit' }, [
                  textInput({
                    label: t('widget.scoreboard.teamName', { n: i + 1 }),
                    value: team.name,
                    placeholder: t('widget.scoreboard.teamN', { n: i + 1 }),
                    maxLength: MAX_NAME_LENGTH,
                    onInput: (v) => ctx.setState((s) => renameTeam(s, team.id, v)),
                  }),
                  swatches,
                ]),
              );
            }),
          );
        };

        body.append(
          stepper({
            label: t('widget.scoreboard.teamCount'),
            value: state.teams.length,
            min: MIN_TEAMS,
            max: MAX_TEAMS,
            decLabel: t('common.decrease'),
            incLabel: t('common.increase'),
            onChange: (n) => {
              ctx.setState((s) => {
                let next = s;
                while (next.teams.length < n) next = addTeam(next);
                while (next.teams.length > n) next = removeTeam(next, next.teams[next.teams.length - 1].id);
                return next;
              });
              renderTeamFields();
            },
          }),
          teamFields,
          button({
            iconName: 'reset',
            variant: 'danger',
            text: t('widget.scoreboard.resetScores'),
            onClick: () => ctx.setState((s) => resetScores(s)),
          }),
        );
        renderTeamFields();
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
