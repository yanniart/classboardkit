import { createRegistry } from '../core/registry.js';
import timer from './timer/index.js';
import stopwatch from './stopwatch/index.js';
import clock from './clock/index.js';
import randomizer from './randomizer/index.js';
import groups from './groups/index.js';
import scoreboard from './scoreboard/index.js';
import traffic from './traffic/index.js';
import text from './text/index.js';

/** 기본 제공 위젯 — 배열 순서가 독 표시 순서 */
export const BUILT_IN_WIDGETS = [timer, stopwatch, clock, randomizer, groups, scoreboard, traffic, text];

export function createDefaultRegistry() {
  const registry = createRegistry();
  for (const def of BUILT_IN_WIDGETS) registry.register(def);
  return registry;
}
