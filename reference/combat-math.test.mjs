import test from 'node:test';
import assert from 'node:assert/strict';
import {swordDamage, upgradeStats, decayShield, applyIncomingDamage, pickupHeal, chargeLevel,
  chargeReleaseBaseDamage, resolveTerminal, nearestSpearTargets} from './combat-math.mjs';

test('confirmed base and additive, positive half-up damage', () => {
  assert.equal(swordDamage(50),50);
  assert.equal(swordDamage(50,1),58);
  assert.equal(swordDamage(50,2,true),80);
  assert.equal(swordDamage(25,1,true),36);
  assert.equal([10,12,15,35].map(x=>swordDamage(x)).reduce((a,b)=>a+b,0),72);
});
test('round each hit, not entire combo', () => {
  assert.equal([10,12,15,35].map(x=>swordDamage(x,2)).reduce((a,b)=>a+b,0),95);
  assert.equal(swordDamage(72,2),94); // Demonstrates why rounding once per combo is incorrect.
});
test('only two total reward selections', () => {
  assert.equal(upgradeStats({parry:2}).parryWindowMs,300);
  assert.equal(upgradeStats({command:2}).sharedCooldownMs,14000);
  assert.throws(()=>upgradeStats({sword:2,parry:1}));
});
test('shield decay from 40 to zero in 5s', () => {
  assert.equal(decayShield(40,1000,5000).shield,32);
  assert.equal(decayShield(40,5000,5000).shield,0);
});
test('60 substeps do not round shield decay away', () => {
  let state={shield:40,remainingLifetimeMs:5000};
  for(let i=0;i<60;i++) state=decayShield(state.shield,1000/60,state.remainingLifetimeMs);
  assert.ok(Math.abs(state.shield-32)<1e-8);
});
test('fully absorbed and exactly broken shield do not stun or add i-frames', () => {
  const full=applyIncomingDamage({hp:100,shield:40,damage:15});
  assert.equal(full.hp,100);assert.equal(full.shield,25);assert.equal(full.stun,false);
  const exact=applyIncomingDamage({hp:100,shield:15,damage:15});
  assert.equal(exact.shield,0);assert.equal(exact.invulnerabilityMs,0);assert.equal(exact.stun,false);
});
test('shield overflow damages hp with stagger and 500ms invulnerability', () => {
  const r=applyIncomingDamage({hp:100,shield:10,damage:15});
  assert.equal(r.hp,95);assert.equal(r.stun,true);assert.equal(r.invulnerabilityMs,500);
});
test('fractional overflow is preserved', () => {
  assert.equal(applyIncomingDamage({hp:100,shield:10.5,damage:15}).hp,95.5);
});
test('hp invulnerability also preserves shield', () => {
  const r=applyIncomingDamage({hp:90,shield:10,damage:25,hpInvulnerable:true});
  assert.equal(r.hp,90);assert.equal(r.shield,10);
});
test('full health leaves pickup; partial health consumes and caps', () => {
  assert.deepEqual(pickupHeal(100,30),{hp:100,consumed:false});
  assert.deepEqual(pickupHeal(95,15),{hp:100,consumed:true});
  assert.deepEqual(pickupHeal(0,30),{hp:0,consumed:false});
});
test('charge exact thresholds and deliberately preserved charge1 damage20', () => {
  assert.deepEqual([499,500,999,1000,1499,1500,2500].map(chargeLevel),[0,1,1,2,2,3,3]);
  assert.equal(chargeReleaseBaseDamage(499),25);assert.equal(chargeReleaseBaseDamage(500),20);
});
test('same-tick boss victory takes precedence, ordinary death does not', () => {
  assert.equal(resolveTerminal({playerHp:0,bossHp:0}),'boss-victory');
  assert.equal(resolveTerminal({playerHp:0,bossHp:1}),'game-over');
  assert.equal(resolveTerminal({playerHp:0,bossHp:0,bossPresent:false}),'game-over');
});
test('spear chooses nearest five total, not five each side', () => {
  const es=[-100,-30,20,50,80,150,181].map((x,i)=>({x,y:0,alive:true,active:true,spawnSerial:i}));
  const r=nearestSpearTargets({x:0,y:0},es);
  assert.deepEqual(r.map(e=>e.x),[20,-30,50,80,-100]);
});
test('single boss is single target; missing/blocked/dead excluded', () => {
  const boss={x:50,y:0,alive:true,active:true,spawnSerial:1};
  assert.equal(nearestSpearTargets({x:0,y:0},[boss]).length,1);
  assert.equal(nearestSpearTargets({x:0,y:0},[{...boss,blockedByWall:true}]).length,0);
});
test('rejects invalid inputs instead of silently producing NaN', () => {
  assert.throws(()=>swordDamage(NaN));assert.throws(()=>chargeLevel(-1));assert.throws(()=>decayShield(40,-1,5000));
});
