/**
 * 보드 템플릿 (F-013, M5 결정 D7). 데이터만 — 보드 생성은 core/templates.js.
 *
 * rect = [x, y, w, h] (캔버스 비율, ADR-0004). 위쪽 툴바(10%)와 아래 독(12%)을 피하고 서로 겹치지 않게 배치.
 * state(t, base): 위젯 기본 state(base)를 받아 바꾼 state를 반환 (문구는 현재 언어로 채움). 없으면 base 그대로.
 *
 * @typedef {{
 *   type: string,
 *   rect: [number, number, number, number],
 *   state?: (t: (key: string, params?: Record<string, string | number>) => string, base: any) => any,
 * }} TemplateWidget
 * @typedef {{
 *   id: string,
 *   nameKey: string,
 *   descKey: string,
 *   background: string,
 *   widgets: TemplateWidget[],
 * }} BoardTemplate
 */

import { createScoreboardState } from '../widgets/scoreboard/scoreboard-logic.js';

const MIN = 60_000;

/** @type {BoardTemplate[]} */
export const TEMPLATES = [
  {
    id: 'lesson-start',
    nameKey: 'template.lessonStart.name',
    descKey: 'template.lessonStart.desc',
    background: 'sky',
    widgets: [
      { type: 'clock', rect: [0.03, 0.11, 0.28, 0.32] },
      {
        type: 'text',
        rect: [0.34, 0.11, 0.43, 0.32],
        state: (t, base) => ({ ...base, content: t('template.lessonStart.goal'), size: 'l' }),
      },
      { type: 'timer', rect: [0.03, 0.47, 0.3, 0.39], state: (_, base) => ({ ...base, durationMs: 5 * MIN }) },
      { type: 'traffic', rect: [0.8, 0.11, 0.17, 0.5] },
    ],
  },
  {
    id: 'group-work',
    nameKey: 'template.groupWork.name',
    descKey: 'template.groupWork.desc',
    background: 'mint',
    widgets: [
      { type: 'groups', rect: [0.03, 0.11, 0.48, 0.75] },
      { type: 'timer', rect: [0.54, 0.11, 0.24, 0.4], state: (_, base) => ({ ...base, durationMs: 15 * MIN }) },
      { type: 'traffic', rect: [0.81, 0.11, 0.16, 0.5] },
      { type: 'noise', rect: [0.54, 0.54, 0.24, 0.32] },
    ],
  },
  {
    id: 'presentation',
    nameKey: 'template.presentation.name',
    descKey: 'template.presentation.desc',
    background: 'lavender',
    widgets: [
      { type: 'randomizer', rect: [0.03, 0.11, 0.34, 0.75], state: (_, base) => ({ ...base, excludePicked: true }) },
      { type: 'stopwatch', rect: [0.4, 0.11, 0.3, 0.4] },
      { type: 'scoreboard', rect: [0.4, 0.54, 0.57, 0.32] },
    ],
  },
  {
    id: 'quiz',
    nameKey: 'template.quiz.name',
    descKey: 'template.quiz.desc',
    background: 'sunset',
    widgets: [
      { type: 'scoreboard', rect: [0.03, 0.11, 0.6, 0.75], state: () => createScoreboardState(4) },
      { type: 'dice', rect: [0.66, 0.11, 0.31, 0.4], state: (_, base) => ({ ...base, count: 2 }) },
      { type: 'timer', rect: [0.66, 0.54, 0.31, 0.32], state: (_, base) => ({ ...base, durationMs: 30_000 }) },
    ],
  },
  {
    id: 'quiet',
    nameKey: 'template.quiet.name',
    descKey: 'template.quiet.desc',
    background: 'paper',
    widgets: [
      { type: 'clock', rect: [0.03, 0.11, 0.4, 0.4], state: (_, base) => ({ ...base, showSeconds: true }) },
      { type: 'countdown', rect: [0.03, 0.54, 0.4, 0.32] },
      {
        type: 'text',
        rect: [0.46, 0.11, 0.51, 0.4],
        state: (t, base) => ({ ...base, content: t('template.quiet.note'), size: 'xl' }),
      },
      { type: 'noise', rect: [0.46, 0.54, 0.24, 0.32], state: (_, base) => ({ ...base, style: 'face' }) },
    ],
  },
  {
    id: 'break',
    nameKey: 'template.break.name',
    descKey: 'template.break.desc',
    background: 'peach',
    widgets: [
      {
        type: 'timer',
        rect: [0.03, 0.11, 0.32, 0.5],
        state: (_, base) => ({ ...base, durationMs: 10 * MIN, mode: 'visual' }),
      },
      {
        type: 'text',
        rect: [0.03, 0.64, 0.32, 0.22],
        state: (t, base) => ({ ...base, content: t('template.break.note') }),
      },
      { type: 'qr', rect: [0.38, 0.11, 0.24, 0.46] },
      { type: 'draw', rect: [0.65, 0.11, 0.32, 0.75] },
    ],
  },
];
