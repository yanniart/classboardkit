/**
 * 보드 배경 프리셋 (F-006).
 * - type 'gradient': value = 프리셋 키
 * - type 'color':    value = 색상 코드 (프리셋 또는 사용자 지정)
 * - tone: 배경 위 빈 상태 문구 등의 글자색 판단용 ('light' 배경 → 어두운 글자)
 *
 * 'default'는 CSS 토큰(--color-board)을 따라 테마에 맞게 바뀐다.
 *
 * @typedef {{ key: string, type: 'gradient' | 'color', value: string, css: string | null, tone: 'light' | 'dark' | 'theme' }} BackgroundPreset
 */

/** @type {BackgroundPreset[]} */
export const BACKGROUND_PRESETS = [
  { key: 'default', type: 'gradient', value: 'default', css: null, tone: 'theme' },
  { key: 'sky', type: 'gradient', value: 'sky', css: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', tone: 'light' },
  { key: 'mint', type: 'gradient', value: 'mint', css: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)', tone: 'light' },
  { key: 'peach', type: 'gradient', value: 'peach', css: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', tone: 'light' },
  { key: 'lavender', type: 'gradient', value: 'lavender', css: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', tone: 'light' },
  { key: 'sunset', type: 'gradient', value: 'sunset', css: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', tone: 'light' },
  { key: 'ocean', type: 'gradient', value: 'ocean', css: 'linear-gradient(135deg, #1e6f96 0%, #4fb3d6 100%)', tone: 'dark' },
  { key: 'forest', type: 'gradient', value: 'forest', css: 'linear-gradient(135deg, #134e5e 0%, #4f8f5f 100%)', tone: 'dark' },
  { key: 'night', type: 'gradient', value: 'night', css: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', tone: 'dark' },
  { key: 'paper', type: 'color', value: '#f7f3e9', css: '#f7f3e9', tone: 'light' },
  { key: 'chalk', type: 'color', value: '#2f4f3a', css: '#2f4f3a', tone: 'dark' },
  { key: 'slate', type: 'color', value: '#3b4252', css: '#3b4252', tone: 'dark' },
];

const HEX = /^#[0-9a-f]{6}$/i;

/** 기본 프리셋 */
export const DEFAULT_BACKGROUND = BACKGROUND_PRESETS[0];

/**
 * 보드 배경 값을 화면 표시용으로 해석한다. 알 수 없는 값은 기본 배경으로.
 * @param {{ type: string, value: string }} background
 * @returns {{ css: string | null, tone: 'light' | 'dark' | 'theme', preset: BackgroundPreset | null }}
 */
export function resolveBackground(background) {
  const preset = BACKGROUND_PRESETS.find(
    (p) => p.type === background?.type && p.value === background?.value,
  );
  if (preset) return { css: preset.css, tone: preset.tone, preset };
  if (background?.type === 'color' && HEX.test(background.value)) {
    return { css: background.value, tone: hexTone(background.value), preset: null };
  }
  return { css: DEFAULT_BACKGROUND.css, tone: DEFAULT_BACKGROUND.tone, preset: DEFAULT_BACKGROUND };
}

/**
 * 상대 휘도로 밝은/어두운 배경을 판정한다 (WCAG 공식).
 * @param {string} hex '#rrggbb'
 */
export function hexTone(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? 'light' : 'dark';
}
