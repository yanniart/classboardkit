/**
 * 템플릿 → 새 보드 (F-013). 순수 함수 — 위젯 정의는 레지스트리로 받는다.
 */
import { createBoard } from './schema.js';
import { BACKGROUND_PRESETS } from './backgrounds.js';
import { clampRect } from './geometry.js';
import { createId } from './utils/id.js';

/** 템플릿 배치가 피해야 하는 영역 (캔버스 비율) */
export const TEMPLATE_TOP_RESERVED = 0.1; // 툴바
export const TEMPLATE_BOTTOM_RESERVED = 0.12; // 독

/**
 * @param {import('../templates/index.js').BoardTemplate} template
 * @param {{ get: (type: string) => any }} registry
 * @param {(key: string, params?: Record<string, string | number>) => string} t 현재 언어
 * @param {Date} [now]
 */
export function createBoardFromTemplate(template, registry, t, now = new Date()) {
  const board = createBoard(t(template.nameKey), now);
  const preset = BACKGROUND_PRESETS.find((p) => p.key === template.background) ?? BACKGROUND_PRESETS[0];
  board.background = { type: preset.type, value: preset.value };
  board.widgets = template.widgets.map((spec, i) => {
    const def = registry.get(spec.type);
    if (!def) throw new Error(`Template "${template.id}" uses unknown widget type "${spec.type}"`);
    const base = def.createState();
    const [x, y, w, h] = spec.rect;
    return {
      id: createId('w'),
      type: def.type,
      version: def.version,
      ...clampRect({ x, y, w, h }, def.minSize),
      z: i + 1,
      state: spec.state ? spec.state(t, base) : base,
    };
  });
  return board;
}
