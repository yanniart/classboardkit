# Security policy / 보안 정책

## Supported versions / 지원 버전

| Version | Supported |
|---|---|
| 1.x (latest) | ✅ |
| < 1.0 | ❌ — please update (the app updates itself when online) |

The live app at https://yanniart.github.io/classboardkit/ always runs the latest release.

## Reporting a vulnerability / 취약점 제보

**Please do not open a public issue.** Report privately through GitHub:
**[Report a vulnerability](https://github.com/yanniart/classboardkit/security/advisories/new)** (Security → Advisories → New draft).

공개 이슈 대신 위 링크(GitHub 비공개 보안 권고)로 알려 주세요. 한국어·영어 모두 괜찮습니다.

Include, if you can: what an attacker could do, steps or a sample file/link that shows it, and the browser you used.
You will get a reply within **7 days**. This is a solo project, so a fix may take longer; you will be credited in the release notes unless you prefer not to be.

## What is in scope / 범위

ClassBoardKit has no server and no accounts — all data stays in the browser. The most relevant risks are:

- A crafted **backup file** (`*.classboardkit.json`) or **share link** (`#share=1.…`) that runs script, breaks other boards or leaks data when imported/opened
- Anything that sends board data (class lists, images) off the device
- The noise meter using the microphone outside the "Start" button flow
- Supply-chain issues in the vendored file `src/vendor/qrcodegen.js`

Out of scope: problems that need the attacker to already control the user's browser or device, and reports from automated scanners without a demonstrated impact.
