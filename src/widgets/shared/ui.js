/**
 * 위젯 공통 UI 조각. 스타일은 src/styles/widgets.css (.w-*)
 */
import { h, icon } from '../../ui/dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {string} tag
 * @param {Record<string, string | number>} [attrs]
 * @param {Element[]} [children]
 */
export function svg(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) el.append(c);
  return el;
}

/**
 * 위젯용 버튼.
 * @param {{
 *   text?: string,
 *   iconName?: string,
 *   label?: string,
 *   variant?: 'primary' | 'danger' | 'ghost',
 *   onClick?: (event: MouseEvent) => void,
 *   className?: string,
 * }} options
 */
export function button({ text, iconName, label, variant, onClick, className = '' }) {
  const classes = ['w-btn', variant ? `w-btn--${variant}` : '', !text ? 'w-btn--icon' : '', className];
  const el = /** @type {HTMLButtonElement} */ (
    h('button', { className: classes.filter(Boolean).join(' '), attrs: { type: 'button' } })
  );
  if (label) {
    el.setAttribute('aria-label', label);
    el.title = label;
  }
  if (iconName) el.append(icon(iconName));
  if (text) el.append(h('span', { className: 'w-btn__text', text }));
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

/**
 * 위젯 본문 위에 겹쳐 여는 설정 패널.
 * 열 때마다 build()로 현재 상태 기준의 입력 요소를 새로 만든다.
 *
 * @param {HTMLElement} container 위젯 본문 (ctx가 받은 container)
 * @param {{ title: string, doneLabel: string, build: (body: HTMLElement, close: () => void) => void, onClose?: () => void }} options
 */
export function createSettingsPanel(container, { title, doneLabel, build, onClose }) {
  /** @type {HTMLElement | null} */
  let panel = null;

  function close() {
    if (!panel) return;
    panel.remove();
    panel = null;
    onClose?.();
    /** @type {HTMLElement | null} */ (container.closest('.widget'))?.focus();
  }

  function open() {
    if (panel) return close();
    const body = h('div', { className: 'w-panel__body' });
    const done = button({ text: doneLabel, variant: 'primary', onClick: close });
    panel = h('div', { className: 'w-panel', attrs: { role: 'group', 'aria-label': title } }, [
      h('div', { className: 'w-panel__header' }, [h('p', { className: 'w-panel__title', text: title }), done]),
      body,
    ]);
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    });
    build(body, close);
    container.append(panel);
    /** @type {HTMLElement | null} */ (body.querySelector('input, textarea, select, button'))?.focus();
  }

  return { open, close, isOpen: () => panel !== null };
}

/**
 * 라벨 + 입력 요소 묶음
 * @param {string} label
 * @param {Node} control
 * @param {string} [hint]
 */
export function field(label, control, hint) {
  return h('div', { className: 'w-field' }, [
    h('span', { className: 'w-field__label', text: label }),
    control,
    hint ? h('span', { className: 'w-field__hint', text: hint }) : null,
  ]);
}

/**
 * 단일 선택 버튼 묶음 (aria-pressed)
 * @template {string} V
 * @param {{ label: string, options: { value: V, label: string }[], value: V, onChange: (value: V) => void }} options
 */
export function segmented({ label, options, value, onChange }) {
  const group = h('div', { className: 'w-seg', attrs: { role: 'group', 'aria-label': label } });
  const buttons = options.map((opt) => {
    const b = h('button', {
      className: 'w-seg__opt',
      text: opt.label,
      attrs: { type: 'button', 'aria-pressed': String(opt.value === value) },
    });
    b.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === b));
      onChange(opt.value);
    });
    return b;
  });
  group.append(...buttons);
  return field(label, group);
}

/**
 * 체크박스 토글
 * @param {{ label: string, checked: boolean, onChange: (checked: boolean) => void }} options
 */
export function toggle({ label, checked, onChange }) {
  const input = /** @type {HTMLInputElement} */ (h('input', { attrs: { type: 'checkbox' } }));
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { className: 'w-toggle' }, [input, h('span', { text: label })]);
}

/**
 * 한 줄 입력
 * @param {{ label: string, value: string, placeholder?: string, maxLength?: number, onInput: (value: string) => void }} options
 */
export function textInput({ label, value, placeholder = '', maxLength = 60, onInput }) {
  const input = /** @type {HTMLInputElement} */ (
    h('input', {
      className: 'w-input',
      attrs: { type: 'text', 'aria-label': label, placeholder, maxlength: String(maxLength) },
    })
  );
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

/**
 * 명단 입력 (한 줄에 하나). 입력 원문은 그대로 두고 파싱 결과만 전달한다.
 * @param {{
 *   label: string,
 *   items: string[],
 *   placeholder: string,
 *   countText: (n: number) => string,
 *   parse: (text: string) => string[],
 *   onChange: (items: string[]) => void,
 * }} options
 */
export function listEditor({ label, items, placeholder, countText, parse, onChange }) {
  const textarea = /** @type {HTMLTextAreaElement} */ (
    h('textarea', {
      className: 'w-textarea',
      attrs: { 'aria-label': label, placeholder, rows: '6', spellcheck: 'false' },
    })
  );
  textarea.value = items.join('\n');
  const count = h('span', { className: 'w-field__hint', text: countText(items.length) });
  textarea.addEventListener('input', () => {
    const parsed = parse(textarea.value);
    count.textContent = countText(parsed.length);
    onChange(parsed);
  });
  return h('div', { className: 'w-field' }, [h('span', { className: 'w-field__label', text: label }), textarea, count]);
}

/**
 * 숫자 증감기
 * @param {{ label: string, value: number, min: number, max: number, onChange: (n: number) => void, decLabel: string, incLabel: string }} options
 */
export function stepper({ label, value, min, max, onChange, decLabel, incLabel }) {
  let current = value;
  const out = h('output', { className: 'w-stepper__value', text: String(current) });
  const dec = button({ iconName: 'minus', label: decLabel });
  const inc = button({ iconName: 'plus', label: incLabel });
  const sync = () => {
    out.textContent = String(current);
    dec.disabled = current <= min;
    inc.disabled = current >= max;
  };
  dec.addEventListener('click', () => {
    current = Math.max(min, current - 1);
    sync();
    onChange(current);
  });
  inc.addEventListener('click', () => {
    current = Math.min(max, current + 1);
    sync();
    onChange(current);
  });
  sync();
  return field(label, h('div', { className: 'w-stepper' }, [dec, out, inc]));
}

/** 사용자가 움직임 줄이기를 설정했는지 */
export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 화면 낭독기 알림 영역 (M6 live region 정책, TRD 2.2.4). 보이지 않으며, 사용자 조작의 **최종 결과**만 알린다.
 * 연출 중(뽑기·주사위) 바뀌는 글자는 이 영역이 아닌 일반 요소에 그린다.
 * @param {HTMLElement} container
 * @param {'polite' | 'assertive'} [politeness]
 */
export function liveRegion(container, politeness = 'polite') {
  const el = h('p', {
    className: 'sr-only',
    attrs: { role: politeness === 'assertive' ? 'alert' : 'status', 'aria-live': politeness, 'aria-atomic': 'true' },
  });
  container.append(el);
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  return {
    /** 같은 문구를 다시 말해도 읽히도록 비웠다가 넣는다 @param {string} text */
    say(text) {
      el.textContent = '';
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        el.textContent = text;
        timer = null;
      }, 60);
    },
    destroy() {
      if (timer !== null) clearTimeout(timer);
    },
  };
}
