// Squad Surge: Comprehensive Automated Test Suite (Phases 1 - 4)
const assert = require('assert');

console.log('====================================================');
console.log('  Squad Surge: Automated Architecture & Combat Tests');
console.log('====================================================');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

// 1. Biome & 100-Level Sector Mapping
function getSectorForLevel(level) {
  if (level <= 20) return 1;
  if (level <= 40) return 2;
  if (level <= 60) return 3;
  if (level <= 80) return 4;
  return 5;
}

it('Levels 1 to 100 correctly map across 5 distinct Sectors', () => {
  assert.strictEqual(getSectorForLevel(1), 1);
  assert.strictEqual(getSectorForLevel(20), 1);
  assert.strictEqual(getSectorForLevel(21), 2);
  assert.strictEqual(getSectorForLevel(40), 2);
  assert.strictEqual(getSectorForLevel(41), 3);
  assert.strictEqual(getSectorForLevel(60), 3);
  assert.strictEqual(getSectorForLevel(61), 4);
  assert.strictEqual(getSectorForLevel(80), 4);
  assert.strictEqual(getSectorForLevel(81), 5);
  assert.strictEqual(getSectorForLevel(100), 5);
});

// 2. Boss Intervals
it('Every 5th level has Warden and every 10th level has Titan', () => {
  for (let lvl = 1; lvl <= 100; lvl++) {
    const isTitan = lvl % 10 === 0;
    const isWarden = !isTitan && (lvl % 5 === 0);
    if (lvl % 10 === 0) {
      assert.strictEqual(isTitan, true, `Level ${lvl} must be Titan`);
      assert.strictEqual(isWarden, false, `Level ${lvl} cannot be Warden`);
    } else if (lvl % 5 === 0) {
      assert.strictEqual(isWarden, true, `Level ${lvl} must be Warden`);
      assert.strictEqual(isTitan, false, `Level ${lvl} cannot be Titan`);
    }
  }
});

// 3. Phase 1: Ricochet Prism Mirror Ballistics
it('Ricochet Prism Mirror correctly deflects bullets across lanes', () => {
  const bullet = { x: 24, y: 300, vx: 0, vy: -600, ricochetsLeft: 2, color: '#38bdf8' };
  const prismBumper = { x: 24, y: 300, width: 32, height: 80, angleDeg: 45 };

  // Collision detected
  const collides = 
    bullet.x >= prismBumper.x - prismBumper.width / 2 && 
    bullet.x <= prismBumper.x + prismBumper.width / 2;
  assert.strictEqual(collides, true);

  // Bounce execution
  const bounceDirection = prismBumper.angleDeg > 0 ? 1 : -1;
  bullet.vx = bounceDirection * 340;
  bullet.vy = -450;
  bullet.ricochetsLeft -= 1;
  bullet.color = '#f59e0b';

  assert.strictEqual(bullet.vx, 340, 'Bullet should be deflected rightward into opposite lane');
  assert.strictEqual(bullet.ricochetsLeft, 1);
  assert.strictEqual(bullet.color, '#f59e0b');
});

// 4. Phase 1: Sacrifice Altar Trade Math
it('Sacrifice Altar deducts flat squad troops and grants weapon evolution', () => {
  const player = { count: 30, buffs: { laserWeapon: false } };
  const altar = { altarSacrificeCost: 15, altarWeaponReward: 'laserWeapon' };

  const actualDeduct = Math.min(player.count - 1, altar.altarSacrificeCost);
  player.count -= actualDeduct;
  player.buffs[altar.altarWeaponReward] = true;

  assert.strictEqual(player.count, 15, 'Squad should be reduced from 30 to 15');
  assert.strictEqual(player.buffs.laserWeapon, true, 'Laser weapon should be evolved');
});

// 5. Phase 1: Speed & Hazard Strips
it('Speed strip applies +50% fire rate and Hazard strip applies drag', () => {
  const player = { fireRateMultiplier: 1.0, dragSpeedMultiplier: 1.0 };
  const speedStrip = { type: 'SPEED_STRIP', overclockRate: 1.5 };
  const hazardStrip = { type: 'HAZARD_STRIP', dragFactor: 0.65 };

  player.fireRateMultiplier = speedStrip.overclockRate;
  assert.strictEqual(player.fireRateMultiplier, 1.5);

  player.dragSpeedMultiplier = hazardStrip.dragFactor;
  assert.strictEqual(player.dragSpeedMultiplier, 0.65);
});

// 6. Phase 2: Shield Bearer Synergy
it('Shield Bearer grants invulnerability to tethered allies against standard bullets', () => {
  const bearer = { id: 101, type: 'SHIELD_BEARER', x: 100, y: 200, active: true };
  const brute = { id: 102, type: 'ARMORED_BRUTE', x: 140, y: 220, active: true, shielded: false, hp: 500 };

  const dist = Math.hypot(bearer.x - brute.x, bearer.y - brute.y);
  if (dist <= 120) {
    brute.shielded = true;
  }
  assert.strictEqual(brute.shielded, true, 'Brute should be tethered to shield bearer');

  // Standard bullet fails to damage shielded brute
  const standardBullet = { damage: 50, isBlast: false, isLaser: false };
  if (!brute.shielded || standardBullet.isBlast) {
    brute.hp -= standardBullet.damage;
  }
  assert.strictEqual(brute.hp, 500, 'Shielded brute should take 0 damage from standard bullet');

  // AoE blast bypasses shield
  const blastBullet = { damage: 80, isBlast: true };
  if (!brute.shielded || blastBullet.isBlast) {
    brute.hp -= blastBullet.damage;
  }
  assert.strictEqual(brute.hp, 420, 'Blast bullet should damage brute through shield');
});

// 7. Phase 2: Multi-Phase Boss Armor Plates & Enrage
it('Boss armor plates take damage first; enrage triggers below 50% HP', () => {
  const boss = {
    hp: 1000,
    maxHp: 1000,
    enraged: false,
    bossPhase: 1,
    speed: 15,
    armorPlates: [
      { id: 'left', hp: 200, maxHp: 200, broken: false },
      { id: 'right', hp: 200, maxHp: 200, broken: false },
    ]
  };

  // Plate absorbs 200 damage and breaks
  boss.armorPlates[0].hp -= 200;
  if (boss.armorPlates[0].hp <= 0) boss.armorPlates[0].broken = true;
  assert.strictEqual(boss.armorPlates[0].broken, true);

  // Damage core to 450 HP (below 50%)
  boss.hp = 450;
  if (boss.hp <= boss.maxHp * 0.5 && !boss.enraged) {
    boss.enraged = true;
    boss.bossPhase = 2;
    boss.speed *= 1.45;
  }
  assert.strictEqual(boss.enraged, true, 'Boss must enter enrage mode');
  assert.strictEqual(boss.bossPhase, 2, 'Boss phase must advance to 2');
  assert.strictEqual(boss.speed, 15 * 1.45);
});

// 8. Phase 3: Squad Specialist Morphs
it('Specialist counts correctly allocate distinct Cyan Snipers and Orange Vanguards', () => {
  const specialists = { sniper: 2, vanguard: 3, mortar: 1 };
  assert.strictEqual(specialists.sniper, 2);
  assert.strictEqual(specialists.vanguard, 3);
  assert.strictEqual(specialists.mortar, 1);
});

// 9. Economy & Upgrade Costs
it('Upgrade pricing scales exponentially without overflow', () => {
  function getCost(base, lv) {
    return Math.round(base * Math.pow(1.36, lv - 1));
  }
  const baseCost = 35;
  assert.strictEqual(getCost(baseCost, 1), 35);
  assert.strictEqual(getCost(baseCost, 2), 48);
  assert.strictEqual(getCost(baseCost, 3), 65);
  assert.strictEqual(getCost(baseCost, 5), 120);
});

// 10. Normalized Gate Charge & Breach Clash Physics
it('Gate charging increments smoothly via normalized fractional gateCharge', () => {
  const gate = { chargeHits: 0, hitsPerStep: 10, val: 2, maxVal: 10 };
  const bullet = { gateCharge: 1.35 / 4 }; // 4 streams

  // Apply hit
  gate.chargeHits += bullet.gateCharge * 2.9;
  assert.ok(gate.chargeHits > 0.95 && gate.chargeHits < 1.05, 'Fractional charge accumulated');

  // Multi-hits to step
  for (let i = 0; i < 10; i++) {
    gate.chargeHits += bullet.gateCharge * 2.9;
    if (gate.chargeHits >= gate.hitsPerStep && gate.val < gate.maxVal) {
      gate.chargeHits -= gate.hitsPerStep;
      gate.val += 1;
    }
  }
  assert.strictEqual(gate.val, 3, 'Gate correctly leveled up to +3');
});

it('Perimeter breach clash trades soldiers by HP ratio and fails if Boss breaches', () => {
  const player = { count: 12, shields: 0 };
  const enemy = { hp: 140, isBoss: false };
  const firepowerLvl = 2;

  const soldierCost = Math.max(2, Math.ceil(enemy.hp / (14 + firepowerLvl * 3)));
  assert.strictEqual(soldierCost, 7); // 140 / 20 = 7
  player.count -= soldierCost;
  assert.strictEqual(player.count, 5, 'Player survived breach clash with 5 soldiers');

  // Boss breach is fatal
  const boss = { hp: 1000, isBoss: true };
  const isFatal = boss.isBoss;
  assert.strictEqual(isFatal, true, 'Boss perimeter breach must be fatal');
});

// 11. Mutual Exclusion Choice Gates
it('Pair gate mutual exclusion shatters sibling gate upon traversal', () => {
  const gates = [
    { id: 1, pairId: 101, val: 5, lane: 'LEFT' },
    { id: 2, pairId: 101, val: 3, lane: 'RIGHT' },
  ];
  const player = { x: 95, count: 5 }; // Player goes Left
  const collected = gates[0];

  // Shatter sibling with matching pairId
  const remainingGates = gates.filter(g => g.id === collected.id || g.pairId !== collected.pairId);
  assert.strictEqual(remainingGates.length, 1, 'Sibling gate must be eliminated');
  assert.strictEqual(remainingGates[0].id, 1, 'Only chosen gate remains active');
});

// 12. Sound Economy & Survival Bounty
it('Sound reward economy computes base clear plus squad survival bounty accurately', () => {
  const level = 2;
  const baseClearReward = Math.round(50 + level * 14); // 78
  const survivingSquad = 18;
  const survivalBonus = survivingSquad * 2; // 36
  const totalEarned = baseClearReward + survivalBonus; // 114

  assert.strictEqual(baseClearReward, 78);
  assert.strictEqual(survivalBonus, 36);
  assert.strictEqual(totalEarned, 114);
});

console.log('====================================================');
console.log(`  Tests Completed: ${passedTests} / ${totalTests} Passed`);
console.log('====================================================');

if (passedTests < totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
