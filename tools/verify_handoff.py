#!/usr/bin/env python3
"""Validate the handoff package, not the eventual game. Standard library only."""
from pathlib import Path
import collections
import hashlib
import json
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
checks = []
def check(condition, label):
    checks.append(label)
    if not condition:
        errors.append(label)
def load(rel):
    return json.loads((ROOT / rel).read_text(encoding='utf-8'))
def png_size(path):
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'Invalid PNG: {path}')
    return struct.unpack('>II', data[16:24]), data[25]

try:
    locked = load('spec/locked_rules.json')
    defaults = load('spec/runtime_defaults.json')
    levels = load('spec/levels.json')
    inventory = load('spec/asset_inventory.json')
    atlas = load('public/assets/ganggamchan_v2/ganggamchan_atlas.json')
    anim = load('spec/animation_bindings.json')
    check(locked['player']['maxHp'] == 100, 'Player HP100')
    check(locked['player']['weakDamage'] == [10,12,15], 'Weak damage10/12/15')
    check(locked['player']['chargeDamage'] == [20,35,50], 'Charge damage20/35/50')
    check(locked['player']['chargeThresholdMs'] == [500,1000,1500], 'Charge thresholds')
    check(locked['player']['chargeChordWindowMs'] == 100, 'Chord100ms')
    check(locked['skills']['baseSharedCooldownMs'] == 20000, 'Shared cooldown20sec')
    check(locked['skills']['shield_guard']['initialShield'] == 40, 'Shield40')
    check(locked['skills']['shield_guard']['decayPerSecond'] == 8, 'Shield decay8sec')
    check(locked['skills']['spear_support']['damagePerTarget'] == 50, 'Spear50')
    check(locked['skills']['spear_support']['maxTargets'] == 5, 'Spear5targets')
    check(locked['game']['persistence'] == 'none', 'No saved progress')
    check(locked['bosses']['so_bae_ap']['maxLivingSummons'] == 3, 'Boss summons3')
    check(locked['upgrades']['sharedCooldownReductionMsPerStack'] == 3000, 'Cooldown reward-3sec')
    round_counts=[]; arenas=waves=0
    for r in levels['rounds']:
        count=0
        for a in r['arenas']:
            arenas += 1
            for w in a['waves']:
                waves += 1
                check(dict(collections.Counter(w['spawnOrder'])) == w['composition'], f"Composition {w['id']}")
                check(w['count'] == sum(w['composition'].values()), f"Wave count {w['id']}")
                count += w['count']
        check(count == r['normalEnemyCount'], f"Round count {r['id']}")
        round_counts.append(count)
    check(round_counts==[9,14,27], 'Round counts9/14/27')
    check(arenas==5 and waves==13 and sum(round_counts)==50, '5arenas13waves50normalenemies')
    check(max(w['count'] for r in levels['rounds'] for a in r['arenas'] for w in a['waves']) == 6, 'Max fixed wave6')
    for f in inventory['files']:
        p=ROOT/f['path']
        check(p.exists(), f"Exists {f['path']}")
        if not p.exists(): continue
        check(hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'], f"Hash {f['path']}")
    frames=list((ROOT/'public/assets/ganggamchan_v2/frames').rglob('*.png'))
    check(len(frames)==72, '72 individual frames')
    check(len(list((ROOT/'public/assets/ganggamchan_v2/frames/character').rglob('*.png')))==49, '49 character frames')
    check(len(list((ROOT/'public/assets/ganggamchan_v2/frames/effects').rglob('*.png')))==23, '23 effect frames')
    for p in frames:
        size,color=png_size(p)
        check(size==(128,128) and color==6, f'128x128 RGBA {p.name}')
        check(p.stem in atlas['frames'], f'Atlas frame {p.stem}')
    check(len(atlas['frames'])==72, '72 atlas records')
    for key, group in anim['character'].items():
        for name in group['frames']:
            check(name in atlas['frames'],f'Animation frame {name}')
    for action, group in anim['semanticFallbacks'].items():
        for k,v in group.items():
            if isinstance(v,list):
                for name in v:check(name in atlas['frames'],f'Fallback frame {name}')
    check(len(anim['character']['heavy']['frames'])==2, 'Heavy only2prep poses')
    for asset in load('spec/runtime_assets.json')['assets']:
        for field in ('texture','atlas'):
            check((ROOT/'public'/asset[field]).is_file(), f'Runtime asset {asset[field]}')
    cases=load('spec/acceptance_cases.json')['cases']
    check(len(cases)==len(set(c['id'] for c in cases)), 'Unique acceptance IDs')
    check(all(c['status']=='NOT_RUN_GAME_NOT_IMPLEMENTED' for c in cases), 'Game tests not falsely passed')
    for rel in ['CLAUDE.md','START_HERE.md','docs/GAME_SPEC_KO.md','docs/IMPLEMENTATION_PLAN_KO.md','docs/ACCEPTANCE_TESTS_KO.md','docs/ASSET_STATUS_KO.md','docs/DECISION_NOTES_KO.md','docs/TECHNICAL_REFERENCES.md']:
        check((ROOT/rel).is_file() and (ROOT/rel).stat().st_size>100,f'Doc {rel}')
except Exception as exc:
    errors.append(f'Exception: {exc}')
report={'packageChecks':len(checks),'passed':len(checks)-len(errors),'errors':errors,
        'scope':'Handoff file/config validation only; no Phaser gameplay or physical gamepad test.',
        'gameRuntimeTested':False}
print(json.dumps(report,ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
