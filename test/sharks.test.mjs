import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const A = createRequire(import.meta.url)("../ascii-sharks.js");
const count = (arr) => arr.filter(Boolean).length;

test("the core block is upstream's TypeScript with types stripped (set ASCII_SHARKS_UPSTREAM=<clone>/src)", { skip: !process.env.ASCII_SHARKS_UPSTREAM }, () => {
  const out = execFileSync(process.execPath, ["tools/port.mjs", process.env.ASCII_SHARKS_UPSTREAM, "--check"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  assert.match(out, /matches upstream/);
});

test("headless frame has sharks (body blocks + glyphs) and fish", () => {
  const [f] = A.simulate({ width: 960, height: 540, seed: 1 });
  assert.equal(f.cols, 120); assert.equal(f.rows, 45); // cw 8, ch 12 at 960 px, as in the renderer
  assert.ok(count(f.bg) > 100, "shark bodies fill cells");
  assert.ok(f.glyph.filter((g) => g === "-").length > 40, "fish are drawn as '-'");
  assert.ok(f.glyph.includes("o"), "sharks have eyes");
});

test("same seed, same frame; another seed, another frame", () => {
  const a = A.simulate({ seed: 7, frames: 2 }), b = A.simulate({ seed: 7, frames: 2 }), c = A.simulate({ seed: 8, frames: 2 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a[1].glyph, c[1].glyph);
  assert.notDeepEqual(a[0].glyph, a[1].glyph, "the ocean moves between frames");
});

test("simulate leaves Math.random and globalThis.document as they were", () => {
  const r = Math.random;
  A.simulate({ seed: 3 });
  assert.equal(Math.random, r);
  assert.ok(!("document" in globalThis));
});

test("every shark kind renders", () => {
  assert.equal(A.SHARK_KINDS.length, 8);
  for (const kind of A.SHARK_KINDS) {
    const [f] = A.simulate({ width: 960, height: 540, sharks: kind, seed: 2 });
    assert.ok(count(f.bg) > 30, `${kind} has a body`);
  }
});

test("onFrame streams and can stop", () => {
  let n = 0;
  const kept = A.simulate({ seed: 1, warmup: 0, frames: Infinity, onFrame: () => ++n < 5 });
  assert.equal(n, 5); assert.equal(kept.length, 0);
});

test("toSVG: a still, and a flip-book with one <animate> per frame", () => {
  const still = A.toSVG(A.simulate({ seed: 1 }));
  assert.match(still, /^<svg [^>]*viewBox="0 0 960 540"/);
  assert.ok(!still.includes("<animate"));
  const book = A.toSVG(A.simulate({ width: 480, height: 270, seed: 1, frames: 6 }), { fps: 12 });
  assert.equal(book.match(/<animate /g).length, 6);
  assert.ok(book.includes('dur="0.500s"'));
  assert.equal((book.match(/<svg/g) || []).length, 1);
  assert.ok(book.trim().endsWith("</svg>"));
});

test("toANSI: one line per row, 24-bit colour", () => {
  const [f] = A.simulate({ width: 480, height: 240, seed: 1 });
  const s = A.toANSI(f);
  assert.equal(s.split("\n").length, f.rows);
  assert.match(s, /\x1b\[38;2;\d+;\d+;\d+m/);
});

test("browser glue registers <ascii-ocean> and a global API for <script> users", () => {
  const defined = {};
  class HTMLElement { constructor() { this.style = {}; } replaceChildren() {} getAttribute(k) { return this.attrs[k]; } }
  const ctx = vm.createContext({ HTMLElement, customElements: { get: (k) => defined[k], define: (k, c) => { defined[k] = c; } } });
  vm.runInContext(fs.readFileSync(path.join(root, "ascii-sharks.js"), "utf8"), ctx);
  assert.ok(defined["ascii-ocean"], "custom element defined");
  assert.ok(ctx.AsciiSharks && ctx.AsciiSharks.OceanEngine, "global API for <script> users");
});

test("<ascii-ocean> runs OceanEngine end to end on a stub DOM: frames draw glyphs, destroy stops", () => {
  const defined = {}, calls = { fillText: 0 }, rafs = [];
  const ctx2d = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === "fillText" ? () => calls.fillText++ : () => {}), set: (o, k, v) => ((o[k] = v), true) });
  const canvas = () => ({ style: {}, setAttribute() {}, getContext: () => ctx2d, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }) });
  const listeners = () => ({ addEventListener() {}, removeEventListener() {} });
  class HTMLElement { constructor() { this.style = {}; } replaceChildren(c) { this.child = c; } getAttribute(k) { return k === "sharks" ? "hammerhead,mako" : null; } }
  const Observer = class { observe() {} disconnect() {} };
  const sandbox = {
    HTMLElement, ResizeObserver: Observer,
    IntersectionObserver: class extends Observer { constructor(cb) { super(); cb([{ isIntersecting: true }]); } },
    customElements: { get: (k) => defined[k], define: (k, c) => { defined[k] = c; } },
    document: { createElement: canvas, documentElement: listeners(), fonts: { load: () => Promise.resolve() } },
    getComputedStyle: () => ({ fontFamily: "monospace" }),
    performance: { now: () => 0 },
    requestAnimationFrame: (f) => rafs.push(f), cancelAnimationFrame() {},
  };
  sandbox.window = Object.assign(listeners(), { devicePixelRatio: 1, matchMedia: () => ({ matches: false, ...listeners() }) });
  Object.assign(sandbox.window, sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "ascii-sharks.js"), "utf8"), vm.createContext(sandbox));
  const el = new defined["ascii-ocean"]();
  el.connectedCallback();
  assert.equal(el.engine.world.sharks.map((s) => s.kind).sort().join(), "hammerhead,mako");
  for (let i = 1; i <= 30; i++) rafs.shift()(i * 16.7);
  assert.ok(calls.fillText > 1000, `drew ${calls.fillText} glyphs in 30 frames`);
  el.disconnectedCallback();
  assert.equal(el.engine, null);
});

test("CLI writes an SVG and the terminal mode stops on --seconds", () => {
  const out = path.join(os.tmpdir(), `sharks-${process.pid}.svg`);
  const log = execFileSync(process.execPath, ["render.mjs", "--svg", out, "--sharks", "hammerhead"], { cwd: root, encoding: "utf8" });
  assert.match(log, /1 frame\(s\), 120x45 cells/);
  assert.match(fs.readFileSync(out, "utf8"), /^<svg /);
  fs.rmSync(out);
  const term = execFileSync(process.execPath, ["render.mjs", "--term", "--seconds", "0.3"], { cwd: root, encoding: "utf8" });
  assert.ok(term.includes("\x1b[H") && term.endsWith("\x1b[?25h\n"));
});
