/**
 * localStorage와 같은 인터페이스의 메모리 저장소.
 * - 브라우저 저장소를 쓸 수 없을 때(사생활 보호 모드, 차단 등)의 대체
 * - Node 테스트용 가짜 저장소
 *
 * @param {{ quotaBytes?: number }} [options] quotaBytes 지정 시 초과하면 QuotaExceededError 발생
 */
export function createMemoryStorage({ quotaBytes = Infinity } = {}) {
  /** @type {Map<string, string>} */
  const map = new Map();

  const usedBytes = () => {
    let total = 0;
    for (const [k, v] of map) total += (k.length + v.length) * 2; // UTF-16 기준 근사치
    return total;
  };

  return {
    get length() {
      return map.size;
    },
    /** @param {number} index */
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    /** @param {string} key */
    getItem(key) {
      return map.has(key) ? /** @type {string} */ (map.get(key)) : null;
    },
    /** @param {string} key @param {string} value */
    setItem(key, value) {
      const str = String(value);
      const prev = map.get(key);
      map.set(key, str);
      if (usedBytes() > quotaBytes) {
        if (prev === undefined) map.delete(key);
        else map.set(key, prev);
        const error = new Error('Storage quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      }
    },
    /** @param {string} key */
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}
