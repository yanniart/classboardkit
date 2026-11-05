/**
 * QR 라이브러리를 QR 위젯을 쓸 때만 불러온다 (첫 로드 크기 영향 없음, 서비스 워커 precache에는 포함).
 * 벤더링한 v1.4.0은 ES 모듈이 아닌 일반 스크립트(전역 `qrcodegen`)라 <script>로 로드한다 — ADR-0006.
 * (CSP script-src 'self' 범위, 원본 파일은 수정하지 않음)
 */

const SRC = new URL('../../vendor/qrcodegen.js', import.meta.url).href;

/** @type {Promise<any> | null} */
let loading = null;

export function loadQrCodegen() {
  const existing = /** @type {any} */ (globalThis).qrcodegen;
  if (existing) return Promise.resolve(existing);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SRC;
      script.async = true;
      script.onload = () => {
        const lib = /** @type {any} */ (globalThis).qrcodegen;
        if (lib) resolve(lib);
        else reject(new Error('qrcodegen did not load'));
      };
      script.onerror = () => {
        loading = null; // 다음에 다시 시도 (예: 오프라인에서 캐시 없음)
        script.remove();
        reject(new Error('qrcodegen failed to load'));
      };
      document.head.append(script);
    });
  }
  return loading;
}
