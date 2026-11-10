# Making a new widget

**English** · [한국어](new-widget.ko.md)

A widget is one folder in `src/widgets/` plus one line in `src/widgets/index.js`. The generator creates a small working widget (a counter) for you to change.

## 1. Generate

```bash
node tools/new-widget.mjs exit-ticket --title "Exit ticket"
node tools/new-widget.mjs exit-ticket --dry-run   # only show what would change
```

| Created | Purpose |
|---|---|
| `src/widgets/exit-ticket/index.js` | The definition (the contract below) and the DOM |
| `src/widgets/exit-ticket/exit-ticket-logic.js` | Pure state functions — no DOM, easy to test |
| `src/widgets/exit-ticket/exit-ticket.css` | Styles, loaded once at start |
| `tests/exit-ticket.test.js` | Contract + logic tests |

It also adds the import and list entry just above the `// new-widget:` markers in `src/widgets/index.js` (the widget appears at the end of the dock), adds a `widget.exit-ticket` block to every file in `src/locales/`, and runs `tools/sw-stamp.mjs`.

Then:

```bash
node --test                 # the generated test passes as is
node tools/i18n-check.mjs   # lists the new texts as "same as en" → translate them
python -m http.server 8765 --bind 127.0.0.1   # open the app and add the widget from the dock
```

The type must be lowercase letters, digits and `-`, and must not exist yet. **The type is stored in users' boards — never rename it after release.**

## 2. The contract (v1)

This is the stable part ([ADR-0011](../trd/adr/ADR-0011-v1-public-contract.md)); widgets written against it keep working in every v1.x release.

```js
export default {
  type: 'exit-ticket',          // unique, stored in boards
  version: 1,                    // version of your state shape
  icon: 'plus',                  // an id in assets/icons.svg
  titleKey: 'widget.exit-ticket.title',
  defaultSize: { w: 0.26, h: 0.3 },   // fraction of the canvas
  minSize: { w: 0.14, h: 0.18 },      // ≤ defaultSize
  styleUrl: new URL('./exit-ticket.css', import.meta.url).href,
  createState() { return { count: 0, step: 1 }; },
  migrate(state, fromVersion) { return state; }, // required when version > 1
  mount(container, ctx) {
    // ctx = { state, setState(next | prev => next), t(key, params), locale }
    return { update(nextState) {}, destroy() {}, openSettings() {} /* optional */ };
  },
};
```

- **`setState` replaces** the state (no merge). Return the same object to mean "no change".
- `update(next)` is called only when the state changed. Do not overwrite what the user is typing — compare first.
- The widget is destroyed and mounted again when the board or the language changes, so read `ctx.locale` and texts once in `mount`.
- `ctx.locale` (`'en'`, `'es'`, `'ja'`, `'ko'`) is for `Intl.DateTimeFormat` / `Intl.NumberFormat`.
- Returning `openSettings` adds a ⚙ button to the title bar. Build the panel with `createSettingsPanel`.

### Modules you may import

| Module | What for |
|---|---|
| `ui/dom.js` | `h(tag, options, children)`, `icon(name)`, `iconButton(...)` |
| `widgets/shared/ui.js` | `button`, `createSettingsPanel`, `field`, `segmented`, `toggle`, `textInput`, `listEditor`, `stepper`, `svg`, `prefersReducedMotion`, `liveRegion` |
| `widgets/shared/list.js` | `parseItems` for name lists |
| `core/utils/random.js` | `randomInt`, `shuffle`, `pickOne` — **never `Math.random`** (fairness) |

Anything else is internal and may change; `tests/widget-imports.test.js` fails if a new widget imports it. No npm packages, no network requests.

## 3. Designing the state

- **JSON only** — numbers, strings, booleans, arrays, plain objects. It is saved in the browser, in backup files and in share links.
- **Keep it small.** Share links have a size limit (32,000 characters for the whole board).
- **Time is a timestamp, not a counter.** Save `endAt = Date.now() + remaining` and compute from it, so a reload or a sleeping tab stays correct.
- **Class lists**: if the widget stores student names, add its type and the fields to empty to `NAME_FIELDS` in `src/core/share.js` (say so in the PR) — share links then leave the names out by default, as for the random picker and group maker.
- **Changing the shape later**: increase `version` and write `migrate(state, fromVersion)`. Old boards are migrated when loaded. Boards from a newer app version show as "unsupported widget" and keep their data.

## 4. Accessibility checklist

- Every button has a name — visible text, or `label` (→ `aria-label`) for icon-only buttons.
- Announce **only the final result of a user action** with `liveRegion(container).say(text)` — never `aria-live` on text that changes every second or during an animation.
- Colours: use `--color-*` tokens; for team/category colours use `--team-<name>` for areas/borders and `--team-<name>-text` for text (tested for contrast).
- Respect `prefersReducedMotion()` — skip animations.
- Everything must work with the keyboard (pointer-only drawing is the one exception).
- Text should be readable from the back of the room: size it with container units (`cqmin`); at the default widget size body text should be at least 18px.

## 5. Texts and translations

All texts go under `widget.<type>.*` in **every** `src/locales/*.js`. Counts use `{n}`; English and Spanish need plural forms when the number changes the word:

```js
names: { one: '{n} name', other: '{n} names' },  // en, es
names: '{n}人',                                  // ja, ko — one string
```

See the [translation guide](translation.md).

## 6. Tests and screenshots

- Put the logic in `<type>-logic.js` and test it in `tests/<type>.test.js` (`node --test`).
- Try it in the app with a mouse, touch (DevTools device mode) and the keyboard, in a dark theme and in another language.
- For a PR, attach a screenshot at the default size.

## 7. Before you open the PR

- [ ] `node --test` and `node tools/i18n-check.mjs` pass
- [ ] `node tools/sw-stamp.mjs` run after the last change
- [ ] A new icon? Add a `<symbol id="…">` to `assets/icons.svg` (24×24, `currentColor`, stroke 2) and set `icon`
- [ ] A line in `CHANGELOG.md` and the widget in the README feature table
