#!/usr/bin/env node
// ascii-sharks-lite CLI: the ocean in your terminal, or as an SVG for a README. No browser.
//   node render.mjs --term [--sharks hammerhead,mako] [--seconds 10]
//   node render.mjs --svg docs/ocean.svg [--frames 24 --fps 12] [--width 960 --height 540] [--seed 1]
import fs from "node:fs";
import { createRequire } from "node:module";
const { simulate, toSVG, toANSI, SHARK_KINDS } = createRequire(import.meta.url)("./ascii-sharks.js");

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const num = (k, d) => Number(arg(k, d));

if (argv.includes("--list")) {
  console.log(SHARK_KINDS.join("\n"));
} else if (argv.includes("--svg")) {
  const out = arg("--svg");
  const t0 = performance.now();
  const frames = simulate({
    width: num("--width", 960), height: num("--height", 540), sharks: arg("--sharks"),
    seed: num("--seed", 1), warmup: num("--warmup", 4), frames: num("--frames", 1), every: num("--every", 5),
  });
  const svg = toSVG(frames, { fps: num("--fps", 12) });
  fs.writeFileSync(out, svg);
  console.log(`${out}  ${frames.length} frame(s), ${frames[0].cols}x${frames[0].rows} cells, ${(svg.length / 1024).toFixed(0)} KB, ${(performance.now() - t0).toFixed(0)} ms`);
} else if (argv.includes("--term")) {
  const cols = process.stdout.columns || 100, rows = (process.stdout.rows || 32) - 1;
  // 8 x 12 px cells while the ocean is up to 124 * 8 px wide (renderer: cw = clamp(round(width / 124), 8, 13)).
  const width = Math.min(cols, 131) * 8, height = rows * 12;
  const seconds = num("--seconds", Infinity), fps = 30, start = Date.now();
  const sleep = new Int32Array(new SharedArrayBuffer(4));
  let quit = false;
  process.on("SIGINT", () => { quit = true; });
  process.stdout.write("\x1b[?25l\x1b[2J");
  try {
    simulate({
      width, height, sharks: arg("--sharks"), seed: argv.includes("--seed") ? num("--seed") : null, warmup: 2,
      frames: Infinity, every: 2,
      onFrame(fr) {
        process.stdout.write("\x1b[H" + toANSI(fr));
        Atomics.wait(sleep, 0, 0, 1000 / fps);
        return !quit && (Date.now() - start) / 1000 < seconds;
      },
    });
  } finally {
    process.stdout.write("\x1b[0m\x1b[?25h\n");
  }
} else {
  console.log("usage: node render.mjs --term [--sharks hammerhead,mako] [--seconds 10]\n" +
    "       node render.mjs --svg out.svg [--frames 24 --fps 12] [--width 960 --height 540] [--sharks ...] [--seed 1]\n" +
    "       node render.mjs --list");
}
