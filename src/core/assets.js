/**
 * 이미지 저장소 (ADR-0007). 바이너리는 IndexedDB, 보드 데이터에는 ID 문자열만 둔다.
 * 저장 백엔드는 주입형 → Node 테스트는 메모리 백엔드, 브라우저는 ui/idb-assets.js.
 *
 * 참조 규칙 (코어가 위젯 내부를 몰라도 되도록):
 *  - 이미지를 쓰는 위젯은 state.assetId (문자열) 한 필드만 사용
 *  - 보드 배경은 background = { type: 'image', value: assetId }
 *
 * @typedef {{
 *   id: string,
 *   type: string,
 *   blob: Blob,
 *   width: number,
 *   height: number,
 *   tone?: 'light' | 'dark',
 *   createdAt: string,
 * }} AssetRecord
 *
 * @typedef {{
 *   get: (id: string) => Promise<AssetRecord | undefined>,
 *   put: (record: AssetRecord) => Promise<void>,
 *   delete: (id: string) => Promise<void>,
 *   list: () => Promise<{ id: string, createdAt: string }[]>,
 * }} AssetBackend
 */

export const ASSET_ID_RE = /^a_[0-9a-f]{16}$/;
/** 허용 형식 (SVG는 스크립트를 품을 수 있어 제외) */
export const IMAGE_TYPES = /** @type {const} */ (['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
/** 긴 변 최대 px */
export const MAX_IMAGE_EDGE = 2048;
/** 준비된 이미지 최대 크기 (넘으면 한 단계 더 축소) */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** 원본 파일 최대 크기 (디코딩 전 거부) */
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
/** GC가 건드리지 않는 최근 이미지 (다른 탭에서 방금 추가했을 수 있음) */
export const GC_GRACE_MS = 10 * 60 * 1000;

/** @param {unknown} id */
export const isAssetId = (id) => typeof id === 'string' && ASSET_ID_RE.test(id);

/**
 * 내용 해시 ID: 'a_' + SHA-256 앞 16자 (16진수). 같은 이미지는 같은 ID → 한 번만 저장
 * @param {ArrayBuffer | Uint8Array} bytes
 */
export async function assetIdFor(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `a_${hex}`;
}

/**
 * 보드들이 참조하는 이미지 ID
 * @param {readonly any[]} boards
 * @returns {Set<string>}
 */
export function referencedAssetIds(boards) {
  const ids = new Set();
  for (const board of boards ?? []) {
    if (board?.background?.type === 'image' && isAssetId(board.background.value)) ids.add(board.background.value);
    for (const w of board?.widgets ?? []) {
      const id = w?.state?.assetId;
      if (isAssetId(id)) ids.add(id);
    }
  }
  return ids;
}

/**
 * 긴 변을 maxEdge 이하로 줄인 크기 (확대하지 않음)
 * @param {number} width @param {number} height @param {number} [maxEdge]
 */
export function fitWithin(width, height, maxEdge = MAX_IMAGE_EDGE) {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const k = maxEdge / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/**
 * 평균 밝기(0~1)로 배경 위 글자색 판정
 * @param {number} luminance
 * @returns {'light' | 'dark'}
 */
export function toneFromLuminance(luminance) {
  return luminance > 0.55 ? 'light' : 'dark';
}

/**
 * @param {AssetBackend} backend
 */
export function createAssetStore(backend) {
  return {
    /**
     * 이미지 저장. 같은 내용이 이미 있으면 그대로 두고 같은 ID 반환
     * @param {Blob} blob
     * @param {{ width: number, height: number, tone?: 'light' | 'dark' }} meta
     * @param {Date} [now]
     */
    async put(blob, meta, now = new Date()) {
      const id = await assetIdFor(await blob.arrayBuffer());
      const existing = await backend.get(id);
      if (existing) {
        // 기존 레코드에 없던 밝기 정보만 보충
        if (meta.tone && !existing.tone) await backend.put({ ...existing, tone: meta.tone });
        return id;
      }
      await backend.put({
        id,
        type: blob.type,
        blob,
        width: meta.width,
        height: meta.height,
        ...(meta.tone ? { tone: meta.tone } : {}),
        createdAt: now.toISOString(),
      });
      return id;
    },
    /** @param {string} id @returns {Promise<AssetRecord | null>} */
    async get(id) {
      if (!isAssetId(id)) return null;
      return (await backend.get(id)) ?? null;
    },
    /** @param {string} id */
    delete: (id) => backend.delete(id),
    async listIds() {
      return (await backend.list()).map((r) => r.id);
    },
    /**
     * 참조되지 않는 이미지 삭제. 최근 GC_GRACE_MS 안에 만든 것은 보존
     * @param {Set<string>} referenced
     * @param {Date} [now]
     * @returns {Promise<string[]>} 삭제한 ID
     */
    async collectGarbage(referenced, now = new Date()) {
      const removed = [];
      for (const { id, createdAt } of await backend.list()) {
        if (referenced.has(id)) continue;
        const age = now.getTime() - Date.parse(createdAt);
        if (Number.isFinite(age) && age < GC_GRACE_MS) continue;
        await backend.delete(id);
        removed.push(id);
      }
      return removed;
    },
  };
}

/** 테스트·IndexedDB 불가 환경용 메모리 백엔드 @returns {AssetBackend} */
export function createMemoryBackend() {
  /** @type {Map<string, AssetRecord>} */
  const map = new Map();
  return {
    get: async (id) => map.get(id),
    put: async (r) => {
      map.set(r.id, r);
    },
    delete: async (id) => {
      map.delete(id);
    },
    list: async () => [...map.values()].map(({ id, createdAt }) => ({ id, createdAt })),
  };
}

/** @typedef {ReturnType<typeof createAssetStore>} AssetStore */
