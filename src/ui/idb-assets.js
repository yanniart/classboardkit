/**
 * 브라우저용 이미지 저장소: IndexedDB 백엔드 + 이미지 준비(축소·재인코딩) + object URL 캐시 (ADR-0007).
 */
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  MAX_SOURCE_BYTES,
  createAssetStore,
  fitWithin,
  toneFromLuminance,
} from '../core/assets.js';

const DB_NAME = 'classboardkit';
const DB_VERSION = 1;
const STORE = 'assets';

/**
 * @template T
 * @param {IDBRequest<T>} req
 * @returns {Promise<T>}
 */
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** @returns {Promise<IDBDatabase>} */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

/**
 * @param {IDBDatabase} db
 * @returns {import('../core/assets.js').AssetBackend}
 */
function idbBackend(db) {
  /** @param {IDBTransactionMode} mode */
  const store = (mode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    get: (id) => request(store('readonly').get(id)),
    put: async (record) => {
      await request(store('readwrite').put(record));
    },
    delete: async (id) => {
      await request(store('readwrite').delete(id));
    },
    list: async () => {
      /** @type {import('../core/assets.js').AssetRecord[]} */
      const all = await request(store('readonly').getAll());
      return all.map(({ id, createdAt }) => ({ id, createdAt }));
    },
  };
}

/** @type {Promise<import('../core/assets.js').AssetStore | null> | null} */
let storePromise = null;

/**
 * 이미지 저장소. IndexedDB를 쓸 수 없으면 null (이미지 기능만 비활성)
 */
export function getAssetStore() {
  if (!storePromise) {
    storePromise = (async () => {
      try {
        if (typeof indexedDB === 'undefined') return null;
        return createAssetStore(idbBackend(await openDb()));
      } catch (error) {
        console.info('[assets] IndexedDB unavailable', error);
        return null;
      }
    })();
  }
  return storePromise;
}

/** @type {Map<string, Promise<{ url: string, record: import('../core/assets.js').AssetRecord } | null>>} */
const urlCache = new Map();

/**
 * 이미지 표시용 object URL (세션 동안 캐시, 같은 이미지를 여러 곳에서 써도 하나)
 * @param {string} id
 */
export function getAssetUrl(id) {
  let entry = urlCache.get(id);
  if (!entry) {
    entry = (async () => {
      const store = await getAssetStore();
      const record = store ? await store.get(id) : null;
      return record ? { url: URL.createObjectURL(record.blob), record } : null;
    })();
    urlCache.set(id, entry);
    // 없는 이미지는 캐시하지 않음 (나중에 가져오기로 생길 수 있음)
    entry.then((r) => {
      if (!r) urlCache.delete(id);
    });
  }
  return entry;
}

/** @param {string} id */
export function releaseAssetUrl(id) {
  const entry = urlCache.get(id);
  if (!entry) return;
  urlCache.delete(id);
  entry.then((r) => r && URL.revokeObjectURL(r.url));
}

/**
 * 이미지 파일 준비 오류
 * @typedef {'unsupported' | 'type' | 'too-large' | 'decode'} PrepareError
 */
export class ImagePrepareError extends Error {
  /** @param {PrepareError} code */
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/**
 * @param {number} w @param {number} h
 * @returns {HTMLCanvasElement}
 */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * @param {HTMLCanvasElement} canvas @param {string} type @param {number} quality
 * @returns {Promise<Blob | null>}
 */
const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * 평균 밝기 → tone (배경 위 빈 상태 문구 색 판단)
 * @param {ImageBitmap} bitmap
 */
function measureTone(bitmap) {
  const c = makeCanvas(16, 16);
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return 'light';
  g.drawImage(bitmap, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  return toneFromLuminance(sum / (d.length / 4));
}

/**
 * 파일 → 저장할 이미지. 이미 작으면 원본 그대로(GIF 움직임 유지), 크면 긴 변 2048px로 줄여 WebP(미지원 시 JPEG) 0.85
 * @param {File | Blob} file
 * @returns {Promise<{ blob: Blob, width: number, height: number, tone: 'light' | 'dark' }>}
 */
export async function prepareImage(file) {
  if (typeof createImageBitmap !== 'function') throw new ImagePrepareError('unsupported');
  if (!IMAGE_TYPES.includes(/** @type {any} */ (file.type))) throw new ImagePrepareError('type');
  if (file.size > MAX_SOURCE_BYTES) throw new ImagePrepareError('too-large');
  /** @type {ImageBitmap} */
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImagePrepareError('decode');
  }
  try {
    const tone = measureTone(bitmap);
    const { width: w0, height: h0 } = bitmap;
    if (Math.max(w0, h0) <= MAX_IMAGE_EDGE && file.size <= MAX_IMAGE_BYTES) {
      return { blob: file, width: w0, height: h0, tone };
    }
    let edge = MAX_IMAGE_EDGE;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { width, height } = fitWithin(w0, h0, edge);
      const canvas = makeCanvas(width, height);
      const g = canvas.getContext('2d');
      if (!g) throw new ImagePrepareError('unsupported');
      g.drawImage(bitmap, 0, 0, width, height);
      let blob = await toBlob(canvas, 'image/webp', 0.85);
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85);
      if (!blob) throw new ImagePrepareError('decode');
      if (blob.size <= MAX_IMAGE_BYTES || attempt === 3) return { blob, width, height, tone };
      edge = Math.round(edge * 0.7);
    }
    throw new ImagePrepareError('too-large');
  } finally {
    bitmap.close();
  }
}

/**
 * 파일을 준비해 저장하고 ID를 돌려준다
 * @param {File | Blob} file
 */
export async function storeImageFile(file) {
  const store = await getAssetStore();
  if (!store) throw new ImagePrepareError('unsupported');
  const prepared = await prepareImage(file);
  return store.put(prepared.blob, prepared);
}
