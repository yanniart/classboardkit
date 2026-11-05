import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  MAX_TEXT_LENGTH,
  QUIET_ZONE,
  createQrState,
  displayCaption,
  encode,
  qrPath,
} from '../src/widgets/qr/qr-logic.js';

const VENDOR = new URL('../src/vendor/qrcodegen.js', import.meta.url);
const source = readFileSync(VENDOR);
/** 브라우저처럼 일반 스크립트로 실행 → 전역 qrcodegen */
const sandbox = {};
runInNewContext(source.toString('utf8'), sandbox);
const { qrcodegen } = /** @type {any} */ (sandbox);

test('vendored library is the pinned, unmodified v1.4.0 (ADR-0006)', () => {
  const sha = createHash('sha256').update(source).digest('hex');
  assert.equal(sha, 'ab26696516e396e0de674612e5a0869b92b2d0b8baddf000594705e49c721bfa');
  assert.equal(typeof qrcodegen.QrCode.encodeText, 'function');
});

test('known vectors: version (size) by content and ECC', () => {
  // "Hello, world!" 13바이트: 1-M 용량 14바이트 → 버전 1 (21×21)
  const hello = encode(qrcodegen, 'Hello, world!', 'M');
  assert.equal(hello.ok, true);
  assert.equal(hello.qr.size, 21);
  assert.equal(hello.qr.version, 1);
  // 15바이트는 1-M을 넘어 버전 2 (25×25)
  assert.equal(encode(qrcodegen, 'x'.repeat(15), 'M').qr.size, 25);
  // 숫자 모드: 1-M에 숫자 34자리까지
  assert.equal(encode(qrcodegen, '1'.repeat(34), 'M').qr.size, 21);
  // 최대 길이 URL(500자)도 생성
  const long = encode(qrcodegen, `https://example.com/${'a'.repeat(MAX_TEXT_LENGTH - 20)}`, 'M');
  assert.equal(long.ok, true);
  assert.ok(long.qr.size > 60 && long.qr.size <= 177);
});

test('finder patterns present (corners)', () => {
  const { qr } = encode(qrcodegen, 'https://yanniart.github.io/classboardkit/', 'M');
  const n = qr.size;
  for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    for (let i = 0; i < 7; i += 1) {
      assert.equal(qr.getModule(ox + i, oy), true);
      assert.equal(qr.getModule(ox + i, oy + 6), true);
    }
    assert.equal(qr.getModule(ox + 1, oy + 1), false);
    assert.equal(qr.getModule(ox + 3, oy + 3), true);
  }
});

test('empty and too-long input', () => {
  assert.deepEqual(encode(qrcodegen, '   ', 'M'), { ok: false, error: 'empty' });
  assert.deepEqual(encode(qrcodegen, 'x'.repeat(MAX_TEXT_LENGTH + 1), 'M'), { ok: false, error: 'too-long' });
  // 라이브러리 용량 초과도 too-long (가짜 라이브러리로 확인)
  const throwing = { QrCode: { Ecc: { MEDIUM: 1 }, encodeText: () => { throw 'Data too long'; } } };
  assert.deepEqual(encode(throwing, 'abc', 'M'), { ok: false, error: 'too-long' });
});

test('qrPath covers exactly the dark modules, offset by the quiet zone', () => {
  const { qr } = encode(qrcodegen, 'ClassBoardKit', 'M');
  const d = qrPath(qr);
  let dark = 0;
  for (let y = 0; y < qr.size; y += 1) for (let x = 0; x < qr.size; x += 1) if (qr.getModule(x, y)) dark += 1;
  let covered = 0;
  for (const m of d.matchAll(/M(\d+),(\d+)h(\d+)v1h-\3z/g)) {
    const [x, y, run] = [Number(m[1]), Number(m[2]), Number(m[3])];
    assert.ok(x >= QUIET_ZONE && y >= QUIET_ZONE);
    for (let i = 0; i < run; i += 1) assert.equal(qr.getModule(x - QUIET_ZONE + i, y - QUIET_ZONE), true);
    covered += run;
  }
  assert.equal(covered, dark);
  assert.equal(d.replace(/M\d+,\d+h\d+v1h-\d+z/g, ''), '', 'only run rectangles');
});

test('caption falls back to a short link', () => {
  const s = createQrState();
  assert.deepEqual(s, { text: '', caption: '', ecc: 'M' });
  assert.equal(displayCaption({ ...s, text: 'https://example.com/' }), 'example.com');
  assert.equal(displayCaption({ ...s, text: 'https://example.com/x', caption: ' 설문 ' }), '설문');
  const long = displayCaption({ ...s, text: `http://${'a'.repeat(80)}` });
  assert.equal(long.length, 40);
  assert.ok(long.endsWith('…'));
});
