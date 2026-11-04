/**
 * 작은 DOM 헬퍼. 사용자 입력은 항상 textContent로만 넣는다 (TRD 7).
 *
 * @param {string} tag
 * @param {{ className?: string, text?: string, attrs?: Record<string, string>, dataset?: Record<string, string> }} [options]
 * @param {(Node | null | undefined | false)[]} [children]
 */
export function h(tag, options = {}, children = []) {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.text !== undefined) el.textContent = options.text;
  for (const [k, v] of Object.entries(options.attrs ?? {})) el.setAttribute(k, v);
  Object.assign(el.dataset, options.dataset ?? {});
  for (const child of children) if (child) el.append(child);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 스프라이트 아이콘 <svg><use/></svg>
 * @param {string} name assets/icons.svg의 symbol id
 * @param {string} [className]
 */
export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `assets/icons.svg#${name}`);
  svg.append(use);
  return svg;
}

/**
 * 아이콘 버튼 (접근 가능한 이름 필수)
 * @param {{ iconName: string, label: string, className?: string, text?: string }} options
 */
export function iconButton({ iconName, label, className = 'icon-button', text }) {
  const button = h('button', { className, attrs: { type: 'button', 'aria-label': label, title: label } });
  button.append(icon(iconName));
  if (text) button.append(h('span', { text }));
  return button;
}
