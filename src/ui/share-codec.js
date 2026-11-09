/**
 * 브라우저 내장 압축(CompressionStream 'deflate-raw')으로 core/share.js의 압축 인터페이스 구현 (ADR-0008).
 */

const FORMAT = 'deflate-raw';

/** 'deflate-raw'까지 지원하는지 (구형 브라우저는 생성자에서 예외) */
export function isShareSupported() {
  try {
    new CompressionStream(FORMAT);
    new DecompressionStream(FORMAT);
    return true;
  } catch {
    return false;
  }
}

/** @param {Uint8Array} bytes */
export async function compress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(FORMAT));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * 스트림으로 읽으며 maxBytes를 넘으면 즉시 중단한다 (압축 폭탄 방어)
 * @param {Uint8Array} bytes
 * @param {number} maxBytes
 */
export async function decompress(bytes, maxBytes) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(FORMAT)).getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(`decompressed size exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
