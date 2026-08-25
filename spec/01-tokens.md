# Spec 01 — Design tokens

Use these values literally. Define them once (CSS variables, a theme object, or your framework's
token file) and reference them everywhere. Never hard-code a hex in a component.

## Colors

```
bg-root          #080B10   app canvas
bg-panel         #0B1017   rail, top bar, cards, tables
bg-panel-alt     #0A0F16   AI drawer
bg-raised        #101822   row hover, assistant bubble
bg-selected      #121C27   selected nav item, palette row hover
bg-accent-soft   #12233C   accent buttons, user chat bubble
bg-accent-panel  #0D1522   insight / recommended-action panels
border-default   #182231   card and section borders
border-subtle    #131C27   table row dividers, empty bar track
border-strong    #22303F   inputs, chips, buttons
border-accent    #2A3A52   accent panel borders
text-primary     #E6ECF4
text-secondary   #B9C6D6
text-muted       #8798AC
text-faint       #5C7290   mono eyebrow labels, keyboard hints
text-faintest    #4A5F7A   footer wordmark
accent           #2E7DF0   bars, active states
accent-text      #56A0FF   links, IDs, "Analyse →"
status-green     #35C48A
status-amber     #F2B23E
status-red       #FF6B6B
chart-ar-old     #B4551E   older AR ageing buckets
```

## Fonts

```
sans   'Helvetica Neue', Helvetica, Arial, sans-serif
mono   'IBM Plex Mono', monospace          Google Fonts, weights 400 500 600
```

Rule: every number, ID, percentage, breadcrumb and uppercase label is mono. Every sentence is sans.

## Type scale

```
view-title      26px / 600 / letter-spacing -0.02em
big-score       44px mono / 600 / line-height 1
kpi-value       30px mono / 600
tile-value      22px mono / 600
stage-volume    19px mono / 400
body            13px / 400
ui-base         14px / 400
eyebrow         10-11px mono / uppercase / letter-spacing 0.14-0.22em / text-faint
table-header    10px mono / uppercase / letter-spacing 0.14em / text-faint
```

## Spacing and geometry

```
content padding      30px 26px 40px
card padding         20-22px
table cell padding   12-16px 20px
gap between cards    16px
gap between stages   10px
gap inside cards     8-14px
left rail width      236px
top bar height       60px
AI drawer width      470px
palette width        720px, opened 12vh from top, scrim rgba(4,7,11,0.72)
border radius        0 EVERYWHERE
```

The only round shapes are status dots: 6-8px circles (`border-radius: 50%`).
No rounded cards. No pill buttons. No card shadows. No gradients. No icon library. No emoji.
The palette is the only element with a shadow: `0 40px 100px -30px rgba(0,0,0,0.9)`.

## Bars (used everywhere instead of charts)

Plain divs. Track color `border-subtle`, fill in `accent` or a status color.
Heights: 4px (stage exception rate), 6px (inline meters), 18px (ageing bars),
22px (dimension columns in the group table, filled bottom-up).

## Animation

One only: `pulse`, opacity 1 → 0.35 → 1, 2.4s ease-in-out infinite, on the rail logo dot and the
AI panel status dot. Drawer and palette may fade/slide in over 120-160ms ease-out.

## Derived color rules — implement as pure functions, never store the color

```
scoreColor(n)      n >= 85 -> status-green   n >= 70 -> status-amber   else status-red
statusWord(n)      n >= 85 -> 'GREEN'        n >= 70 -> 'AMBER'        else 'RED'
ageColor(days)     > 30 -> status-red        > 15 -> status-amber      else text-secondary
controlColor(c)    'High' -> status-red      'Medium' -> status-amber  'Low' -> text-muted
breachColor(n)     > 3 -> status-red         > 0 -> status-amber       else status-green
```

## Money formatting

Indian crore, one formatting utility: `formatCr(18.6) => '₹18.6 cr'`, two decimals for transaction
amounts (`₹2.84 cr`), one for aggregates (`₹18.6 cr`).
