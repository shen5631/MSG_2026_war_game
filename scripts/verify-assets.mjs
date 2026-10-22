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

// Per-atlas expectations: fixed-cell character atlases vs. the variable-size environment atlas.
const EXPECT = {
  ganggamchan: { cell: 128, count: 72 },
  khitan_infantry: { cell: 128, count: 25 },
  khitan_archer: { cell: 128, count: 25 },
  round1_env: { cell: null, count: 67 },
};
// Fixed-size single images (projectiles, UI).
const IMAGE_SIZE = {
  khitan_archer_arrow_01: { w: 64, h: 32 },
  khitan_archer_arrow_02: { w: 64, h: 32 },
  ui_title_logo: { w: 1028, h: 383 },
};

for (const a of runtime.assets) {
  for (const rel of [a.texture, a.atlas].filter(Boolean)) {
    if (/previews\/|review\//.test(rel)) errors.push(`runtime asset points into previews/review: ${rel}`);
    if (!existsSync(join(pub, rel))) errors.push(`missing runtime file: public/${rel}`);
  }
  if (a.type === 'image') {
    if (existsSync(join(pub, a.texture))) {
      const s = pngSize(join(pub, a.texture));
      info.push(`${a.key}: image ${s.w}x${s.h}`);
      const want = IMAGE_SIZE[a.key];
      if (want && (s.w !== want.w || s.h !== want.h)) errors.push(`${a.key}: image is ${s.w}x${s.h}, expected ${want.w}x${want.h}`);
    }
    continue;
  }
  if (a.type !== 'atlas' || !existsSync(join(pub, a.atlas)) || !existsSync(join(pub, a.texture))) continue;
  const atlas = JSON.parse(readFileSync(join(pub, a.atlas), 'utf8'));
  const size = pngSize(join(pub, a.texture));
  if (atlas.meta?.size && (atlas.meta.size.w !== size.w || atlas.meta.size.h !== size.h)) {
    errors.push(`${a.key}: atlas meta size ${atlas.meta.size.w}x${atlas.meta.size.h} ≠ PNG ${size.w}x${size.h}`);
  }
  const names = Object.keys(atlas.frames);
  const exp = EXPECT[a.key];
  info.push(`${a.key}: ${names.length} frames, texture ${size.w}x${size.h}`);
  if (exp && names.length !== exp.count) errors.push(`${a.key}: expected ${exp.count} frames, got ${names.length}`);
  for (const [name, f] of Object.entries(atlas.frames)) {
    const r = f.frame;
    if (exp?.cell && (r.w !== exp.cell || r.h !== exp.cell)) errors.push(`${a.key}/${name} is ${r.w}x${r.h}, expected ${exp.cell}x${exp.cell}`);
    if (r.x < 0 || r.y < 0 || r.x + r.w > size.w || r.y + r.h > size.h) errors.push(`${a.key}/${name} outside atlas bounds`);
  }
  if (a.key !== 'ganggamchan') continue;
  let charFrames = 0;
  let fxFrames = 0;
  for (const name of names) if (/_fx_|_skill_/.test(name)) fxFrames++; else charFrames++;
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

// Frame names used by the renderer must exist in their atlases.
const envSrc = readFileSync(join(root, 'src/game/visual/environment.ts'), 'utf8');
const envAtlas = JSON.parse(readFileSync(join(pub, 'assets/round1_environment/round1_environment.json'), 'utf8'));
const contentBlock = envSrc.slice(envSrc.indexOf('const CONTENT'), envSrc.indexOf('export const REQUIRED_ENV_FRAMES'));
for (const m of contentBlock.matchAll(/^\s+(\w+): \{ x:/gm)) if (!envAtlas.frames[m[1]]) errors.push(`environment.ts uses missing env frame ${m[1]}`);
// archer.ts builds names as khitan_archer_<action>_0<i>.png from [1..n]; counts must match the pack manifest.
const archerSrc = readFileSync(join(root, 'src/game/visual/archer.ts'), 'utf8');
const archerAtlas = JSON.parse(readFileSync(join(pub, 'assets/khitan_archer_assets_v2/atlas/khitan_archer_all_atlas.json'), 'utf8'));
const archerManifest = JSON.parse(readFileSync(join(pub, 'assets/khitan_archer_assets_v2/manifest.json'), 'utf8'));
for (const [action, anim] of Object.entries(archerManifest.animations)) {
  const m = archerSrc.match(new RegExp(`^\\s+${action}: \\[([\\d, ]+)\\]`, 'm'));
  if (!m) { errors.push(`archer.ts has no frame list for ${action}`); continue; }
  const used = m[1].split(',').map((n) => `khitan_archer_${action}_0${n.trim()}.png`);
  if (used.join() !== anim.frames.join()) errors.push(`archer.ts ${action} frames ≠ manifest order`);
  for (const n of used) if (!archerAtlas.frames[n]) errors.push(`archer.ts uses missing archer frame ${n}`);
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
console.log('verify:assets OK — still missing final art: spearman/shieldman/cavalry, 3 bosses, allies, round 2/3 backgrounds, audio (generated placeholders are used).');
