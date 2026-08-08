# SentinelAI – ML Based Insider Trading & Fraud Detection Platform

Build the visual foundation for a customer health dashboard template. This first pass is deliberately narrow: one hero chart plus the design system it establishes. Do not build a full dashboard with multiple chart sections yet.

## Charting approach — important

Do NOT use Recharts, Chart.js, Nivo, Victory, or any charting library for this. Install the individual d3 submodules `d3-scale`, `d3-force`, `d3-shape`, `d3-array` (plus their @types) and hand-roll the chart as React components that render plain SVG elements. d3 does the math only — computing scales and force positions. React owns all rendering. No d3 `.append()`, no refs holding DOM, no enter/update/exit pattern.

## The hero chart: account beeswarm

A horizontal beeswarm where every dot is one customer account.

- X axis: health score, 0 to 100
- Dot radius: scaled by account ARR, using `scaleSqrt` so area reads proportionally, roughly 4px to 22px
- Layout: run a d3-force simulation with `forceX(xScale(score)).strength(0.9)`, a weak `forceY(centerline).strength(0.05)`, and `forceCollide(radius + 1.5)`
- Run the simulation live on mount so the user watches the dots settle into place from a scattered starting position. This settling motion is the centerpiece of the whole page — make it feel good. Roughly 1.5 seconds to settle, and let it ease out naturally rather than cutting off.
- When the user changes a filter, re-run the simulation and let the dots animate to their new positions rather than jumping.
- Hovering a dot raises it slightly, shows a small tooltip with account name, ARR, health score, and segment. Clicking a dot selects it and dims the others.
- Add a segment filter above the chart (All / Enterprise / Mid-Market / SMB) as quiet text toggles, not chunky buttons.

Under the chart, when an account is selected, show a simple detail panel with the account's name, ARR, health score, owner, and last-touched date. Keep it plain — the drill-down charts come in a later pass.

## Seed data

Generate about 70 fake B2B SaaS accounts in a typed TS file. Realistic company names, ARR from $8k to $900k, health scores spread across the full range but weighted so most accounts sit healthy and the left tail is sparse. Include segment, CSM owner name, and last-touched date.

Plant a few specific stories in the data so the demo has something to find: two or three large-ARR accounts sitting in the danger zone below 35, one account with high ARR and a middling score, and a cluster of healthy small accounts. Make the big at-risk dots visually unmissable on the left side.

## Visual direction — this is the point of the exercise

The aesthetic target is an editorial data piece, something closer to a print magazine's data feature than a BI tool. Restraint and typography do the work.

Typography — load from Google Fonts:
- `Instrument Serif` for section headings and the page title. Large, tight leading. A serif in a dashboard is the single most important choice here — it immediately reads as designed.
- `Inter Tight` for UI text, labels, and body
- `JetBrains Mono` for all numbers, with `font-variant-numeric: tabular-nums` applied globally to figures so they don't shift

Color:
- Warm near-black background, not slate. Something in the neighborhood of a very dark warm brown-black. Explicitly do not use slate-900 or any cool gray — every generated dashboard uses those and this must not look like one.
- Foreground text in a warm off-white with a clear hierarchy of muted tones beneath it
- Dot fill: a single-hue sequential ramp keyed to health score, going from muted and desaturated at the low end to the accent at the high end
- Reserve exactly one saturated alarm color, and use it only on genuinely at-risk accounts. It should appear four or five times on the entire page. Because it's the only place that color appears, it carries real weight.
- Absolutely no red/amber/green traffic-light palette

Chrome:
- No card shadows anywhere. None.
- No borders on containers. Use hairline rules at very low opacity where separation is needed.
- Axes must be quiet: no gridlines, no axis line on the value axis, ticks as small muted mono labels floating without decoration
- Generous whitespace. Let the chart breathe far more than feels necessary.

Put all colors, fonts, and the health-score color ramp in the Tailwind config and index.css as semantic tokens. Nothing hardcoded in components — a person remixing this template should be able to change the whole palette in one file.

## Structure

Build the chart as small composable pieces (`Beeswarm`, `BeeswarmDot`, `Axis`, `Tooltip`) so later charts can reuse the axis and tooltip primitives. Keep the force simulation logic in a `useBeeswarmLayout` hook, separate from rendering.

One page. Page title, a short editorial subtitle in the serif, the beeswarm, the detail panel. That's it for now.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bc24ad40-5f44-4349-8189-ea9a9262251e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
