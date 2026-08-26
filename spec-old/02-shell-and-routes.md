# Spec 02 — App shell and routes

Read `01-tokens.md` first.

## Layout

```
+--------+--------------------------------------------------+
| rail   | top bar (60px)                                   |
| 236px  +--------------------------------------------------+
|        | view content (scrolls)          | AI drawer 470px |
|        |                                 | (toggleable)    |
+--------+--------------------------------------------------+
```

Root: `height: 100vh; display: flex; background: bg-root; color: text-primary;` sans, 14px,
`overflow: hidden`. The view content area is the only scrolling region.

## Left rail

`width: 236px; background: bg-panel; border-right: 1px solid border-default;` flex column.

Header block (`padding: 22px 22px 20px`, bottom border `border-default`):
- Row: 8px pulsing dot in `accent` + "Controller Cockpit" (15px, 600, letter-spacing -0.01em)
- Below: "FINANCE CONTROL TOWER" — 11px mono, letter-spacing 0.14em, `text-faint`

Nav list (`padding: 16px 12px`, 2px gap between items). Each item:
`padding: 10px 12px; font-size: 13px; border-left: 2px solid transparent;` label left, mono count
right (11px, `text-faint`).
- inactive: `text-muted`, transparent background
- hover: background `#131C27`, `text-primary`
- active: `border-left-color: accent`, background `bg-selected`, `text-primary`

Items, in order, with counts:
```
Group view       6
Entity health    —
P2P cockpit      327
Worklist         12
Root cause       —
Working capital  —
```
"Worklist" stays visually active while an exception detail page is open.

Footer, pinned to the bottom (`margin-top: auto`, top border, `padding: 18px 22px`):
- A button: `1px solid border-strong`, `padding: 9px 12px`, `text-muted`, 13px — "Search everything"
  on the left, "⌘K" (11px mono, `text-faint`) on the right. Hover: border `accent`, `text-primary`.
  Click opens the command palette.
- "JUBILANT PHARMOVA" — 11px mono, letter-spacing 0.12em, `text-faintest`

## Top bar

`height: 60px; padding: 0 26px; background: bg-panel; border-bottom: 1px solid border-default;`
flex row, `gap: 18px`, vertically centered:

1. Breadcrumb — 12px mono, `text-muted`, letter-spacing 0.06em. Derived from the route, using `›`
   as separator: `Group`, `Group › JGL`, `Group › JGL › P2P`, `Group › JGL › P2P › Invoices`,
   `Group › JGL › P2P › Invoices › AP-104281`, `Group › JGL › P2P › Root cause`,
   `Group › JGL › Working capital`.
2. A `1px × 22px` divider in `border-strong`.
3. Selected entity: status dot + name (13px, 600) + code in a `1px solid border-strong` chip
   (11px mono, `text-faint`, `padding: 3px 7px`).
4. Pushed right (`margin-left: auto`): "PERIOD AUG-2026 · DAY 4 OF CLOSE" (11px mono, `text-faint`),
   then the **Ask the cockpit** button — `1px solid border-strong`, `padding: 8px 13px`, 13px, with a
   6px `accent` dot; border becomes `accent` while the drawer is open. Toggles the AI drawer.

## Routes

Encode the drill path in the URL so every level is linkable and the breadcrumb derives from the
route — do not keep the current view in component state.

```
/                                                      group view
/entity/:code                                          entity health home
/entity/:code/p2p                                       P2P cockpit
/entity/:code/p2p/invoices?cause=missing-gr&sort=value  worklist (filter + sort in query params)
/entity/:code/p2p/invoices/:exceptionId                 exception detail
/entity/:code/root-cause/:causeKey                      root cause view
/entity/:code/working-capital                           working capital view
```

Default entity code is `JGL`. `sort` is one of `value | age | vendor` (default `value`).
`cause` absent means "All".

Local (non-URL) state only: AI drawer open, AI messages, streaming text, palette open, palette query.

## Accessibility

Every clickable row, tile and stage card is a real `<button>` or `<a>` with a visible focus ring
(2px `accent` outline, 2px offset). Status is never color-only — the accompanying label or number
always carries the meaning. Tables use `<table>` semantics or explicit ARIA grid roles.
