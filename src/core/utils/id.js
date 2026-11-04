const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * 짧은 무작위 ID 생성 (예: "b_k3x9a2q1").
 * crypto.getRandomValues 기반이라 Math.random보다 충돌·편향이 적다.
 *
 * @param {string} prefix 'b'(보드), 'w'(위젯) 등
 * @param {number} [length=8]
 */
export function createId(prefix, length = 8) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let body = '';
  // 256 % 36 편향은 ID 용도에서 무시 가능
  for (const byte of bytes) body += ALPHABET[byte % ALPHABET.length];
  return `${prefix}_${body}`;
}
