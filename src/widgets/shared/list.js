/** 명단(이름 목록) 공통 규칙 — 랜덤 뽑기·모둠 편성이 함께 사용 */

export const MAX_ITEMS = 200;
export const MAX_ITEM_LENGTH = 60;

/**
 * 한 줄에 하나(쉼표·탭 구분도 허용). 앞뒤 공백 제거, 빈 줄·중복 제거, 길이·개수 제한.
 * @param {string} text
 * @returns {string[]}
 */
export function parseItems(text) {
  const seen = new Set();
  const out = [];
  for (const raw of text.split(/[\n,\t]/)) {
    const item = raw.trim().slice(0, MAX_ITEM_LENGTH);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
