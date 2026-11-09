import { TEMPLATES } from '../templates/index.js';
import { createBoardFromTemplate } from '../core/templates.js';
import { openContentDialog } from './dialog.js';
import { h, icon } from './dom.js';

/**
 * 템플릿 고르기 대화상자 (F-013). 고르면 새 보드 객체, 닫으면 null.
 * 보드 메뉴가 열 때 동적으로 불러온다 (첫 화면 로딩에 포함되지 않게).
 *
 * @param {{
 *   registry: { get: (type: string) => any },
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 * }} deps
 * @returns {Promise<any | null>}
 */
export function chooseTemplate({ registry, i18n }) {
  const { t } = i18n;
  return openContentDialog({
    title: t('template.title'),
    closeLabel: t('dialog.cancel'),
    className: 'template-dialog',
    build(body, done) {
      const grid = h(
        'div',
        { className: 'template-grid' },
        TEMPLATES.map((tpl) => {
          const card = h('button', { className: 'template-card', attrs: { type: 'button' }, dataset: { template: tpl.id } }, [
            miniMap(tpl, registry),
            h('span', { className: 'template-card__name', text: t(tpl.nameKey) }),
            h('span', { className: 'template-card__desc', text: t(tpl.descKey) }),
          ]);
          card.setAttribute('aria-label', `${t(tpl.nameKey)}. ${t(tpl.descKey)}`);
          card.addEventListener('click', () => done(createBoardFromTemplate(tpl, registry, t)));
          return card;
        }),
      );
      body.append(h('p', { className: 'dialog__message', text: t('template.intro') }), grid);
    },
  });
}

/**
 * 배치 미리보기: 위젯 자리를 회색 사각형 + 아이콘으로 (이미지 없음)
 * @param {import('../templates/index.js').BoardTemplate} tpl
 * @param {{ get: (type: string) => any }} registry
 */
function miniMap(tpl, registry) {
  const map = h('span', { className: 'template-card__map', attrs: { 'aria-hidden': 'true' } });
  for (const { type, rect } of tpl.widgets) {
    const [x, y, w, hgt] = rect;
    const cell = h('span', { className: 'template-card__cell' }, [icon(registry.get(type)?.icon ?? 'board')]);
    cell.style.left = `${x * 100}%`;
    cell.style.top = `${y * 100}%`;
    cell.style.width = `${w * 100}%`;
    cell.style.height = `${hgt * 100}%`;
    map.append(cell);
  }
  return map;
}
