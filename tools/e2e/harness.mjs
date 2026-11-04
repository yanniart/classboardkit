// 브라우저 E2E 하네스: Edge/Chrome 헤드리스 + DevTools Protocol로 실제 마우스·터치·키보드 입력을 보낸다.
// 외부 의존성 없음 (Node 22+ 내장 fetch·WebSocket 사용).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 앱 주소 (정적 서버를 먼저 띄울 것) */
export const APP_URL = process.env.E2E_URL ?? 'http://127.0.0.1:8765/';
/** 스크린샷 저장 폴더 (git 제외) */
export const OUT_DIR = process.env.E2E_OUT ?? join(dirname(fileURLToPath(import.meta.url)), 'out');

/** 브라우저 실행 파일 찾기: BROWSER_PATH 환경변수 → Edge → Chrome */
function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Edge/Chrome not found. Set BROWSER_PATH.');
  return found;
}

/**
 * 브라우저를 띄우고 조작 도구를 반환한다.
 * @param {{ lang?: string }} [options]
 */
export async function launch({ lang = 'ko' } = {}) {
  mkdirSync(OUT_DIR, { recursive: true });
  const port = 9400 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'cbk-e2e-'));
  const browser = spawn(findBrowser(), [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', `--lang=${lang}`, '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' });

  // 하위 프로세스까지 확실히 종료 (Windows에서 부모만 죽이면 디버깅 포트를 잡은 자식이 남는다)
  const kill = () => {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F']);
      const tag = profile.split(/[\\/]/).pop();
      spawnSync('powershell', ['-NoProfile', '-Command',
        `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`]);
    } else {
      browser.kill('SIGKILL');
    }
  };
  process.on('uncaughtException', (e) => { console.error(e); kill(); process.exit(1); });
  process.on('unhandledRejection', (e) => { console.error(e); kill(); process.exit(1); });

  let target;
  for (let i = 0; i < 50 && !target; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {
      await sleep(200);
    }
  }
  if (!target) {
    kill();
    throw new Error('Could not connect to the browser DevTools endpoint');
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      errors.push(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push(`log: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
    }
  };

  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.exception?.description ?? 'eval error'}\n${expression}`);
    return r.result.value;
  };

  /** 요소 중심 좌표. 스크롤 영역 안이면 먼저 화면에 보이게 한다 */
  const rect = (sel) =>
    evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null;
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);

  const mouse = (type, x, y, extra = {}) => cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra });

  async function click(sel) {
    const r = await rect(sel);
    if (!r) throw new Error(`not found: ${sel}`);
    await mouse('mouseMoved', r.x, r.y);
    await mouse('mousePressed', r.x, r.y, { clickCount: 1, buttons: 1 });
    await mouse('mouseReleased', r.x, r.y, { clickCount: 1 });
    await sleep(120);
  }

  async function drag(sel, dx, dy, steps = 8) {
    const r = await rect(sel);
    if (!r) throw new Error(`not found: ${sel}`);
    await mouse('mouseMoved', r.x, r.y);
    await mouse('mousePressed', r.x, r.y, { clickCount: 1, buttons: 1 });
    for (let i = 1; i <= steps; i += 1) {
      await mouse('mouseMoved', r.x + (dx * i) / steps, r.y + (dy * i) / steps, { buttons: 1 });
    }
    await mouse('mouseReleased', r.x + dx, r.y + dy, { clickCount: 1 });
    await sleep(150);
  }

  async function touchDrag(sel, dx, dy, steps = 8) {
    const r = await rect(sel);
    if (!r) throw new Error(`not found: ${sel}`);
    await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
    for (let i = 1; i <= steps; i += 1) {
      await cdp('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: r.x + (dx * i) / steps, y: r.y + (dy * i) / steps }],
      });
    }
    await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(150);
  }

  const key = async (keyName, code, vk, modifiers = 0) => {
    await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: keyName, code, windowsVirtualKeyCode: vk, modifiers });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk, modifiers });
    await sleep(100);
  };

  /** 텍스트 입력. 줄바꿈은 Enter 키로 보낸다 */
  const type = async (text) => {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i]) await cdp('Input.insertText', { text: lines[i] });
      if (i < lines.length - 1) {
        await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
        await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      }
    }
    await sleep(100);
  };

  const shot = async (name) => {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT_DIR, `${name}.png`), Buffer.from(data, 'base64'));
  };

  const viewport = (width, height, mobile = false) =>
    cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });

  /** 저장된 앱 데이터 */
  const saved = () => evaluate(`JSON.parse(localStorage.getItem('classboardkit:v1:boards'))`);
  const settings = () => evaluate(`JSON.parse(localStorage.getItem('classboardkit:settings'))`);

  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Log.enable');

  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

  /** 콘솔 오류 검사 → 결과 출력 → 브라우저 종료 → 종료 코드 */
  const finish = () => {
    check('no console errors / exceptions', errors.length === 0, errors.join(' | '));
    for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
    console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
    ws.close();
    kill();
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  };

  return { cdp, evaluate, rect, mouse, click, drag, touchDrag, key, type, shot, viewport, saved, settings, check, finish, errors };
}
