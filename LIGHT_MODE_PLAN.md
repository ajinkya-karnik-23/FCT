# Plan — Light mode (alongside the existing dark mode)

Status: proposed, not started. Scope is additive; no spec page changes, no refactors of existing pages.

## Goal

A user-switchable light theme that coexists with the current dark theme. Dark stays the default and must look pixel-identical to today after the change. The choice persists across reloads.

Non-goals: `prefers-color-scheme` auto-detection (optional later), per-section theming, new colors beyond what the existing token names already cover.

## Why this is cheap in this codebase

Theming runs through exactly two channels today:

1. **Inline styles** — every component imports `colors` from `src/theme/tokens.ts` and puts those values into inline style objects.
2. **CSS variables** — `applyTheme()` (tokens.ts) injects the same values as `--kebab-case` custom properties on `<html>`; `src/index.css` uses only `var(--…)` for hover/active/focus states.

Verified before planning: no code in `src/` manipulates hex strings (no alpha suffixes, no parsing), and no test asserts on color values (`tests/` contains zero hex literals or `toHaveStyle`). Therefore the token *values* can change shape without touching a single page component or test file.

## Approach — CSS-variable indirection + dual palettes in tokens.ts

- Keep all hex in `tokens.ts` (preserves the "no hard-coded hex outside tokens" rule).
- Add a second palette object (`light`) next to the current one (renamed `dark`).
- Change the exported `colors` object from raw hex to **CSS-variable strings**: `bgRoot: 'var(--bg-root)'`, etc. Components keep doing `background: colors.bgPanel` — the string now resolves at paint time, so switching themes needs no React re-render of page content.
- `applyTheme(theme)` injects the chosen palette's variables onto `<html>` (the existing mechanism, just parameterized). Toggling = one call + persist to `localStorage`.
- `index.css` is **unchanged** — it already speaks only in variables.

### The one trap

`cssVariables` today is derived from `colors` via `Object.entries(colors)`. If `colors` becomes `var(…)` strings, that derivation would inject `--bg-root: var(--bg-root)` (circular). The variable maps must be built from the **palette objects** instead. This is the only structural change in tokens.ts.

## File-by-file changes

### 1. `src/theme/tokens.ts` (the core of the work)

- Rename current palette to `export const dark = { … }` (values unchanged).
- Add `export const light: typeof dark = { … }` — same keys, light values (table below; starting values to be tuned in-browser).
- `export type Theme = 'dark' | 'light'`.
- Rebuild `colors` as a name → variable map: `{ bgRoot: 'var(--bg-root)', … }` for every key. Keep the `ColorName` type. (`typeScale.eyebrow.color` / `tableHeader.color` embed these strings at module load — fine, they become var() references too.)
- Replace `cssVariables` with a per-theme map builder: `const themeVariables = (p) => ({ …entries(p) as kebab vars, '--font-sans', '--font-mono' })`.
- `applyTheme(theme: Theme = 'dark')` — injects that theme's variables on `document.documentElement.style` (same loop as today).
- Add the storage key (`fct-theme`) and a tiny `storedTheme(): Theme` reader (localStorage, falls back to `'dark'`, try/catch so non-browser contexts are safe).

### 2. `src/main.tsx`

`applyTheme()` → `applyTheme(storedTheme())` before render, so the persisted choice applies with no flash of the wrong theme.

### 3. `src/app/TopBar.tsx` (only component touched)

Add a theme toggle to the right group (after the PERIOD span / beside the Ask button):

- Real `<button type="button">`, mono 11px uppercase, same chip treatment as the entity-code chip (`borderStrong`, `padding: '3px 7px'`), label shows the **current** mode: `DARK MODE` / `LIGHT MODE`. No icon (no icon library, no emoji — project rule).
- Local state: `const [theme, setTheme] = useState<Theme>(storedTheme())`; onClick computes next theme, calls `applyTheme(next)`, persists to localStorage, updates state. No context needed — the toggle is the only consumer; page colors follow via CSS variables without re-render.
- Focus ring comes free from the global `:focus-visible` rule.

### 4. Everything else

No changes: all seven pages, palette, drawer, `derive.ts` (its return values are token references), `index.css`, tests.

## Proposed light palette (starting values — tune in browser)

Status colors double as text (e.g. `ageColor`) and as dots/bars, so the light variants are chosen to stay legible at 10–13px on white.

| Token | Dark (today) | Light (proposed) |
|---|---|---|
| bgRoot | #080B10 | #F2F5F9 |
| bgPanel | #0B1017 | #FFFFFF |
| bgPanelAlt | #0A0F16 | #F7F9FC |
| bgRaised | #101822 | #EAEFF5 |
| bgSelected | #121C27 | #E3EAF3 |
| bgAccentSoft | #12233C | #DFEAFB |
| bgAccentPanel | #0D1522 | #EEF4FC |
| borderDefault | #182231 | #D6DEE9 |
| borderSubtle | #131C27 | #E4EAF2 |
| borderStrong | #22303F | #B7C4D4 |
| borderAccent | #2A3A52 | #9FBCE8 |
| textPrimary | #E6ECF4 | #16222F |
| textSecondary | #B9C6D6 | #3E5169 |
| textMuted | #8798AC | #5A6E86 |
| textFaint | #5C7290 | #6F8299 |
| textFaintest | #4A5F7A | #93A3B5 |
| accent | #2E7DF0 | #2E7DF0 (unchanged) |
| accentText | #56A0FF | #1D5ED8 |
| statusGreen | #35C48A | #178A5E |
| statusAmber | #F2B23E | #A16207 |
| statusRed | #FF6B6B | #C22E2E |
| chartArOld | #B4551E | unchanged (mid-tone reads on both) |
| ageingBarAlt | #1F5FB5 | unchanged |
| bgAccentHover | #17304F | #CFE0F8 |
| assistantBorder | #1B2634 | #D9E2EE |

Theme-dependent non-color tokens:

- `layout.paletteScrim`: dark `rgba(4, 7, 11, 0.72)` → light `rgba(23, 32, 45, 0.55)`.
- `paletteShadow`: keep the same value in both themes (it is the product's only shadow; a black drop shadow works over light UIs).

## Verification

1. `npm test` — all 76 expected green (no color assertions exist, but TopBar gains a button; watch for any query that counts buttons or matches names loosely).
2. `tsc && vite build` clean.
3. Grep audit: hex/rgba literals still confined to `tokens.ts`; no new hard-coded colors anywhere.
4. In-browser (dev server :5200), in **both** themes, walk every surface: group view, entity home, P2P cockpit, worklist (+ filter/sort chips active state), exception detail, root cause (selected row + accent panel), working capital (ageing fills incl. the >40% accent rule), command palette (scrim + shadow), AI drawer (bubbles, streaming cursor, follow-up chips). Check hover states and focus rings in each theme.
5. Toggle persistence: switch to light → reload → still light; clear localStorage → back to dark default.
6. Contrast spot-checks on the weakest pairs at their real sizes: 10px table headers (`textFaint`), 11px mono labels, status text from `ageColor`/`controlColor`.

## Risks / notes

- The circular-variable trap above is the main implementation hazard; build variable maps from palettes, never from `colors`.
- Dark mode regression risk is near-zero (same hex values re-injected) but confirm visually — especially that `applyTheme('dark')` output matches today's byte-for-byte.
- `screenshots/` and `design-reference/` are dark-only artifacts; they remain the reference for dark, light gets no spec page (this work is user-directed, outside specs 01–07).
- If a real API swap-in happens later, theming is unaffected — it lives entirely in tokens.ts + TopBar.
