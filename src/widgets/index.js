import { createRegistry } from '../core/registry.js';
import timer from './timer/index.js';
import stopwatch from './stopwatch/index.js';
import clock from './clock/index.js';
import randomizer from './randomizer/index.js';
import groups from './groups/index.js';
import scoreboard from './scoreboard/index.js';
import traffic from './traffic/index.js';
import text from './text/index.js';
import countdown from './countdown/index.js';
import dice from './dice/index.js';
import draw from './draw/index.js';
import image from './image/index.js';
import noise from './noise/index.js';
import qr from './qr/index.js';
import symbols from './symbols/index.js';

/** 기본 제공 위젯 — 배열 순서가 독 표시 순서 */
export const BUILT_IN_WIDGETS = [
  timer,
  stopwatch,
  clock,
  countdown,
  randomizer,
  dice,
  groups,
  scoreboard,
  traffic,
  symbols,
  noise,
  text,
  draw,
  image,
  qr,
];

export function createDefaultRegistry() {
  const registry = createRegistry();
  for (const def of BUILT_IN_WIDGETS) registry.register(def);
  return registry;
}
