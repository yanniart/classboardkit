import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GC_GRACE_MS,
  assetIdFor,
  createAssetStore,
  createMemoryBackend,
  fitWithin,
  isAssetId,
  referencedAssetIds,
  toneFromLuminance,
} from '../src/core/assets.js';
import { resolveBackground } from '../src/core/backgrounds.js';

const blob = (text, type = 'image/png') => new Blob([text], { type });

test('asset id is a content hash: same bytes → same id', async () => {
  const a = await assetIdFor(new TextEncoder().encode('hello'));
  const b = await assetIdFor(new TextEncoder().encode('hello'));
  const c = await assetIdFor(new TextEncoder().encode('hello!'));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(isAssetId(a), a);
  // SHA-256("hello") = 2cf24dba5fb0a30e...
  assert.equal(a, 'a_2cf24dba5fb0a30e');
  assert.equal(isAssetId('a_XYZ'), false);
  assert.equal(isAssetId(null), false);
});

test('put stores once per content and get returns the record', async () => {
  const store = createAssetStore(createMemoryBackend());
  const id1 = await store.put(blob('img-1'), { width: 10, height: 20 });
  const id2 = await store.put(blob('img-1'), { width: 10, height: 20, tone: 'dark' });
  assert.equal(id1, id2);
  assert.deepEqual(await store.listIds(), [id1]);
  const rec = await store.get(id1);
  assert.equal(rec.width, 10);
  assert.equal(rec.type, 'image/png');
  assert.equal(rec.tone, 'dark', 'tone backfilled on duplicate put');
  assert.equal(await rec.blob.text(), 'img-1');
  assert.equal(await store.get('a_0000000000000000'), null);
  assert.equal(await store.get('../etc'), null);
});

test('referencedAssetIds collects widget assetId and image backgrounds only', () => {
  const boards = [
    {
      background: { type: 'image', value: 'a_1111111111111111' },
      widgets: [
        { state: { assetId: 'a_2222222222222222' } },
        { state: { assetId: null } },
        { state: { text: 'a_3333333333333333' } },
        { state: { assetId: 'not-an-id' } },
      ],
    },
    { background: { type: 'color', value: '#ffffff' }, widgets: [{ state: { assetId: 'a_2222222222222222' } }] },
  ];
  assert.deepEqual([...referencedAssetIds(boards)].sort(), ['a_1111111111111111', 'a_2222222222222222']);
  assert.equal(referencedAssetIds([]).size, 0);
});

test('collectGarbage removes unreferenced old assets but keeps recent ones', async () => {
  const store = createAssetStore(createMemoryBackend());
  const old = new Date('2026-11-01T00:00:00Z');
  const now = new Date('2026-11-05T00:00:00Z');
  const keep = await store.put(blob('keep'), { width: 1, height: 1 }, old);
  const drop = await store.put(blob('drop'), { width: 1, height: 1 }, old);
  const fresh = await store.put(blob('fresh'), { width: 1, height: 1 }, new Date(now.getTime() - GC_GRACE_MS + 1000));
  const removed = await store.collectGarbage(new Set([keep]), now);
  assert.deepEqual(removed, [drop]);
  assert.deepEqual((await store.listIds()).sort(), [keep, fresh].sort());
});

test('fitWithin scales the long edge down, never up', () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: 2048, height: 1536 });
  assert.deepEqual(fitWithin(1000, 5000, 2048), { width: 410, height: 2048 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  assert.equal(toneFromLuminance(0.9), 'light');
  assert.equal(toneFromLuminance(0.2), 'dark');
});

test('image backgrounds resolve to an image id; invalid ids fall back', () => {
  const r = resolveBackground({ type: 'image', value: 'a_1234567890abcdef' });
  assert.equal(r.imageId, 'a_1234567890abcdef');
  assert.equal(r.css, null);
  const bad = resolveBackground({ type: 'image', value: 'https://example.com/x.png' });
  assert.equal(bad.imageId, undefined);
  assert.equal(bad.preset?.key, 'default');
});
