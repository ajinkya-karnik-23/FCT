# Finance Control Tower — Clay design system (graphite + amber)

Branch `design/clay-graphite`. This document is the source of truth for the clay
visual system and the scan-table information architecture applied across the app.
It supersedes the flat-navy system on `main` for this branch; every token in
`src/theme/tokens.ts` and every recipe in `src/theme/clay.ts` traces back to a
rule here.

## 1. Where the palette came from

The palette was not picked from swatches. It was **derived** by one method and then
**measured**, in this order:

1. **Roles before colours.** Ground, raised surface, sunken surface, three inks,
   hairline, one accent, one data hue, three status hues. Every colour on screen
   maps to a slot; nothing is decorative.
2. **One hue family, one temperature.** Everything derives from a warm 70° hue in
   OKLCH; only lightness and chroma vary. This is why the greys read as *chosen*
   rather than Bootstrap.
3. **Tinted neutrals.** Ground and inks carry ~0.5% chroma toward the family hue.
4. **A lightness ladder.** Ground L95, raised L98, sunken L92; inks at L28 / L40 /
   L50 / L58 (primary, secondary, muted, faint).
5. **One accent, used under 10% of any screen.** Amber. It is also the warning
   status — "amber means attention" — because three warm colours cannot coexist
   in one 60° slice without collapsing for colour-blind readers (measured: a
   separate burnt-orange accent sat ΔE 1.8 from status-amber under deutan).
6. **Status trio at staggered lightness**, not matched: amber lightest, green mid,
   red darkest. Red/green/amber cannot fully clear the CVD floor at text-contrast
   levels (the dataviz reference palette has the same limit), so **status is never
   colour-alone**: a band word, a glyph or a label always sits beside it.
7. **Data hue on the cool side (250°).** Bars are data, not controls; a bar must
   never look like a button, so the data hue is deliberately far from the accent.
8. **Validated by script, not by eye.** Every text tier was lowered until it clears
   4.5:1 on every surface it can sit on, against the rules in
   `src/theme/tokens.test.ts` (the dark palette is re-frozen there). The dark
   palette is derived by the same method on a warm near-black ground, with the
   clay shadow arms inverted — it is a sibling, not an inversion.

### Tokens

| Slot | Light | Dark | Rule |
|---|---|---|---|
| bgRoot / bgPanel | `#F2F0ED` / `#F5F3F1` | `#181512` / `#1F1C19` | ground and card share the ground; clay separates by shadow, not fill |
| bgRaised / bgSelected | `#FBFAF8` / `#E8E6E3` | `#292623` / `#302D2A` | hover lifts, selection presses in |
| textPrimary / Secondary / Muted / Faint | `#2C2824` `#4B4742` `#67625D` `#736E69` | `#EAE7E4` `#C0BDBA` `#A09E9B` `#7F7D7A` | ladder; faint is the footnote tier |
| accent / accentText | `#B27A00` / `#8E5C00` | `#E6AC3D` / `#E9B452` | tabs, active nav, primary CTA, eyebrow — nothing else |
| statusGreen / Amber / Red | `#00763A` `#8C6200` `#A90021` | `#63D18F` `#E7B643` `#FF7D7C` | keyed to thresholds (85 / 65), never decorative |
| ageingBarAlt (data hue) | `#6B89A9` | `#7DA2C9` | all magnitude bars, sparklines take direction colour |

## 2. Elevation is spent by role

Clay has exactly three surfaces. Which one a thing gets is decided by what it *is*:

| Recipe | Shadow | Used for | Never for |
|---|---|---|---|
| `card` | raised (`--shadow-up`) | KPI tiles, panels, lower cards, stage cards | table rows |
| `frame` | raised | the **one** container around a table | nested inside another card |
| `sunken` | inset (`--shadow-in`) | meter tracks, the tab well, selected taxonomy row, expanded row detail, inputs | text blocks |

Rows inside a frame are **flat and hairline-separated**. Buttons and chips are
raised pills that press inward on `:active`. Nothing else casts a shadow. Borders
are hairlines (`borderSubtle`) only, never the primary edge of anything.

Radii: containers 22px, rows and wells 14px, chips and meters 8px, pills 999px.

## 3. Scan-table information architecture

A dense table answers one question at a glance: *which row do I open?* Rules,
applied to every table in the app:

1. **Six primary columns or fewer**, plus an expander. Secondary columns are
   `detail: true` on the `DataTable` column and render inside the row's sunken
   expansion, one click away. Nothing is removed; it moves.
2. **One chart per row, maximum** — the headline money figure gets the sparkline;
   other figures get a number and a direction glyph (▲ ▼ –). The full set of
   sparklines and % deltas lives in the expansion.
3. **Worst first.** Rows sort by what needs attention (lowest score, capped rows
   pinned) so colour is not the only thing pulling the eye.
4. **One body size (13px), one label size (10px mono uppercase), tabular numerals**
   on every numeric column. Units live in the header where they don't vary.
5. **Row height ~56px**; column gap 16px; the context cards below a table get a
   visible margin so "the table" and "the context" read as two things.
6. **Status is never colour-alone.** Band word beside every score, glyph beside
   every delta, label inside every tag. The dimension strip on the Group View
   carries label, score and delta as screen-reader text.

Where a table already has six columns or fewer (vendor page, plant page) the rule
does not apply — the expansion exists to reduce density, not to hide things.

## 4. Component recipes (`src/theme/clay.ts`)

- `card`, `cardAccent`, `cardRisk` — raised panels; accent/risk tint the fill only.
- `frame`, `frameHead` — table container and its header strip.
- `sunken` — inset well.
- `kpiTile` — header KPI.
- `tag(color, soft?)` — inset mono pill; colour carries state, text carries meaning.
- `pillButton`, `pillButtonAccent`, `controlPill(active)` — raised pills; the
  accent fill is reserved for the one primary action on a screen.
- `pageStyle`, `monoNote` — page frame and the read-only / source footnote.

CSS classes in `src/index.css` carry the pressed/hover states so inline styles
never have to (`.fct-press`, `.fct-chip`, `.fct-expand`, `.fct-nav-item`, …).
Test contracts (`.fct-table-row`, `.fct-status-tag`, `.fct-tax-row--selected`,
`.fct-trace-current`) are preserved unchanged.

## 5. Do / don't

- **Do** put the accent on at most one filled element per screen plus the active tab.
- **Do** use the data hue for every magnitude bar; use status colours only when the
  bar *is* a status (dimension meters, stage exception rate).
- **Don't** add a border to a clay surface to "make it pop" — add elevation by
  role, or nothing.
- **Don't** put a sparkline in more than one column of a row.
- **Don't** introduce a colour outside `tokens.ts`; if a page needs one, the palette
  is missing a role — add the role, re-run the contrast test, re-freeze dark.

## 6. Verification

- `npx tsc --noEmit` and `npx vitest run` (335 tests) — the tokens test enforces
  contrast and the frozen dark baseline.
- Screenshot every route in both themes (script: `scrollcraft`-hosted
  `playwright-core`, 1440×960) and review for truncation, overflow and hierarchy.
- Squint test: hierarchy must survive in grayscale. If it doesn't, colour is doing
  structure's job.
