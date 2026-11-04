/**
 * 마지막 호출 후 wait ms 동안 추가 호출이 없으면 실행한다.
 * flush()로 대기 중인 호출을 즉시 실행할 수 있다 (페이지 종료 직전 저장용).
 *
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} wait
 */
export function debounce(fn, wait) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  /** @type {any[] | null} */
  let pendingArgs = null;

  function run() {
    timer = null;
    const args = pendingArgs;
    pendingArgs = null;
    if (args) fn(...args);
  }

  /** @param {Parameters<F>} args */
  function debounced(...args) {
    pendingArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(run, wait);
  }

  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    run();
  };

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pendingArgs = null;
  };

  return debounced;
}
