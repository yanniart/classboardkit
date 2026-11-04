export const TEAM_COLORS = /** @type {const} */ ([
  'red', 'blue', 'green', 'orange', 'purple', 'teal', 'pink', 'yellow',
]);
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 8;
export const MIN_SCORE = -999;
export const MAX_SCORE = 9999;
export const MAX_NAME_LENGTH = 30;

/**
 * name이 빈 문자열이면 화면에서 "팀 n" 기본 이름을 번역해 표시한다 (언어 전환 대응).
 * @typedef {{ id: string, name: string, color: string, score: number }} Team
 * @typedef {{ teams: Team[] }} ScoreboardState
 */

/** @param {number} [count] @returns {ScoreboardState} */
export function createScoreboardState(count = 2) {
  const n = Math.min(Math.max(count, MIN_TEAMS), MAX_TEAMS);
  return {
    teams: Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: '', color: TEAM_COLORS[i], score: 0 })),
  };
}

/** @param {ScoreboardState} s @param {string} id @param {(t: Team) => Team} fn */
function mapTeam(s, id, fn) {
  let changed = false;
  const teams = s.teams.map((t) => {
    if (t.id !== id) return t;
    const next = fn(t);
    if (next !== t) changed = true;
    return next;
  });
  return changed ? { ...s, teams } : s;
}

/** @param {ScoreboardState} s @returns {ScoreboardState} */
export function addTeam(s) {
  if (s.teams.length >= MAX_TEAMS) return s;
  const ids = new Set(s.teams.map((t) => t.id));
  let n = s.teams.length + 1;
  while (ids.has(`t${n}`)) n += 1;
  const used = new Set(s.teams.map((t) => t.color));
  const color = TEAM_COLORS.find((c) => !used.has(c)) ?? TEAM_COLORS[0];
  return { ...s, teams: [...s.teams, { id: `t${n}`, name: '', color, score: 0 }] };
}

/** @param {ScoreboardState} s @param {string} id @returns {ScoreboardState} */
export function removeTeam(s, id) {
  if (s.teams.length <= MIN_TEAMS || !s.teams.some((t) => t.id === id)) return s;
  return { ...s, teams: s.teams.filter((t) => t.id !== id) };
}

/** @param {ScoreboardState} s @param {string} id @param {number} delta @returns {ScoreboardState} */
export function changeScore(s, id, delta) {
  return mapTeam(s, id, (t) => {
    const score = Math.min(Math.max(t.score + delta, MIN_SCORE), MAX_SCORE);
    return score === t.score ? t : { ...t, score };
  });
}

/** @param {ScoreboardState} s @param {string} id @param {string} name @returns {ScoreboardState} */
export function renameTeam(s, id, name) {
  const clean = name.trim().slice(0, MAX_NAME_LENGTH);
  return mapTeam(s, id, (t) => (t.name === clean ? t : { ...t, name: clean }));
}

/** @param {ScoreboardState} s @param {string} id @param {string} color @returns {ScoreboardState} */
export function setTeamColor(s, id, color) {
  if (!TEAM_COLORS.includes(/** @type {any} */ (color))) return s;
  return mapTeam(s, id, (t) => (t.color === color ? t : { ...t, color }));
}

/** @param {ScoreboardState} s @returns {ScoreboardState} */
export function resetScores(s) {
  return s.teams.every((t) => t.score === 0) ? s : { ...s, teams: s.teams.map((t) => ({ ...t, score: 0 })) };
}

/**
 * 최고 점수 팀 ID들 (모두 0점 이하이면 없음)
 * @param {ScoreboardState} s
 * @returns {Set<string>}
 */
export function leaders(s) {
  const max = Math.max(...s.teams.map((t) => t.score));
  if (max <= 0) return new Set();
  return new Set(s.teams.filter((t) => t.score === max).map((t) => t.id));
}
