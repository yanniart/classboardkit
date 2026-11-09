import { h } from '../../ui/dom.js';
import { openDialog } from '../../ui/dialog.js';
import { button } from '../shared/ui.js';
import {
  COLORS,
  MAX_POINTS,
  SCALE,
  WIDTHS,
  addStroke,
  clear,
  compressPoints,
  containRect,
  createDrawState,
  pointCount,
  strokeWidthPx,
  undo,
} from './draw-logic.js';

/** 'ink'는 테마 글자색을 따른다 */
const COLOR_HEX = {
  red: '#e5484d',
  blue: '#2f6fde',
  green: '#2e9d4f',
  orange: '#f08c00',
  purple: '#8e4ec6',
};
const NOTICE_MS = 4000;

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'draw',
  version: 1,
  icon: 'pen',
  titleKey: 'widget.draw.title',
  defaultSize: { w: 0.4, h: 0.5 },
  minSize: { w: 0.18, h: 0.24 },
  styleUrl: new URL('./draw.css', import.meta.url).href,
  createState: createDrawState,

  mount(container, ctx) {
    const { t } = ctx;
    /** @type {import('./draw-logic.js').DrawState} */
    let state = ctx.state;
    /** 현재 도구 (저장하지 않음) */
    const tool = { color: /** @type {string} */ ('ink'), width: /** @type {string} */ ('m'), eraser: false };
    /** @type {{ id: number, pts: number[], stroke: import('./draw-logic.js').Stroke } | null} */
    let live = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let noticeTimer = null;

    const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { className: 'draw__canvas' }));
    const paper = h('div', { className: 'draw__paper' });
    const hint = h('p', { className: 'draw__hint', text: t('widget.draw.hint') });
    const notice = h('p', { className: 'draw__notice', attrs: { role: 'status' } });
    const stage = h('div', { className: 'draw__stage' }, [paper, hint, canvas, notice]);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', t('widget.draw.canvasLabel'));

    // ── 도구 막대 ──
    const penButton = button({ iconName: 'pen', label: t('widget.draw.pen'), className: 'draw__pen' });
    const eraserButton = button({ iconName: 'eraser', label: t('widget.draw.eraser') });
    const undoButton = button({ iconName: 'undo', label: t('widget.draw.undo') });
    const clearButton = button({ iconName: 'trash', label: t('widget.draw.clear') });
    const palette = h('div', { className: 'draw__palette', attrs: { role: 'group', 'aria-label': t('widget.draw.pen') } });
    palette.hidden = true;
    const colorButtons = COLORS.map((c) => {
      const b = button({ label: t(`widget.draw.colors.${c}`), className: 'draw__swatch' });
      b.dataset.color = c;
      b.addEventListener('click', () => {
        tool.color = c;
        tool.eraser = false;
        paintTools();
      });
      return b;
    });
    const widthButtons = WIDTHS.map((w) => {
      const b = button({ label: t(`widget.draw.widths.${w}`), className: 'draw__width' });
      b.dataset.width = w;
      b.append(h('span', { className: 'draw__dot' }));
      b.addEventListener('click', () => {
        tool.width = w;
        tool.eraser = false;
        paintTools();
      });
      return b;
    });
    palette.append(...colorButtons, h('span', { className: 'draw__sep' }), ...widthButtons);
    const toolbar = h('div', { className: 'draw__toolbar' }, [penButton, eraserButton, undoButton, clearButton]);
    const root = h('div', { className: 'draw' }, [toolbar, palette, stage]);
    container.append(root);

    penButton.addEventListener('click', () => {
      if (tool.eraser) tool.eraser = false;
      else palette.hidden = !palette.hidden;
      paintTools();
    });
    eraserButton.addEventListener('click', () => {
      tool.eraser = !tool.eraser;
      paintTools();
    });
    undoButton.addEventListener('click', () => ctx.setState((s) => undo(s)));
    clearButton.addEventListener('click', async () => {
      const ok = await openDialog({
        title: t('widget.draw.clearTitle'),
        message: t('widget.draw.clearMessage'),
        confirmLabel: t('widget.draw.clear'),
        cancelLabel: t('dialog.cancel'),
        danger: true,
      });
      if (ok) ctx.setState((s) => clear(s));
    });

    function paintTools() {
      penButton.setAttribute('aria-pressed', String(!tool.eraser));
      penButton.setAttribute('aria-expanded', String(!palette.hidden));
      penButton.style.setProperty('--pen', colorOf(tool.color));
      eraserButton.setAttribute('aria-pressed', String(tool.eraser));
      for (const b of colorButtons) b.setAttribute('aria-pressed', String(b.dataset.color === tool.color));
      for (const b of widthButtons) b.setAttribute('aria-pressed', String(b.dataset.width === tool.width));
      root.style.setProperty('--pen', colorOf(tool.color));
      stage.classList.toggle('is-erasing', tool.eraser);
    }

    // ── 그리기 ──

    /** @param {string} c */
    function colorOf(c) {
      return c === 'ink' ? getComputedStyle(root).color : (COLOR_HEX[/** @type {keyof typeof COLOR_HEX} */ (c)] ?? '#000');
    }

    /** 현재 그리기 영역 (stage 기준 px). 첫 획 전에는 stage 전체 */
    function paperRect() {
      return containRect(stage.clientWidth, stage.clientHeight, state.aspect);
    }

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(stage.clientWidth * dpr));
      const hgt = Math.max(1, Math.round(stage.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== hgt) {
        canvas.width = w;
        canvas.height = hgt;
      }
      redraw();
    }

    /**
     * @param {CanvasRenderingContext2D} g
     * @param {import('./draw-logic.js').Stroke} stroke
     * @param {{ x: number, y: number, w: number, h: number }} r
     * @param {number} scale p 값 → 정규화 좌표 배율 (저장 획 1/SCALE, 진행 중 획 1)
     */
    function drawStroke(g, stroke, r, scale) {
      const p = stroke.p;
      if (p.length < 2) return;
      g.globalCompositeOperation = stroke.e ? 'destination-out' : 'source-over';
      g.strokeStyle = stroke.e ? '#000' : colorOf(stroke.c);
      g.lineWidth = strokeWidthPx(stroke, r);
      g.beginPath();
      g.moveTo(r.x + p[0] * scale * r.w, r.y + p[1] * scale * r.h);
      if (p.length === 2) g.lineTo(r.x + p[0] * scale * r.w + 0.01, r.y + p[1] * scale * r.h);
      for (let i = 2; i < p.length; i += 2) g.lineTo(r.x + p[i] * scale * r.w, r.y + p[i + 1] * scale * r.h);
      g.stroke();
    }

    function redraw() {
      const g = canvas.getContext('2d');
      if (!g) return;
      const dpr = canvas.width / Math.max(1, stage.clientWidth);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, stage.clientWidth, stage.clientHeight);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const r = paperRect();
      for (const s of state.strokes) drawStroke(g, s, r, 1 / SCALE);
      if (live) drawStroke(g, live.stroke, liveRect(), 1);
      g.globalCompositeOperation = 'source-over';
      paper.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
      hint.hidden = state.strokes.length > 0 || live !== null;
      undoButton.disabled = state.strokes.length === 0;
      clearButton.disabled = state.strokes.length === 0;
    }

    /** 진행 중 획은 시작할 때의 영역 기준 (첫 획이면 stage 전체) */
    function liveRect() {
      return paperRect();
    }

    /** @param {PointerEvent} e */
    function toNormalized(e) {
      const box = canvas.getBoundingClientRect();
      const r = liveRect();
      return [
        Math.min(1, Math.max(0, (e.clientX - box.left - r.x) / r.w)),
        Math.min(1, Math.max(0, (e.clientY - box.top - r.y) / r.h)),
      ];
    }

    /** @param {string} key */
    function showNotice(key) {
      notice.textContent = t(key);
      notice.hidden = false;
      if (noticeTimer !== null) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        notice.hidden = true;
      }, NOTICE_MS);
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (live || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (pointCount(state.strokes) >= MAX_POINTS) {
        showNotice('widget.draw.full');
        return;
      }
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      palette.hidden = true;
      paintTools();
      const pts = toNormalized(e);
      live = {
        id: e.pointerId,
        pts,
        stroke: tool.eraser ? { c: 'ink', w: 'm', e: true, p: pts } : { c: tool.color, w: tool.width, p: pts },
      };
      redraw();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!live || e.pointerId !== live.id) return;
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) live.pts.push(...toNormalized(ev));
      redraw();
    });

    /** @param {PointerEvent} e */
    function finish(e) {
      if (!live || e.pointerId !== live.id) return;
      const { stroke, pts } = live;
      live = null;
      if (e.type === 'pointercancel') {
        redraw();
        return;
      }
      const r = paperRect();
      const saved = { ...stroke, p: compressPoints(pts) };
      const next = addStroke(state, saved, r.w / r.h);
      if (next === null) {
        showNotice('widget.draw.full');
        redraw();
        return;
      }
      ctx.setState(next);
    }
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(stage);
    // 테마가 바뀌면 'ink' 색이 달라지므로 다시 그림
    const onThemeChange = () => {
      paintTools();
      redraw();
    };
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // "시스템" 테마에서 OS 다크 모드가 바뀌어도 (M4 이월 → M6)
    const schemeQuery = matchMedia('(prefers-color-scheme: dark)');
    schemeQuery.addEventListener('change', onThemeChange);

    notice.hidden = true;
    paintTools();
    resizeCanvas();

    return {
      update(next) {
        state = next;
        redraw();
      },
      destroy() {
        resizeObserver.disconnect();
        themeObserver.disconnect();
        schemeQuery.removeEventListener('change', onThemeChange);
        if (noticeTimer !== null) clearTimeout(noticeTimer);
        root.remove();
      },
    };
  },
};
