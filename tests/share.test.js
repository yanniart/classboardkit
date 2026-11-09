import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import {
  MAX_SHARE_JSON_BYTES,
  MAX_SHARE_LENGTH,
  QR_SHARE_LENGTH,
  boardHasImages,
  boardHasNames,
  buildSharePayload,
  buildShareUrl,
  decodeShare,
  encodeShare,
  fromBase64Url,
  readShareHash,
  shareLengthStatus,
  toBase64Url,
} from '../src/core/share.js';
import { parseImport } from '../src/core/transfer.js';
import { createBoard } from '../src/core/schema.js';
import * as browserCodec from '../src/ui/share-codec.js';

/** Node zlib로 같은 인터페이스 (M5 계획 3-4) */
const zlibCodec = {
  compress: async (bytes) => new Uint8Array(deflateRawSync(bytes)),
  decompress: async (bytes, maxBytes) => new Uint8Array(inflateRawSync(bytes, { maxOutputLength: maxBytes })),
};

function sampleBoard() {
  const board = createBoard('Class 3-2');
  board.background = { type: 'image', value: 'a_0123456789abcdef' };
  const w = (id, type, state, x = 0.1) => ({ id, type, version: 1, x, y: 0.1, w: 0.3, h: 0.3, z: 1, state });
  board.widgets = [
    w('w_r', 'randomizer', { items: ['Kim', 'Lee'], excludePicked: true, picked: ['Kim'], history: ['Kim'] }),
    w('w_g', 'groups', { items: ['Kim', 'Lee', 'Park'], by: 'count', n: 2, result: [['Kim'], ['Lee', 'Park']] }, 0.4),
    w('w_i', 'image', { assetId: 'a_0123456789abcdef', fit: 'contain', caption: 'map' }, 0.6),
    w('w_t', 'text', { content: '안녕하세요 👋', size: 'm', align: 'center', color: 'default' }, 0.2),
  ];
  return board;
}

test('buildSharePayload: images always removed, names removed by default', () => {
  const board = sampleBoard();
  assert.ok(boardHasImages(board));
  assert.ok(boardHasNames(board));
  const data = buildSharePayload(board);
  const [b] = data.boards;
  assert.equal(data.app, 'classboardkit');
  assert.deepEqual(b.background, { type: 'gradient', value: 'default' });
  const byType = Object.fromEntries(b.widgets.map((w) => [w.type, w.state]));
  assert.equal(byType.image.assetId, null);
  assert.equal(byType.image.caption, 'map');
  assert.deepEqual([byType.randomizer.items, byType.randomizer.picked, byType.randomizer.history], [[], [], []]);
  assert.equal(byType.randomizer.excludePicked, true);
  assert.deepEqual([byType.groups.items, byType.groups.result, byType.groups.n], [[], [], 2]);
  assert.equal(byType.text.content, '안녕하세요 👋');
  assert.ok(!boardHasImages(b));
  assert.ok(!boardHasNames(b));
  // 원본은 그대로
  assert.equal(board.widgets[0].state.items.length, 2);
});

test('buildSharePayload: excludeNames=false keeps name lists', () => {
  const [b] = buildSharePayload(sampleBoard(), { excludeNames: false }).boards;
  assert.deepEqual(b.widgets[0].state.items, ['Kim', 'Lee']);
  assert.deepEqual(b.widgets[1].state.result, [['Kim'], ['Lee', 'Park']]);
});

test('base64url round trip, rejects invalid characters', () => {
  for (const len of [0, 1, 2, 3, 4, 5, 255, 1000]) {
    const bytes = new Uint8Array(len).map((_, i) => (i * 37 + 11) % 256);
    const text = toBase64Url(bytes);
    assert.match(text, /^[A-Za-z0-9_-]*$/);
    assert.deepEqual(fromBase64Url(text), bytes);
  }
  assert.equal(fromBase64Url('abc+'), null);
  assert.equal(fromBase64Url('ab/c'), null);
  assert.equal(fromBase64Url('abcde'), null); // 길이 % 4 === 1
});

for (const [name, codec] of [
  ['zlib', zlibCodec],
  ['CompressionStream', browserCodec],
]) {
  test(`encode → decode → parseImport round trip (${name})`, async () => {
    const payload = buildSharePayload(sampleBoard());
    const encoded = await encodeShare(payload, codec.compress);
    assert.match(encoded, /^1\.[A-Za-z0-9_-]+$/);
    const decoded = await decodeShare(encoded, codec.decompress);
    assert.equal(decoded.ok, true);
    const result = parseImport(decoded.text);
    assert.equal(result.ok, true);
    const [b] = result.boards;
    assert.notEqual(b.id, payload.boards[0].id); // 새 ID
    assert.equal(b.name, 'Class 3-2');
    assert.deepEqual(
      b.widgets.map((w) => [w.type, w.x]),
      payload.boards[0].widgets.map((w) => [w.type, w.x]),
    );
    assert.equal(result.assets.length, 0);
  });

  test(`decodeShare rejects truncated/tampered links (${name})`, async () => {
    const encoded = await encodeShare(buildSharePayload(sampleBoard()), codec.compress);
    const truncated = await decodeShare(encoded.slice(0, Math.floor(encoded.length / 2)), codec.decompress);
    // 잘린 deflate는 압축 해제 실패이거나, 운 좋게 풀려도 JSON이 아니어서 parseImport가 거부
    assert.ok(!truncated.ok || !parseImport(truncated.text).ok);
    const tampered = `${encoded.slice(0, 10)}${encoded[10] === 'A' ? 'B' : 'A'}${encoded.slice(11)}`;
    const t = await decodeShare(tampered, codec.decompress);
    assert.ok(!t.ok || !parseImport(t.text).ok);
  });

  test(`decodeShare rejects decompression bombs over 1MB (${name})`, async () => {
    const bomb = await codec.compress(new Uint8Array(MAX_SHARE_JSON_BYTES + 10).fill(32));
    const encoded = `1.${toBase64Url(bomb)}`;
    assert.ok(encoded.length < 3000, 'bomb link is small');
    const r = await decodeShare(encoded, codec.decompress);
    assert.equal(r.ok, false);
  });
}

test('decodeShare: prefix, version, charset and length checks', async () => {
  const d = zlibCodec.decompress;
  assert.equal((await decodeShare('', d)).error, 'invalid');
  assert.equal((await decodeShare('abc', d)).error, 'invalid');
  assert.equal((await decodeShare('2.abcd', d)).error, 'newer-version');
  assert.equal((await decodeShare('0.abcd', d)).error, 'invalid');
  assert.equal((await decodeShare('1.ab$d', d)).error, 'invalid');
  assert.equal((await decodeShare(`1.${'A'.repeat(MAX_SHARE_LENGTH)}`, d)).error, 'too-large');
});

test('decodeShare: non-JSON content is caught by parseImport', async () => {
  const encoded = `1.${toBase64Url(new Uint8Array(deflateRawSync(Buffer.from('hello'))))}`;
  const r = await decodeShare(encoded, zlibCodec.decompress);
  assert.equal(r.ok, true);
  assert.equal(parseImport(r.text).error, 'not-json');
});

test('share URL helpers', () => {
  assert.equal(buildShareUrl('https://x.io/app/#old', '1.abc'), 'https://x.io/app/#share=1.abc');
  assert.equal(readShareHash('#share=1.abc'), '1.abc');
  assert.equal(readShareHash('#other'), null);
  assert.equal(readShareHash(''), null);
  assert.deepEqual(shareLengthStatus('x'.repeat(QR_SHARE_LENGTH)), { length: QR_SHARE_LENGTH, tooLong: false, qr: true });
  assert.deepEqual(shareLengthStatus('x'.repeat(MAX_SHARE_LENGTH + 1)).tooLong, true);
});

test('typical template-sized board produces a short link (QR-able)', async () => {
  const board = createBoard('Lesson');
  board.widgets = Array.from({ length: 5 }, (_, i) => ({
    id: `w_${i}`, type: 'timer', version: 1, x: 0.1 * i, y: 0.1, w: 0.2, h: 0.3, z: i + 1,
    state: { durationMs: 300000, mode: 'digital', status: 'idle', sound: true },
  }));
  const url = buildShareUrl('https://yanniart.github.io/classboardkit/', await encodeShare(buildSharePayload(board), zlibCodec.compress));
  assert.ok(shareLengthStatus(url).qr, `${url.length} chars`);
});
