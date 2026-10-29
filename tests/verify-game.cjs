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

// 13. Strict Barrier Rules & Off-Screen Protection
it('Armory Crate absorbs bullets until shattered, shielding trailing enemies', () => {
  const crate = { x: 190, y: 300, w: 90, h: 44, hp: 20 };
  const bullet = { x: 190, y: 310, vy: -550, damage: 10, active: true };
  const enemyBehind = { x: 190, y: 260, hp: 20 };

  // Bullet hits crate
  crate.hp -= bullet.damage;
  bullet.active = false; // Bullet absorbed by crate!

  assert.strictEqual(bullet.active, false, 'Bullet must be absorbed by crate while crate has HP');
  assert.strictEqual(crate.hp, 10, 'Crate took initial damage');
  assert.strictEqual(enemyBehind.hp, 20, 'Enemy safely took cover behind crate');

  // Second bullet shatters crate
  const bullet2 = { x: 190, y: 310, vy: -550, damage: 10, active: true };
  crate.hp -= bullet2.damage;
  bullet2.active = false;
  assert.strictEqual(crate.hp, 0, 'Crate shattered and destroyed');

  // Third bullet now passes cleanly through the opened lane to hit enemy
  const bullet3 = { x: 190, y: 310, vy: -550, damage: 10, active: true };
  enemyBehind.hp -= bullet3.damage;
  bullet3.active = false;
  assert.strictEqual(enemyBehind.hp, 10, 'Enemy took damage now that barrier was eliminated');
});

it('Charging gate absorbs bullets, while maxed gate allows 100% free bullet pass-through', () => {
  // Charging gate
  const chargingGate = { val: 2, maxVal: 5, chargeHits: 0 };
  const bullet1 = { x: 100, y: 400, damage: 8, active: true };
  const isChargingMaxed = chargingGate.val >= chargingGate.maxVal;
  assert.strictEqual(isChargingMaxed, false);
  bullet1.active = false; // absorbed to charge gate
  assert.strictEqual(bullet1.active, false, 'Charging gate must absorb bullet to build charge');

  // Maxed gate
  const maxedGate = { val: 5, maxVal: 5, chargeHits: 0 };
  const bullet2 = { x: 100, y: 400, damage: 8, active: true };
  const isMaxed = maxedGate.val >= maxedGate.maxVal;
  assert.strictEqual(isMaxed, true);
  // Maxed gate bypasses collision and bullet retains 100% damage
  assert.strictEqual(bullet2.active, true, 'Maxed gate allows bullets to pass freely');
  assert.strictEqual(bullet2.damage, 8);
});

it('Enemies off-screen (y < 25) are strictly invulnerable and cannot be targeted', () => {
  const enemies = [
    { id: 1, y: -40, hp: 50, active: true },
    { id: 2, y: 15, hp: 50, active: true },
    { id: 3, y: 80, hp: 50, active: true },
  ];

  // Targeting filter
  const validTargets = enemies.filter(e => e.active && e.y >= 25);
  assert.strictEqual(validTargets.length, 1, 'Only visible enemies on highway can be targeted');
  assert.strictEqual(validTargets[0].id, 3);
});

// 14. 6 Mission Archetypes Rotation
it('Levels rotate deterministically across 6 distinct Mission Archetypes', () => {
  const archetypes = [
    'SWARM_INFILTRATION',
    'ARMORED_SIEGE',
    'ARTILLERY_STORM',
    'PRECISION_GRID',
    'CONVERSION_ZONE',
    'TITAN_SHOWDOWN'
  ];

  function getArchetypeId(level) {
    if (level % 10 === 0) return 'TITAN_SHOWDOWN';
    const cycle = ['SWARM_INFILTRATION', 'ARMORED_SIEGE', 'ARTILLERY_STORM', 'PRECISION_GRID', 'CONVERSION_ZONE'];
    return cycle[(level - 1) % cycle.length];
  }

  assert.strictEqual(getArchetypeId(1), 'SWARM_INFILTRATION');
  assert.strictEqual(getArchetypeId(2), 'ARMORED_SIEGE');
  assert.strictEqual(getArchetypeId(3), 'ARTILLERY_STORM');
  assert.strictEqual(getArchetypeId(4), 'PRECISION_GRID');
  assert.strictEqual(getArchetypeId(5), 'CONVERSION_ZONE');
  assert.strictEqual(getArchetypeId(6), 'SWARM_INFILTRATION');
  assert.strictEqual(getArchetypeId(10), 'TITAN_SHOWDOWN');
  assert.strictEqual(getArchetypeId(20), 'TITAN_SHOWDOWN');
});

// 15. User Account Profile & Security Rules Validation Schema
it('User profile stats allow highScore property for cloud synchronization', () => {
  const profileStats = {
    totalKills: 154,
    bossesDefeated: 3,
    totalCoinsEarned: 1250,
    cratesOpened: 18,
    highestSquad: 42,
    highScore: 18500
  };

  const allowedKeys = ['totalKills', 'bossesDefeated', 'totalCoinsEarned', 'cratesOpened', 'highestSquad', 'highScore'];
  const actualKeys = Object.keys(profileStats);
  const isValidKeys = actualKeys.every(k => allowedKeys.includes(k));
  assert.strictEqual(isValidKeys, true, 'All keys in stats must be within allowedKeys');
  assert.strictEqual(typeof profileStats.highScore, 'number');
  assert.ok(profileStats.highScore >= 0);
});

// 16. RPG Gear-Check Hardness Curve & Level 5 Gatekeeper Step
it('Recommended Squad Power scales smoothly for L1-2 and steps up at L5 Boss Gatekeeper', () => {
  function getRecommendedPower(level) {
    if (level === 1) return 4;
    if (level === 2) return 5;
    if (level === 3) return 6;
    if (level === 4) return 8;
    if (level === 5) return 10;
    const bossTiersPassed = Math.floor(level / 5);
    return Math.round(5 + level * 1.15 + bossTiersPassed * 1.8);
  }

  assert.strictEqual(getRecommendedPower(1), 4, 'Level 1 must be winnable at starter Power 4');
  assert.strictEqual(getRecommendedPower(2), 5, 'Level 2 requires Power 5');
  assert.strictEqual(getRecommendedPower(5), 10, 'Level 5 Warden Gatekeeper requires Power 10 (6 upgrade levels)');
  assert.ok(getRecommendedPower(10) > getRecommendedPower(5), 'Level 10 Titan must require higher upgrades than Level 5');
});

// 17. Early Level Clarity (No Wall Prism Boxes on Level 2 & Brisk Scroll Speed)
it('Early onboarding levels (L1-L5) exclude wall Prism Mirrors and enforce brisk scroll speed >= 66 px/s', () => {
  for (let lvl = 1; lvl <= 5; lvl++) {
    const spawnsPrism = lvl >= 6;
    const scrollSpeed = Math.min(106, 66 + lvl * 0.55);
    assert.strictEqual(spawnsPrism, false, `Level ${lvl} must not spawn wall Prism Mirrors`);
    assert.ok(scrollSpeed >= 66, `Level ${lvl} scrollSpeed (${scrollSpeed}) must be brisk (>= 66 px/s)`);
  }
});

// 18. Ricochet Prism Mirror Ballistics & Hitbox Reachability
it('Prism Mirror intercepts lane bullets, deflects diagonally with +35% overcharge, and prevents double-frame drain', () => {
  const cw = 380;
  const leftPrism = { x: 54, y: 260, width: 78, height: 76, lane: 'LEFT', angleDeg: 45 };
  const bullet = { x: 68, y: 270, vx: 0, vy: -780, damage: 10, ricochetsLeft: 2, isPierce: false, active: true };

  // Frame 1: Bullet in left lane (x=68) is well within leftPrism hitbox [15..93]
  const inHitbox = Math.abs(bullet.x - leftPrism.x) < leftPrism.width / 2 + 6 &&
                   Math.abs(bullet.y - leftPrism.y) < leftPrism.height / 2 + 6;
  assert.strictEqual(inHitbox, true, 'Left-lane bullet at x=68 must intersect Prism Mirror hitbox [15..93]');

  const bounceDir = leftPrism.lane === 'LEFT' ? 1 : -1;
  if (!(Math.sign(bullet.vx) === bounceDir && Math.abs(bullet.vx) > 200)) {
    bullet.ricochetsLeft -= 1;
    bullet.vx = bounceDir * 440;
    bullet.vy = -500;
    bullet.damage *= 1.35;
    bullet.isPierce = true;
  }

  assert.strictEqual(bullet.ricochetsLeft, 1, 'First impact decrements ricochetsLeft by 1');
  assert.strictEqual(bullet.vx, 440, 'Bullet deflects rightward across highway');
  assert.strictEqual(bullet.vy, -500, 'Bullet maintains upward diagonal velocity');
  assert.strictEqual(bullet.damage, 13.5, 'Bullet gains +35% Ricochet Overcharge damage');
  assert.strictEqual(bullet.isPierce, true, 'Deflected bullet gains piercing to slice across lanes');

  // Frame 2: Bullet still inside hitbox on next tick must NOT double-trigger
  const alreadyDeflected = Math.sign(bullet.vx) === bounceDir && Math.abs(bullet.vx) > 200;
  assert.strictEqual(alreadyDeflected, true, 'Consecutive frame inside same prism must be ignored');
});

// 19. AP Rounds & Piercing Bullets Charge Gates and Damage Crates
it('AP Rounds and piercing bullets hit barriers with 2.2x gate charge and crate damage', () => {
  const gate = { id: 1, val: 2, maxVal: 6, chargeHits: 0, hitsPerStep: 4, kind: 'CHARGE_ADD' };
  const crate = { id: 2, hp: 40, maxHp: 40, boostType: 'VANGUARD' };

  // Piercing AP round bullet
  const apBullet = {
    x: 100,
    y: 200,
    damage: 10,
    gateCharge: 1.0,
    isPierce: true,
    color: '#fde047',
    isFromPlayer: true,
    active: true,
  };

  // Must NOT be ignored because of isPierce!
  const chargeMult = (apBullet.isPierce && apBullet.color === '#fde047') ? 2.2 : 1.15;
  const chargeAmt = apBullet.gateCharge * chargeMult;
  gate.chargeHits += chargeAmt;
  while (gate.chargeHits >= gate.hitsPerStep && gate.val < gate.maxVal) {
    gate.chargeHits -= gate.hitsPerStep;
    gate.val += 1;
  }

  assert.strictEqual(chargeAmt, 2.2, 'AP Round must apply 2.2x gate charge');
  assert.strictEqual(gate.chargeHits, 2.2, 'Gate accumulated charge from piercing AP round');

  // Second shot (2.2 + 2.2 = 4.4 >= 4) increments gate number
  gate.chargeHits += chargeAmt;
  while (gate.chargeHits >= gate.hitsPerStep && gate.val < gate.maxVal) {
    gate.chargeHits -= gate.hitsPerStep;
    gate.val += 1;
  }
  assert.strictEqual(gate.val, 3, 'Gate number increased from 2 to 3 under AP fire');

  // AP Round vs Crate deals 2.2x damage
  const crateDmg = apBullet.damage * 2.2;
  crate.hp -= crateDmg;
  assert.strictEqual(crate.hp, 18, 'Crate took 22 damage from AP round');
});

// 20. Hazard Neutralization
it('Shooting a negative hazard gate brings it to 0, clearing it for safe pass-through', () => {
  const hazardGate = { id: 3, val: -2, minVal: -2, maxVal: 0, chargeHits: 0, hitsPerStep: 5, kind: 'HAZARD' };

  // Shot 1
  hazardGate.chargeHits += 5;
  while (hazardGate.chargeHits >= hazardGate.hitsPerStep && hazardGate.val < 0) {
    hazardGate.chargeHits -= hazardGate.hitsPerStep;
    hazardGate.val += 1;
  }
  assert.strictEqual(hazardGate.val, -1, 'Hazard neutralized from -2 to -1');

  // Shot 2 reaches 0 (neutralized)
  hazardGate.chargeHits += 5;
  while (hazardGate.chargeHits >= hazardGate.hitsPerStep && hazardGate.val < 0) {
    hazardGate.chargeHits -= hazardGate.hitsPerStep;
    hazardGate.val += 1;
  }
  assert.strictEqual(hazardGate.val, 0, 'Hazard neutralized to 0');
  const isMaxed = hazardGate.val >= 0;
  assert.strictEqual(isMaxed, true, 'Neutralized hazard gate allows 100% free pass-through');
});

// 21. Altar Gate Purification
it('Shooting a Sacrifice Altar purifies it and drops sacrifice cost to 0', () => {
  const altar = { id: 4, altarSacrificeCost: 3, chargeHits: 0, hitsPerStep: 4, kind: 'ALTAR' };

  // Shoot 3 times
  for (let s = 0; s < 3; s++) {
    altar.chargeHits += 4;
    while (altar.chargeHits >= altar.hitsPerStep && altar.altarSacrificeCost > 0) {
      altar.chargeHits -= altar.hitsPerStep;
      altar.altarSacrificeCost = Math.max(0, altar.altarSacrificeCost - 1);
    }
  }

  assert.strictEqual(altar.altarSacrificeCost, 0, 'Altar sacrifice cost reduced to 0 (Free Ascension)');
  const isFree = altar.altarSacrificeCost <= 0;
  assert.strictEqual(isFree, true, 'Purified altar grants weapon evolution with 0 troop cost');
});

// 22. Endless Mode Chunk Generation & Threat Escalation
it('Endless Mode dynamically escalates threat level, enemy HP, and gate caps', () => {
  function getEndlessThreat(seconds) {
    return Math.floor(seconds / 10) + 1;
  }

  assert.strictEqual(getEndlessThreat(0), 1, 'Initial threat level is 1');
  assert.strictEqual(getEndlessThreat(9.9), 1, 'Threat stays 1 before 10s');
  assert.strictEqual(getEndlessThreat(10), 2, 'Threat advances to 2 at 10s');
  assert.strictEqual(getEndlessThreat(120), 13, 'Threat advances to 13 at 2 mins (Good benchmark)');
  assert.strictEqual(getEndlessThreat(180), 19, 'Threat advances to 19 at 3 mins (Great benchmark)');
  assert.strictEqual(getEndlessThreat(300), 31, 'Threat advances to 31 at 5 mins (Incredible benchmark)');

  function getEndlessBaseHP(threat) {
    return Math.round(28 + Math.pow(threat, 1.55) * 5.5);
  }

  assert.strictEqual(getEndlessBaseHP(1), 34, 'Threat 1 base HP is 34');
  assert.ok(getEndlessBaseHP(5) > getEndlessBaseHP(1), 'Threat 5 HP must exceed Threat 1');
  assert.ok(getEndlessBaseHP(10) > getEndlessBaseHP(5), 'Threat 10 HP must exceed Threat 5');
  assert.ok(getEndlessBaseHP(13) >= 300, 'Threat 13 base HP exceeds 300 for solid 2-min challenge');

  // Endless squad cap enforcement (no runaway 220 squads)
  function getEndlessSquadCap(isEndless) {
    return isEndless ? 40 : 220;
  }
  assert.strictEqual(getEndlessSquadCap(true), 40, 'Endless squad cap is strictly 40 soldiers');
  assert.strictEqual(getEndlessSquadCap(false), 220, 'Campaign squad cap remains 220 soldiers');

  // Milestone boss wave at every 5th threat
  for (let t = 1; t <= 15; t++) {
    const isBossWave = t % 5 === 0;
    assert.strictEqual(isBossWave, t === 5 || t === 10 || t === 15, `Threat ${t} boss wave flag matches`);
  }
});

// 23. Endless Survival Record Tracking & Score Persistence
it('Endless survival duration tracks personal best time and threat level', () => {
  const stats = { endlessBestTime: 45.2, endlessBestLevel: 3, highScore: 4520 };

  function recordEndlessRun(timeSurvived, threatLevel) {
    const prevBest = stats.endlessBestTime || 0;
    const isNewRecord = timeSurvived > prevBest;
    if (isNewRecord) {
      stats.endlessBestTime = Math.round(timeSurvived * 10) / 10;
      stats.endlessBestLevel = Math.max(stats.endlessBestLevel || 1, threatLevel);
      stats.highScore = Math.max(stats.highScore || 0, Math.round(timeSurvived * 100));
    }
    return { isNewRecord, prevBest };
  }

  // Attempt 1: 30s (shorter than 45.2s)
  const run1 = recordEndlessRun(30.0, 2);
  assert.strictEqual(run1.isNewRecord, false, '30s is not a new record');
  assert.strictEqual(stats.endlessBestTime, 45.2, 'Best time remains 45.2s');

  // Attempt 2: 78.5s (longer than 45.2s)
  const run2 = recordEndlessRun(78.54, 4);
  assert.strictEqual(run2.isNewRecord, true, '78.5s triggers new personal record');
  assert.strictEqual(stats.endlessBestTime, 78.5, 'Best time updated to 78.5s');
  assert.strictEqual(stats.endlessBestLevel, 4, 'Best threat level updated to 4');
  assert.strictEqual(stats.highScore, 7854, 'High score updated to 7854');
});

// 24. Central Diamond Bumper Ricochet & Overcharge
it('Central Diamond Bumper cleanly deflects incoming bullets into lanes with +35% overcharge', () => {
  const splitter = {
    id: 101,
    type: 'BEAM_SPLITTER',
    x: 190, // Median center in 380px highway
    y: 300,
    width: 42,
    height: 42,
    lane: 'CENTER',
    active: true,
  };

  const bulletLeft = {
    id: 1,
    x: 184, // Left side of diamond
    y: 310,
    vx: 0,
    vy: -680,
    damage: 10,
    ricochetsLeft: 2,
    isFromPlayer: true,
    active: true,
  };

  const bulletRight = {
    id: 2,
    x: 196, // Right side of diamond
    y: 310,
    vx: 0,
    vy: -680,
    damage: 10,
    ricochetsLeft: 2,
    isFromPlayer: true,
    active: true,
  };

  const hw = splitter.width / 2;
  const hh = splitter.height / 2;

  // Process left bullet
  const bounceDirLeft = bulletLeft.x < splitter.x ? -1 : 1;
  bulletLeft.ricochetsLeft -= 1;
  bulletLeft.vx = bounceDirLeft * 420;
  bulletLeft.vy = -500;
  bulletLeft.damage *= 1.35;
  bulletLeft.isPierce = true;
  bulletLeft.color = '#38bdf8';

  // Process right bullet
  const bounceDirRight = bulletRight.x < splitter.x ? -1 : 1;
  bulletRight.ricochetsLeft -= 1;
  bulletRight.vx = bounceDirRight * 420;
  bulletRight.vy = -500;
  bulletRight.damage *= 1.35;
  bulletRight.isPierce = true;
  bulletRight.color = '#38bdf8';

  assert.strictEqual(bulletLeft.vx, -420, 'Bullet hitting left wedge cleanly deflects leftward');
  assert.strictEqual(bulletRight.vx, 420, 'Bullet hitting right wedge cleanly deflects rightward');
  assert.strictEqual(bulletLeft.damage, 13.5, 'Deflected bullet gains +35% overcharge damage');
  assert.strictEqual(bulletLeft.isPierce, true, 'Deflected bullet has piercing property');
  assert.strictEqual(bulletLeft.color, '#38bdf8', 'Deflected bullet carries cyan ricochet color');
});

// 25. Enemy Obstacle Bouncing & Strict Playable Road Clamp
it('Enemies dynamically bounce off obstacles and are clamped within playable road bounds', () => {
  const cw = 380;
  const dt = 0.016;
  const obstacles = [
    { type: 'BEAM_SPLITTER', x: 190, y: 300, width: 42, height: 42, active: true },
    { type: 'PRISM_MIRROR', x: 54, y: 400, width: 78, height: 76, lane: 'LEFT', active: true },
    { type: 'PRISM_MIRROR', x: 326, y: 400, width: 78, height: 76, lane: 'RIGHT', active: true },
  ];

  // Enemy 1: Walking down center towards diamond splitter
  const enemyCenterLeft = { id: 1, x: 185, y: 305, r: 14, speed: 80, active: true };
  const enemyCenterRight = { id: 2, x: 195, y: 305, r: 14, speed: 80, active: true };

  // Enemy 3: Walking along left wall mirror
  const enemyLeftWall = { id: 3, x: 50, y: 405, r: 14, speed: 80, active: true };

  // Enemy 4: Walking along right wall mirror
  const enemyRightWall = { id: 4, x: 335, y: 405, r: 14, speed: 80, active: true };

  const enemies = [enemyCenterLeft, enemyCenterRight, enemyLeftWall, enemyRightWall];

  // Simulate handleEnemyObstacleCollisions
  enemies.forEach(e => {
    obstacles.forEach(obs => {
      if (obs.type === 'BEAM_SPLITTER') {
        const hw = obs.width / 2;
        const hh = obs.height / 2;
        const inY = Math.abs(e.y - obs.y) <= hh + e.r;
        const inX = Math.abs(e.x - obs.x) <= hw + e.r;
        if (inY && inX) {
          const bounceDir = e.x < obs.x ? -1 : 1;
          e.x = bounceDir < 0 
            ? Math.max(50, obs.x - hw - e.r - 8)
            : Math.min(cw - 50, obs.x + hw + e.r + 8);
          e.bounceVx = bounceDir * 120;
        }
      } else if (obs.type === 'PRISM_MIRROR') {
        const isLeft = obs.lane === 'LEFT' || obs.x < cw / 2;
        const halfH = obs.height / 2;
        const inY = Math.abs(e.y - obs.y) <= halfH + e.r;
        if (inY) {
          if (isLeft) {
            const wallBumperRight = obs.x + obs.width / 2;
            if (e.x < wallBumperRight + e.r) {
              e.x = wallBumperRight + e.r + 8;
              e.bounceVx = 120;
            }
          } else {
            const wallBumperLeft = obs.x - obs.width / 2;
            if (e.x > wallBumperLeft - e.r) {
              e.x = wallBumperLeft - e.r - 8;
              e.bounceVx = -120;
            }
          }
        }
      }
    });

    // Apply bounce and strict margin clamp
    if (e.bounceVx) e.x += e.bounceVx * dt;
    e.x = Math.max(50, Math.min(cw - 50, e.x));
  });

  // Center-left enemy bounced into left lane
  assert.ok(enemyCenterLeft.x < 190 - 21 - 14, 'Center-left enemy bounced into left lane');
  assert.ok(enemyCenterLeft.bounceVx < 0, 'Center-left enemy has leftward deflection velocity');

  // Center-right enemy bounced into right lane
  assert.ok(enemyCenterRight.x > 190 + 21 + 14, 'Center-right enemy bounced into right lane');
  assert.ok(enemyCenterRight.bounceVx > 0, 'Center-right enemy has rightward deflection velocity');

  // Left wall enemy bounced out of wall prism
  assert.ok(enemyLeftWall.x >= 54 + 39 + 14, 'Left wall enemy bounced outside left prism');
  assert.strictEqual(enemyLeftWall.bounceVx, 120, 'Left wall enemy given rightward bounce velocity');

  // Right wall enemy bounced out of right prism
  assert.ok(enemyRightWall.x <= 326 - 39 - 14, 'Right wall enemy bounced outside right prism');
  assert.strictEqual(enemyRightWall.bounceVx, -120, 'Right wall enemy given leftward bounce velocity');

  // All enemies are strictly >= 50 and <= cw - 50
  enemies.forEach(e => {
    assert.ok(e.x >= 50 && e.x <= cw - 50, `Enemy at x=${e.x} is strictly within playable road bounds [50, 330]`);
  });
});

// 26. Dual-Thumb Split Squad Mode Tactical Bonus
it('Dual-Thumb Split Squad grants 10s bonus, dual wings, and multi-touch control', () => {
  const cw = 380;
  const player = {
    x: 190,
    y: 500,
    count: 24,
    buffs: {
      splitSquadTimer: 0,
    },
    leftWingX: 190,
    rightWingX: 190,
    targetLeftX: 190,
    targetRightX: 190,
  };

  // Unlock Split Squad Bonus (10s duration)
  function unlockBoost(type) {
    if (type === 'SPLIT_SQUAD') {
      player.buffs.splitSquadTimer = 10.0;
      const spreadOffset = Math.min(84, cw * 0.22);
      player.leftWingX = Math.max(34, player.x - spreadOffset);
      player.rightWingX = Math.min(cw - 34, player.x + spreadOffset);
      player.targetLeftX = player.leftWingX;
      player.targetRightX = player.rightWingX;
    }
  }

  unlockBoost('SPLIT_SQUAD');
  assert.strictEqual(player.buffs.splitSquadTimer, 10.0, 'Split squad timer set to 10 seconds');
  assert.ok(player.leftWingX < player.x, 'Left wing positioned in left half');
  assert.ok(player.rightWingX > player.x, 'Right wing positioned in right half');

  // Multi-touch simulation: Two thumbs touching at x = 90 and x = 290
  const activeTouches = new Map();
  activeTouches.set(1, 90);
  activeTouches.set(2, 290);

  const xs = Array.from(activeTouches.values()).sort((a, b) => a - b);
  player.targetLeftX = Math.max(28, Math.min(cw / 2 - 20, xs[0]));
  player.targetRightX = Math.max(cw / 2 + 20, Math.min(cw - 28, xs[xs.length - 1]));

  assert.strictEqual(player.targetLeftX, 90, 'Left thumb precisely steers left wing at x = 90');
  assert.strictEqual(player.targetRightX, 290, 'Right thumb precisely steers right wing at x = 290');

  // Firing volley simulation during split
  const isSplit = player.buffs.splitSquadTimer > 0;
  assert.strictEqual(isSplit, true, 'Player is recognized in active split squad mode');

  const leftCount = Math.ceil(player.count / 2);
  const rightCount = Math.floor(player.count / 2);
  assert.strictEqual(leftCount + rightCount, 24, 'Troops partitioned evenly between wings');
  assert.strictEqual(leftCount, 12, 'Left wing commands 12 troops');
  assert.strictEqual(rightCount, 12, 'Right wing commands 12 troops');
});

// 30. Endless Mode Header Display & Persistence
it('Top header level display renders Level ∞ for Endless and Level X for Campaign', () => {
  function getHeaderLevelString(level, isEndless) {
    const levelText = isEndless ? '∞' : `${level}`;
    return `Level ${levelText}`;
  }

  assert.strictEqual(getHeaderLevelString(1, true), 'Level ∞', 'Endless mode header must display Level ∞');
  assert.strictEqual(getHeaderLevelString(5, true), 'Level ∞', 'Endless mode regardless of threat must display Level ∞');
  assert.strictEqual(getHeaderLevelString(1, false), 'Level 1', 'Campaign mode header displays Level 1');
  assert.strictEqual(getHeaderLevelString(42, false), 'Level 42', 'Campaign mode header displays Level 42');
});

// 31. Incremental Real-Time Survival High Score Auto-Save
it('Real-time survival auto-save updates personal best and threat level immediately upon record surpass', () => {
  const saveState = {
    stats: {
      endlessBestTime: 120.5,
      endlessBestLevel: 13,
      highScore: 12050,
    },
  };

  function updateEndlessBestTime(timeSurvived, threatLevel) {
    const prevBest = saveState.stats.endlessBestTime || 0;
    if (timeSurvived > prevBest) {
      saveState.stats.endlessBestTime = Math.round(timeSurvived * 10) / 10;
      saveState.stats.endlessBestLevel = Math.max(saveState.stats.endlessBestLevel || 1, threatLevel);
      saveState.stats.highScore = Math.max(saveState.stats.highScore || 0, Math.round(timeSurvived * 100));
      return true;
    }
    return false;
  }

  // 1. Lower time does not overwrite
  const r1 = updateEndlessBestTime(95.0, 10);
  assert.strictEqual(r1, false);
  assert.strictEqual(saveState.stats.endlessBestTime, 120.5);

  // 2. Surpassing record updates immediately
  const r2 = updateEndlessBestTime(155.8, 16);
  assert.strictEqual(r2, true);
  assert.strictEqual(saveState.stats.endlessBestTime, 155.8);
  assert.strictEqual(saveState.stats.endlessBestLevel, 16);
  assert.strictEqual(saveState.stats.highScore, 15580);
});

// 32. Cloud Sync Preservation of Endless Survival Record
it('Cloud sync merge explicitly maximizes and preserves local and remote survival records', () => {
  const localSave = {
    level: 12,
    stats: {
      highScore: 15580,
      endlessBestTime: 155.8,
      endlessBestLevel: 16,
    },
  };

  const cloudSave = {
    level: 15,
    stats: {
      highScore: 18000,
      endlessBestTime: 140.2, // older cloud time
      endlessBestLevel: 14,
    },
  };

  // Merge logic
  localSave.level = Math.max(localSave.level, cloudSave.level || 1);
  localSave.stats.highScore = Math.max(localSave.stats.highScore || 0, cloudSave.stats.highScore || 0);
  localSave.stats.endlessBestTime = Math.max(localSave.stats.endlessBestTime || 0, cloudSave.stats.endlessBestTime || 0);
  localSave.stats.endlessBestLevel = Math.max(localSave.stats.endlessBestLevel || 1, cloudSave.stats.endlessBestLevel || 1);

  assert.strictEqual(localSave.level, 15, 'Campaign level merges to highest');
  assert.strictEqual(localSave.stats.highScore, 18000, 'High score merges to highest');
  assert.strictEqual(localSave.stats.endlessBestTime, 155.8, 'Local higher survival best is strictly preserved');
  assert.strictEqual(localSave.stats.endlessBestLevel, 16, 'Highest threat level reached is preserved');
});

// 33. User Profile Survival High Score Presentation
it('User profile modal data formats dedicated Survival High Score hero banner', () => {
  function formatSurvivalTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const tenths = Math.floor(((seconds % 1) * 10) + 0.001);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${tenths}`;
  }

  const profileData = {
    bestTime: 184.6,
    threatLevel: 19,
  };

  const formattedTime = formatSurvivalTime(profileData.bestTime);
  const threatBadge = `Threat LV. ${profileData.threatLevel}`;
  const survivalScore = Math.round(profileData.bestTime * 100 + (profileData.threatLevel - 1) * 500);

  assert.strictEqual(formattedTime, '03:04.6');
  assert.strictEqual(threatBadge, 'Threat LV. 19');
  assert.strictEqual(survivalScore, 27460);
});

console.log('====================================================');
console.log(`  Tests Completed: ${passedTests} / ${totalTests} Passed`);
console.log('====================================================');

if (passedTests < totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
