import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SCORE,
  MAX_TEAMS,
  MIN_SCORE,
  TEAM_COLORS,
  addTeam,
  changeScore,
  createScoreboardState,
  leaders,
  removeTeam,
  renameTeam,
  resetScores,
  setTeamColor,
} from '../src/widgets/scoreboard/scoreboard-logic.js';

test('default board has 2 teams with distinct colours and blank names', () => {
  const s = createScoreboardState();
  assert.deepEqual(s.teams.map((t) => [t.id, t.name, t.color, t.score]), [
    ['t1', '', 'red', 0],
    ['t2', '', 'blue', 0],
  ]);
  assert.equal(createScoreboardState(20).teams.length, MAX_TEAMS);
  assert.equal(createScoreboardState(0).teams.length, 2);
});

test('addTeam picks an unused id and colour, up to 8', () => {
  let s = createScoreboardState();
  s = removeTeam(addTeam(s), 't1'); // t2, t3
  s = addTeam(s);
  const ids = s.teams.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(s.teams.map((t) => t.color)).size, s.teams.length);
  while (s.teams.length < MAX_TEAMS) s = addTeam(s);
  assert.equal(addTeam(s), s);
});

test('removeTeam keeps at least 2 teams', () => {
  const s = createScoreboardState();
  assert.equal(removeTeam(s, 't1'), s);
  assert.equal(removeTeam(addTeam(s), 't1').teams.length, 2);
});

test('changeScore clamps and skips no-ops', () => {
  let s = createScoreboardState();
  s = changeScore(s, 't1', 3);
  assert.equal(s.teams[0].score, 3);
  assert.equal(changeScore(s, 't1', 99999).teams[0].score, MAX_SCORE);
  assert.equal(changeScore(s, 't1', -99999).teams[0].score, MIN_SCORE);
  assert.equal(changeScore(s, 'nope', 1), s);
});

test('renameTeam trims and limits; setTeamColor validates', () => {
  let s = renameTeam(createScoreboardState(), 't1', '  호랑이  ');
  assert.equal(s.teams[0].name, '호랑이');
  assert.equal(renameTeam(s, 't1', 'x'.repeat(50)).teams[0].name.length, 30);
  assert.equal(setTeamColor(s, 't1', 'green').teams[0].color, 'green');
  assert.equal(setTeamColor(s, 't1', 'not-a-colour'), s);
  assert.ok(TEAM_COLORS.length >= MAX_TEAMS);
});

test('resetScores and leaders', () => {
  let s = addTeam(createScoreboardState());
  assert.equal(leaders(s).size, 0, 'no leader at 0');
  s = changeScore(changeScore(s, 't1', 2), 't3', 2);
  assert.deepEqual([...leaders(s)].sort(), ['t1', 't3']);
  const reset = resetScores(s);
  assert.ok(reset.teams.every((t) => t.score === 0));
  assert.equal(resetScores(reset), reset);
});
