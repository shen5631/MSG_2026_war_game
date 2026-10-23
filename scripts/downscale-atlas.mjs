// Builds a display-resolution copy of a fixed-cell atlas WITHOUT re-splitting it: every named frame keeps its
// own scene, name and order; only the resolution changes (high-quality browser resampling) and a 2px transparent
// gutter is added between cells so linear filtering cannot bleed neighbours.
// Usage: node scripts/downscale-atlas.mjs <src.png> <src.json> <out.png> <out.json> <scale>
// Requires the local Chrome used by the e2e tests (Playwright channel 'chrome').
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [srcPng, srcJson, outPng, outJson, scaleArg] = process.argv.slice(2);
if (!scaleArg) throw new Error('usage: downscale-atlas.mjs <src.png> <src.json> <out.png> <out.json> <scale>');
const scale = Number(scaleArg);
const atlas = JSON.parse(readFileSync(srcJson, 'utf8'));
const names = Object.keys(atlas.frames);
// Cell size / columns from meta when present, else from the first frame and the atlas width.
const first = atlas.frames[names[0]].frame;
const srcW = atlas.meta.frame_size?.w ?? first.w;
const srcH = atlas.meta.frame_size?.h ?? first.h;
const cols = atlas.meta.columns ?? Math.round(atlas.meta.size.w / srcW);
const cellW = Math.round(srcW * scale);
const cellH = Math.round(srcH * scale);
const PAD = 2;
const strideW = cellW + PAD * 2;
const strideH = cellH + PAD * 2;
const rows = Math.ceil(names.length / cols);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const b64 = readFileSync(srcPng).toString('base64');
const frames = names.map((n) => ({ n, ...atlas.frames[n].frame }));
const dataUrl = await page.evaluate(async ({ b64, frames, cols, cellW, cellH, PAD, strideW, strideH, rows }) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = cols * strideW;
  c.height = rows * strideH;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  frames.forEach((f, i) => {
    const dx = (i % cols) * strideW + PAD;
    const dy = Math.floor(i / cols) * strideH + PAD;
    g.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, cellW, cellH);
  });
  return c.toDataURL('image/png');
}, { b64, frames, cols, cellW, cellH, PAD, strideW, strideH, rows });
await browser.close();

writeFileSync(outPng, Buffer.from(dataUrl.split(',')[1], 'base64'));
const out = { frames: {}, meta: { image: outPng.split(/[\\/]/).pop(), size: { w: cols * strideW, h: rows * strideH }, scale: String(scale), frame_size: { w: cellW, h: cellH }, columns: cols, padding: PAD, source: srcPng.split(/[\\/]/).pop() } };
names.forEach((n, i) => {
  const x = (i % cols) * strideW + PAD;
  const y = Math.floor(i / cols) * strideH + PAD;
  out.frames[n] = { frame: { x, y, w: cellW, h: cellH }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: cellW, h: cellH }, sourceSize: { w: cellW, h: cellH } };
});
writeFileSync(outJson, JSON.stringify(out, null, 2) + '\n');
console.log(`${names.length} frames → ${out.meta.size.w}x${out.meta.size.h} (cell ${cellW}x${cellH}, scale ${scale})`);
