// Verifies runtime asset paths, atlas frames/sizes, animation bindings and that previews/review are never loaded.
// Usage: npm run verify:assets   (exit code 1 on any failure)
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const errors = [];
const info = [];
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

function pngSize(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`not a PNG: ${file}`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const runtime = readJson('spec/runtime_assets.json');
const bindings = readJson('spec/animation_bindings.json');
const inventory = readJson('public/assets/ganggamchan_v2/metadata/frames.json');

for (const a of runtime.assets) {
  for (const rel of [a.texture, a.atlas]) {
    if (/previews\/|review\//.test(rel)) errors.push(`runtime asset points into previews/review: ${rel}`);
    if (!existsSync(join(pub, rel))) errors.push(`missing runtime file: public/${rel}`);
  }
  if (a.type !== 'atlas' || !existsSync(join(pub, a.atlas)) || !existsSync(join(pub, a.texture))) continue;
  const atlas = JSON.parse(readFileSync(join(pub, a.atlas), 'utf8'));
  const size = pngSize(join(pub, a.texture));
  if (atlas.meta?.size && (atlas.meta.size.w !== size.w || atlas.meta.size.h !== size.h)) {
    errors.push(`atlas meta size ${atlas.meta.size.w}x${atlas.meta.size.h} ≠ PNG ${size.w}x${size.h}`);
  }
  const names = Object.keys(atlas.frames);
  info.push(`${a.key}: ${names.length} frames, texture ${size.w}x${size.h}`);
  let charFrames = 0;
  let fxFrames = 0;
  for (const [name, f] of Object.entries(atlas.frames)) {
    const r = f.frame;
    if (r.w !== 128 || r.h !== 128) errors.push(`frame ${name} is ${r.w}x${r.h}, expected 128x128`);
    if (r.x < 0 || r.y < 0 || r.x + r.w > size.w || r.y + r.h > size.h) errors.push(`frame ${name} outside atlas bounds`);
    if (/_fx_|_skill_/.test(name)) fxFrames++; else charFrames++;
  }
  if (charFrames !== 49 || fxFrames !== 23) errors.push(`expected 49 character + 23 effect frames, got ${charFrames} + ${fxFrames}`);
  const set = new Set(names);
  const required = new Set();
  for (const g of Object.values(bindings.character)) g.frames.forEach((n) => required.add(n));
  for (const list of Object.values(bindings.effects)) list.forEach((n) => required.add(n));
  for (const fb of Object.values(bindings.semanticFallbacks)) for (const v of Object.values(fb)) if (Array.isArray(v)) v.forEach((n) => required.add(n));
  for (const n of required) if (!set.has(n)) errors.push(`binding references missing frame: ${n}`);
  const heavy = names.filter((n) => n.startsWith('ganggamchan_heavy_'));
  if (heavy.length !== 2) errors.push(`heavy should have exactly 2 preparation frames, found ${heavy.length}`);
  info.push(`heavy frames: ${heavy.join(', ')} (preparation poses only — strong attack visuals are TEMPORARY reuse)`);
}

// Individual frame PNGs (editing/verification copies) keep the 128x128 contract.
let checked = 0;
for (const fr of inventory.frames) {
  const p = join(pub, 'assets/ganggamchan_v2', fr.file);
  if (!existsSync(p)) { errors.push(`inventory frame missing: ${fr.file}`); continue; }
  const s = pngSize(p);
  if (s.w !== 128 || s.h !== 128) errors.push(`${fr.file} is ${s.w}x${s.h}`);
  checked++;
}
info.push(`individual frame PNGs checked: ${checked}`);

// Source must not reference previews/review or invented asset paths.
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
for (const file of walk(join(root, 'src'))) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  if (/ganggamchan_v2\/(previews|review)\//.test(text)) errors.push(`${rel} references previews/review`);
  for (const m of text.matchAll(/['"`](assets\/[^'"`$]+\.(png|json|mp3|ogg|wav|m4a))['"`]/g)) {
    if (!existsSync(join(pub, m[1]))) errors.push(`${rel} references missing asset ${m[1]}`);
  }
}

for (const l of info) console.log(`  ${l}`);
if (errors.length) {
  console.error(`verify:assets FAILED (${errors.length})`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('verify:assets OK — final production enemy/boss/background/audio assets are NOT included (generated placeholders are used).');
