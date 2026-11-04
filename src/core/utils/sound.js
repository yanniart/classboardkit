/**
 * Web Audio 합성음. 오디오 파일 없이 동작한다.
 * 브라우저 자동재생 정책 때문에 첫 사용자 제스처에서 unlockAudio()를 호출해야 한다.
 */

/** @type {AudioContext | null} */
let ctx = null;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null; // 미지원 환경: 소리 없이 동작
  }
}

/** 상승 3음 차임 */
export function playChime() {
  if (!ctx) unlockAudio();
  if (!ctx) return;
  const start = ctx.currentTime + 0.02;
  [880, 1108.73, 1318.51].forEach((freq, i) => {
    const t = start + i * 0.22;
    const osc = /** @type {AudioContext} */ (ctx).createOscillator();
    const gain = /** @type {AudioContext} */ (ctx).createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(/** @type {AudioContext} */ (ctx).destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}
