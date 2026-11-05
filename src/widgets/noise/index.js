import { h } from '../../ui/dom.js';
import { button, createSettingsPanel, field, segmented, svg } from '../shared/ui.js';
import {
  clampThreshold,
  createNoiseState,
  levelFromRms,
  micErrorKind,
  mood,
  rms,
  smooth,
  updateAlarm,
} from './noise-logic.js';

/** 얼굴 입 모양 (표정 3단계) */
const MOUTHS = {
  calm: 'M35 64 Q50 76 65 64',
  ok: 'M36 68 L64 68',
  loud: 'M36 72 Q50 58 64 72',
};

/** @type {import('../../core/registry.js').WidgetDefinition} */
export default {
  type: 'noise',
  version: 1,
  icon: 'mic',
  titleKey: 'widget.noise.title',
  defaultSize: { w: 0.24, h: 0.46 },
  minSize: { w: 0.12, h: 0.22 },
  styleUrl: new URL('./noise.css', import.meta.url).href,
  createState: createNoiseState,

  mount(container, ctx) {
    const { t } = ctx;
    /** @type {import('./noise-logic.js').NoiseState} */
    let state = ctx.state;
    /** 측정 중 자원 — 소리 데이터는 이 함수 밖으로 나가지 않는다 */
    /** @type {{ stream: MediaStream, audio: AudioContext, analyser: AnalyserNode, buffer: Float32Array, raf: number } | null} */
    let session = null;
    let level = 0;
    /** @type {import('./noise-logic.js').AlarmState} */
    let alarm = { overSince: null, alarm: false };
    let starting = false;

    // ── 측정 전 / 오류 화면 ──
    const startButton = button({ variant: 'primary', iconName: 'mic', text: t('widget.noise.start'), onClick: start });
    const idleText = h('p', { className: 'noise__idle-text' });
    const privacy = h('p', { className: 'noise__privacy', text: t('widget.noise.privacy') });
    const idle = h('div', { className: 'w-empty noise__idle' }, [idleText, startButton, privacy]);

    // ── 측정 화면 ──
    const fill = h('div', { className: 'noise__fill' });
    const line = h('div', { className: 'noise__line' });
    const meter = h('div', { className: 'noise__meter', attrs: { 'aria-hidden': 'true' } }, [fill, line]);
    const mouth = svg('path', { d: MOUTHS.calm, fill: 'none', stroke: 'currentColor', 'stroke-width': 6, 'stroke-linecap': 'round' });
    const face = svg('svg', { class: 'noise__face', viewBox: '0 0 100 100', 'aria-hidden': 'true' }, [
      svg('circle', { cx: 50, cy: 50, r: 44, fill: 'var(--face)', stroke: 'currentColor', 'stroke-width': 5 }),
      svg('circle', { cx: 36, cy: 40, r: 5, fill: 'currentColor' }),
      svg('circle', { cx: 64, cy: 40, r: 5, fill: 'currentColor' }),
      mouth,
    ]);
    const warning = h('p', { className: 'noise__warning', attrs: { role: 'status' } });
    const stopButton = button({ iconName: 'pause', label: t('widget.noise.stop'), className: 'noise__stop', onClick: stop });
    const live = h('div', { className: 'noise__live' }, [meter, face, warning, stopButton]);

    const root = h('div', { className: 'noise' }, [idle, live]);
    container.append(root);

    /** @param {string | null} messageKey 측정 전 안내 (null이면 기본) */
    function showIdle(messageKey) {
      root.dataset.mode = 'idle';
      root.classList.remove('is-alarm');
      idle.hidden = false;
      live.hidden = true;
      idleText.textContent = t(messageKey ?? 'widget.noise.intro');
      idleText.classList.toggle('is-error', messageKey !== null && messageKey !== 'widget.noise.paused');
      startButton.querySelector('.w-btn__text').textContent = t(
        messageKey === 'widget.noise.paused' ? 'widget.noise.restart' : 'widget.noise.start',
      );
    }

    function paintLive() {
      root.dataset.mode = 'live';
      root.dataset.style = state.style;
      idle.hidden = true;
      live.hidden = false;
      fill.style.height = `${level}%`;
      line.style.bottom = `${state.threshold}%`;
      const m = mood(level, state.threshold);
      face.dataset.mood = m;
      mouth.setAttribute('d', MOUTHS[m]);
      root.classList.toggle('is-alarm', alarm.alarm);
      warning.textContent = alarm.alarm ? t('widget.noise.warning') : '';
      root.style.setProperty('--level', String(level));
    }

    async function start() {
      if (session || starting) return;
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        showIdle('widget.noise.error.insecure');
        return;
      }
      starting = true;
      /** @type {MediaStream | null} */
      let stream = null;
      try {
        // 측정값 왜곡을 막기 위해 음성 처리 끔
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        if (!root.isConnected) {
          // 권한 창이 떠 있는 사이 위젯이 사라졌으면 즉시 정리
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        const audio = new AudioContext();
        const source = audio.createMediaStreamSource(stream);
        const analyser = audio.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser); // 출력(스피커)에는 연결하지 않음 → 되먹임 없음
        session = { stream, audio, analyser, buffer: new Float32Array(analyser.fftSize), raf: 0 };
        level = 0;
        alarm = { overSince: null, alarm: false };
        paintLive();
        session.raf = requestAnimationFrame(tick);
      } catch (error) {
        if (stream) for (const track of stream.getTracks()) track.stop();
        console.info('[noise] microphone unavailable', error);
        const kind = micErrorKind(error);
        showIdle(`widget.noise.error.${kind === 'no-mic' ? 'noMic' : kind}`);
      } finally {
        starting = false;
      }
    }

    function tick() {
      if (!session) return;
      session.analyser.getFloatTimeDomainData(session.buffer);
      level = smooth(level, levelFromRms(rms(session.buffer), state.sensitivity));
      alarm = updateAlarm(alarm, level, state.threshold, performance.now());
      paintLive();
      session.raf = requestAnimationFrame(tick);
    }

    /** 마이크 끄기 (트랙 중지 → 브라우저 녹음 표시도 꺼짐) */
    function release() {
      if (!session) return;
      cancelAnimationFrame(session.raf);
      for (const track of session.stream.getTracks()) track.stop();
      session.audio.close().catch(() => {});
      session = null;
    }

    function stop() {
      release();
      showIdle(null);
    }

    // 탭이 숨겨지면 마이크를 끈다 → 다시 보이면 "측정 다시 시작"
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && session) {
        release();
        showIdle('widget.noise.paused');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const panel = createSettingsPanel(container, {
      title: t('widget.settingsTitle', { name: t('widget.noise.title') }),
      doneLabel: t('dialog.done'),
      build(body) {
        const range = /** @type {HTMLInputElement} */ (
          h('input', {
            className: 'w-range',
            attrs: { type: 'range', min: '5', max: '95', step: '5', 'aria-label': t('widget.noise.threshold') },
          })
        );
        range.value = String(state.threshold);
        range.addEventListener('input', () => ctx.setState((s) => ({ ...s, threshold: clampThreshold(range.value) })));
        body.append(
          field(t('widget.noise.threshold'), range, t('widget.noise.thresholdHint')),
          segmented({
            label: t('widget.noise.sensitivity'),
            options: [
              { value: 'low', label: t('widget.noise.sens.low') },
              { value: 'mid', label: t('widget.noise.sens.mid') },
              { value: 'high', label: t('widget.noise.sens.high') },
            ],
            value: state.sensitivity,
            onChange: (sensitivity) => ctx.setState((s) => ({ ...s, sensitivity })),
          }),
          segmented({
            label: t('widget.noise.style'),
            options: [
              { value: 'bar', label: t('widget.noise.styles.bar') },
              { value: 'face', label: t('widget.noise.styles.face') },
            ],
            value: state.style,
            onChange: (style) => ctx.setState((s) => ({ ...s, style })),
          }),
        );
      },
    });

    showIdle(null);

    return {
      update(next) {
        state = next;
        if (session) paintLive();
      },
      openSettings: panel.open,
      destroy() {
        release();
        document.removeEventListener('visibilitychange', onVisibility);
        root.remove();
      },
    };
  },
};
