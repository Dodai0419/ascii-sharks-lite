---
name: ascii-sharks-lite
description: Add an animated ASCII ocean (fish schools hunted by sharks: classic, hammerhead, great hammerhead, tiger, zebra, mako, thresher, nurse) to a web page with one script tag, play it in the terminal, or export it as an SVG for a README. Use when the user wants an ASCII/terminal-style hero background, a playful landing page, a README banner, or "sharks in my terminal".
---

# ascii-sharks-lite

stackedlol/ascii-sharks as one plain JS file: the same simulation and renderer, with no npm install,
no Vite and no TypeScript build. Node 18+ for the CLI; any modern browser for the page.

## Web page (copy `ascii-sharks.js` next to the HTML)
```html
<ascii-ocean sharks="hammerhead,mako" style="height:60vh"></ascii-ocean>
<script src="ascii-sharks.js"></script>
```
- `sharks`: comma list, first is the biggest, each next one 10% smaller. Leave it out for four classics.
- Kinds: classic hammerhead zebra tiger greathammer mako thresher nurse (`node render.mjs --list`).
- The element sizes itself from CSS; set a height. It pauses off screen and shows one still frame
  under `prefers-reduced-motion`. Clicking makes a splash that scatters the fish.
- Script API: `new AsciiSharks.OceanEngine(canvas, [{ kind: "tiger", size: 1 }])`, `.destroy()`.

## Terminal
`node render.mjs --term --sharks hammerhead,tiger` (Ctrl+C to stop, `--seconds 10` to stop on its own).

## README image
- Still: `node render.mjs --svg docs/ocean.svg --sharks thresher,mako`
- Looping flip-book: `node render.mjs --svg docs/ocean.svg --width 720 --height 405 --frames 24 --fps 12`
- Same `--seed` gives the same picture.

## Updating from upstream
`node tools/port.mjs <ascii-sharks clone>/src` regenerates the core block; `--check` only compares.
