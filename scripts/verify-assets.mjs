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
  khitan_spearman: { cell: 192, count: 25 },
  'khitan-shield-enemy-v2': { cell: 192, count: 33 },
  // Cavalry V6: 448×256 native-scale frames (feet anchor 224,220).
  'khitan-cavalry-v6': { cellW: 448, cellH: 256, count: 34 },
  goryeo_spearman_skill: { cell: 192, count: 18 },
  // Round-2 boss elite_spearman_v2: 320×192 native-scale frames (feet anchor 160,176).
  elite_spearman_v2: { cellW: 320, cellH: 192, count: 50 },
  'khitan-vanguard-v2': { cell: 192, count: 51 },
  'goryeo-shield-skill-v1': { cell: 128, count: 12 },
  round1_env: { cell: null, count: 67 },
  'round2-environment-v2': { cell: null, count: 70 },
};
// Fixed-size single images (projectiles, UI).
const IMAGE_SIZE = {
  khitan_archer_arrow_01: { w: 64, h: 32 },
  khitan_archer_arrow_02: { w: 64, h: 32 },
  ui_title_logo: { w: 1028, h: 383 },
  ui_skill_gauges_64: { w: 1088, h: 1292 },
};
// Round-3 environment tiles are separate PNGs (no atlas): each registered tile must match its manifest size.
const r3Manifest = readJson('public/assets/round3_environment_game_ready_v1/manifest.json');
for (const t of r3Manifest.assets) IMAGE_SIZE[`r3env_${t.id}`] = { w: t.size[0], h: t.size[1] };

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
    const ew = exp?.cellW ?? exp?.cell;
    const eh = exp?.cellH ?? exp?.cell;
    if (ew && (r.w !== ew || r.h !== eh)) errors.push(`${a.key}/${name} is ${r.w}x${r.h}, expected ${ew}x${eh}`);
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

// Registered BGM tracks must exist, be real MP3 data and cover only known music themes.
const THEMES = new Set(['title', 'round1', 'round2', 'round3', 'boss', 'ending']);
for (const t of runtime.audio ?? []) {
  const p = join(pub, t.file);
  if (/previews\/|review\//.test(t.file)) errors.push(`audio points into previews/review: ${t.file}`);
  if (!existsSync(p)) { errors.push(`missing audio file: public/${t.file}`); continue; }
  const b = readFileSync(p);
  const isMp3 = b.toString('latin1', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
  if (!isMp3) errors.push(`${t.key}: not an MP3 file`);
  for (const th of t.themes) if (!THEMES.has(th)) errors.push(`${t.key}: unknown music theme ${th}`);
  info.push(`${t.key}: ${(b.length / 1048576).toFixed(1)}MB mp3 for ${t.themes.join('/')}`);
}

// Frame names used by the renderer must exist in their atlases.
const envSrc = readFileSync(join(root, 'src/game/visual/environment.ts'), 'utf8');
const envAtlas = JSON.parse(readFileSync(join(pub, 'assets/round1_environment/round1_environment.json'), 'utf8'));
const contentBlock = envSrc.slice(envSrc.indexOf('const CONTENT'), envSrc.indexOf('export const REQUIRED_ENV_FRAMES'));
for (const m of contentBlock.matchAll(/^\s+(\w+): \{ x:/gm)) if (!envAtlas.frames[m[1]]) errors.push(`environment.ts uses missing env frame ${m[1]}`);
// Skill gauge atlas: the HUD computes CSS positions from a fixed 16-column grid (64px + 2px padding);
// every named frame in the JSON must sit exactly there, 3 skills × 101 readiness steps (000 = just used, 100 = ready).
const gaugeAtlas = JSON.parse(readFileSync(join(pub, 'assets/skill_gauges_v1/atlas/skill_gauges_64.json'), 'utf8'));
let gaugeFrames = 0;
['command', 'spear', 'shield'].forEach((skill, si) => {
  for (let p = 0; p <= 100; p++) {
    const name = `${skill}_${String(p).padStart(3, '0')}`;
    const f = gaugeAtlas.frames[name]?.frame;
    if (!f) { errors.push(`skill gauge atlas missing ${name}`); continue; }
    const i = si * 101 + p;
    const x = (i % 16) * 68 + 2;
    const y = Math.floor(i / 16) * 68 + 2;
    if (f.x !== x || f.y !== y || f.w !== 64 || f.h !== 64) errors.push(`skill gauge ${name} at ${f.x},${f.y} ${f.w}x${f.h}, expected ${x},${y} 64x64`);
    gaugeFrames++;
  }
});
info.push(`skill gauges: ${gaugeFrames} frames on the 16-column grid`);
if (existsSync(join(pub, 'assets/skill_gauges_v1/frames'))) errors.push('skill gauge editing PNGs (frames/) must not ship in public/');

// Round-1 boss V2: every manifest animation frame must be in the atlas (51 = 9 actions); V1 must not be referenced.
const vgManifest = JSON.parse(readFileSync(join(pub, 'assets/khitan_vanguard_v2/manifest.json'), 'utf8'));
const vgAtlas = JSON.parse(readFileSync(join(pub, 'assets/khitan_vanguard_v2/atlas/vanguard.json'), 'utf8'));
let vgFrames = 0;
for (const [action, list] of Object.entries(vgManifest.animations)) {
  if (list.length !== vgManifest.counts[action]) errors.push(`vanguard ${action}: ${list.length} frames ≠ manifest count ${vgManifest.counts[action]}`);
  for (const n of list) { vgFrames++; if (!vgAtlas.frames[n]) errors.push(`vanguard atlas missing ${n}`); }
}
if (vgFrames !== vgManifest.totalFrames) errors.push(`vanguard manifest lists ${vgFrames} frames, totalFrames ${vgManifest.totalFrames}`);
if (vgManifest.rootPx?.x !== 96 || vgManifest.rootPx?.y !== 176) errors.push('vanguard root point is not (96,176)');
if (existsSync(join(pub, 'assets/khitan_vanguard_boss_assets_v1'))) errors.push('V1 vanguard assets must not be in public/');
info.push(`khitan-vanguard-v2: ${vgFrames} manifest frames across ${Object.keys(vgManifest.animations).length} actions`);

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
console.log('verify:assets OK — still missing final art: boss 3 (so_bae_ap), ending BGM and all SFX (generated placeholders are used); ally spearman skill v1 frames need replacement.');
