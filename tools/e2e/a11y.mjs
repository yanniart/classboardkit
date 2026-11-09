// 접근성 자동 점검 도우미 (M6, ADR-0010)
// - axe(): 개발 전용 axe-core(.tools/axe/axe.min.js, git 제외)를 페이지에 주입해 실행
// - axTree(): CDP 접근성 트리에서 이름 없는 상호작용 요소를 찾음 (axe가 없어도 동작)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AXE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.tools', 'axe', 'axe.min.js');
export const AXE_AVAILABLE = existsSync(AXE_PATH);
const AXE_SOURCE = AXE_AVAILABLE ? readFileSync(AXE_PATH, 'utf8') : '';

/** 점검 기준 (D2): WCAG 2.0·2.1 A/AA + 2.2 AA */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/**
 * @param {{ evaluate: (expr: string) => Promise<any> }} b 하네스
 * @param {{ include?: string, exclude?: string[], disable?: string[] }} [options]
 * @returns {Promise<{ id: string, impact: string, help: string, nodes: string[] }[] | null>} axe가 없으면 null
 */
export async function axe(b, { include, exclude = [], disable = [] } = {}) {
  if (!AXE_AVAILABLE) return null;
  const loaded = await b.evaluate(`typeof window.axe === 'object'`);
  if (!loaded) await b.evaluate(`${AXE_SOURCE}\n;true`);
  const context = include || exclude.length
    ? JSON.stringify({ ...(include ? { include: [include] } : {}), exclude: exclude.map((s) => [s]) })
    : 'document';
  const rules = Object.fromEntries(disable.map((id) => [id, { enabled: false }]));
  return b.evaluate(`axe.run(${context}, { runOnly: { type: 'tag', values: ${JSON.stringify(TAGS)} }, rules: ${JSON.stringify(rules)}, resultTypes: ['violations'] })
    .then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\\n').slice(1, 2).join('').trim()) })))`);
}

/** critical·serious만 (D3 기준) */
export const severe = (violations) => (violations ?? []).filter((v) => v.impact === 'critical' || v.impact === 'serious');

/** 위반 요약 문자열 */
export const summarize = (violations) =>
  (violations ?? []).map((v) => `${v.impact}:${v.id}(${v.nodes.length}) ${v.nodes[0] ?? ''}`).join(' | ');

const INTERACTIVE = new Set(['button', 'link', 'textbox', 'checkbox', 'combobox', 'slider', 'spinbutton', 'tab', 'menuitem', 'switch', 'radio', 'searchbox', 'listbox', 'option']);

/**
 * 접근성 트리에서 이름 없는 상호작용 요소
 * @param {{ cdp: (m: string, p?: object) => Promise<any> }} b
 * @returns {Promise<{ unnamed: string[], counts: Record<string, number> }>}
 */
export async function axTree(b) {
  await b.cdp('Accessibility.enable');
  const { nodes } = await b.cdp('Accessibility.getFullAXTree');
  const unnamed = [];
  const counts = {};
  for (const n of nodes) {
    if (n.ignored) continue;
    const role = n.role?.value;
    if (!INTERACTIVE.has(role)) continue;
    counts[role] = (counts[role] ?? 0) + 1;
    const name = (n.name?.value ?? '').trim();
    if (!name) unnamed.push(`${role}#${n.backendDOMNodeId}`);
  }
  return { unnamed, counts };
}

/**
 * 접근성 트리에서 특정 DOM 요소의 역할·이름·속성
 * @param {{ cdp: (m: string, p?: object) => Promise<any> }} b
 * @param {string} selector
 */
export async function axNode(b, selector) {
  const { root } = await b.cdp('DOM.getDocument', { depth: -1, pierce: false });
  const { nodeId } = await b.cdp('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) return null;
  const { nodes } = await b.cdp('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
  const n = nodes[0];
  if (!n) return null;
  const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value]));
  return { role: n.role?.value, name: n.name?.value ?? '', ignored: n.ignored, props };
}
