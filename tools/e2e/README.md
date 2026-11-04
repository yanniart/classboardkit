# 브라우저 E2E

Edge(또는 Chrome)를 헤드리스로 띄우고 DevTools Protocol로 **실제 마우스·터치·키보드 입력**을 보내 검증한다.
외부 의존성 없음 (Node 22+ 내장 `fetch`·`WebSocket`). CI에서는 실행하지 않는다 (로컬 전용).

## 실행
```bash
python -m http.server 8765 --bind 127.0.0.1   # 다른 터미널(또는 백그라운드)
node tools/e2e/m1.mjs                          # 캔버스·보드 (34항목)
node tools/e2e/m2.mjs                          # 위젯 8종 (36항목)
```
- 종료 코드 0 = 전부 통과. 스크린샷은 `tools/e2e/out/` (git 제외)
- 환경 변수: `E2E_URL`(기본 `http://127.0.0.1:8765/`), `E2E_OUT`, `BROWSER_PATH`
- 매 실행마다 새 프로필·무작위 디버깅 포트를 쓰고, 끝나면 하위 프로세스까지 종료한다

## 새 시나리오 작성
```js
import { APP_URL, launch, sleep } from './harness.mjs';
const b = await launch({ lang: 'ko' });
await b.viewport(1280, 800);
await b.cdp('Page.navigate', { url: APP_URL });
await sleep(1200);
await b.click('.dock__item[data-type="timer"]');
b.check('timer added', (await b.saved())[0].widgets.length === 1);
b.finish(); // 콘솔 오류 검사 포함
```
도구: `click`, `drag`, `touchDrag`, `key`, `type`(줄바꿈=Enter), `evaluate`, `shot`, `viewport`, `saved`, `settings`, `cdp`
