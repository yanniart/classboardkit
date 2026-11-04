import { test } from 'node:test';
import assert from 'node:assert/strict';
import text, { nextAlign, stepSize } from '../src/widgets/text/index.js';

test('stepSize moves within s..xl', () => {
  assert.equal(stepSize('m', 1), 'l');
  assert.equal(stepSize('xl', 1), 'xl');
  assert.equal(stepSize('m', -1), 's');
  assert.equal(stepSize('s', -1), 's');
  assert.equal(stepSize('weird', 1), 'l', 'unknown size treated as m');
});

test('nextAlign cycles left → center → right → left', () => {
  assert.equal(nextAlign('left'), 'center');
  assert.equal(nextAlign('center'), 'right');
  assert.equal(nextAlign('right'), 'left');
});

test('default text state', () => {
  assert.deepEqual(text.createState(), { content: '', size: 'm', align: 'center', color: 'default' });
});
