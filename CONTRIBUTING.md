# Contributing to ClassBoardKit

**English** · [한국어](CONTRIBUTING.ko.md)

Thank you for helping teachers! ClassBoardKit is a small, solo-maintained project, so this page explains what fits the project and how to get a change merged quickly.

## Ways to help

- **Report a bug** — use the "Bug" issue form. Say which browser and device, and what you expected.
- **Improve a translation** — use the "Translation" issue form (any language is fine), or open a PR → [translation guide](docs/guides/translation.md).
- **Add a widget** — open a "Feature" issue first so we can agree on the idea, then follow the [new widget guide](docs/guides/new-widget.md).
- **Security problem** — please do not open a public issue → [SECURITY.md](SECURITY.md).

## Principles (changes that break these will not be merged)

| Principle | Why |
|---|---|
| **No build step** — plain HTML, CSS and JavaScript ES modules | Anyone can read and run the code; GitHub Pages serves the repository as it is |
| **No runtime dependencies** — a third-party library needs an ADR and is vendored unmodified | Works offline, nothing to audit or update |
| **No server, no account, no tracking** — data stays in the browser | Student data never leaves the classroom device |
| **No student-device participation** — the board is shown on the teacher's screen | Keeps the app serverless and privacy-safe |
| **Free for everyone, no limits** | It is a public good, not a product tier |
| **Accessible** — keyboard, screen reader, contrast | Classrooms include everyone |

Also out of scope for v1: right-to-left languages, translation platforms, loading widgets from URLs.

## Development setup

You need a browser, **Python 3** (static server) and **Node.js 20+** (tests and tools). There is nothing to install with npm.

```bash
git clone https://github.com/yanniart/classboardkit.git
cd classboardkit
python -m http.server 8765 --bind 127.0.0.1   # then open http://127.0.0.1:8765/
```

The service worker caches the app. After changing app files (`index.html`, `manifest.webmanifest`, `src/`, `assets/`) run:

```bash
node tools/sw-stamp.mjs
```

## Tests

| Command | What it checks |
|---|---|
| `node --test` | Unit tests (pure logic, widget contract, translations, offline cache list) — **must pass** |
| `node tools/i18n-check.mjs` | Every language has every key, matching `{placeholders}` and plural forms — **must pass** (also runs in CI) |
| `node tools/e2e/m1.mjs` … `m7.mjs` | Real browser tests with mouse, touch and keyboard (needs the server on 8765 and Edge or Chrome). Run the ones related to your change |
| `node tools/e2e/a11y-audit.mjs` | Accessibility table for 40 screen states (needs dev-only axe-core in `.tools/axe/`, see [ADR-0010](docs/trd/adr/ADR-0010-dev-accessibility-testing.md)) |

E2E tests count `console.warn` as an error — use `console.info` for expected failures.

## Making a change

1. Fork, create a branch (`fix/timer-sound`, `widget/exit-ticket`, `i18n/es-wording`).
2. Keep the change focused. Follow the existing style (2-space indent, single quotes, JSDoc types). Code comments may be English or Korean.
3. New user-visible text goes into **all** files in `src/locales/` — see the [translation guide](docs/guides/translation.md). If you cannot translate, copy the English text; `i18n-check` will flag it for translators.
4. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
5. Open a PR and fill in the checklist.

### What stays compatible

v1 keeps four things compatible: the backup file format, share links, storage keys and the widget contract ([ADR-0011](docs/trd/adr/ADR-0011-v1-public-contract.md)). A PR that breaks one of them needs a very good reason and waits for v2. Adding optional fields or new widgets is fine.

## PR checklist

- [ ] `node --test` and `node tools/i18n-check.mjs` pass
- [ ] Tried it with a mouse **and** touch (or touch emulation), and with the keyboard
- [ ] New buttons have names (visible text or `aria-label`); results are announced with `liveRegion()`, not `aria-live` on changing text
- [ ] Colours use the existing tokens (`--color-*`, `--team-*` / `--team-*-text`)
- [ ] Texts added to every language
- [ ] `node tools/sw-stamp.mjs` run after changing app files
- [ ] Data changes: `docs/trd/data-schema.md` + migration + tests
- [ ] User-visible change: a line in `CHANGELOG.md`

## Code of conduct

This project follows the [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be kind; assume good intent. Report problems to the maintainer through a private [security advisory](https://github.com/yanniart/classboardkit/security/advisories/new) if they cannot be raised in public.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
