// Squad Surge: 100-Level Tactical Wave, Distinct Opening Formations & RPG Gear-Check Generator
import { 
  LevelPlan, 
  GateQueueItem, 
  CrateQueueItem, 
  EnemyScheduleItem, 
  ObstacleQueueItem, 
  Enemy, 
  EnemyType, 
  SectorId,
  MissionArchetypeConfig 
} from '../types/game';
import { SECTOR_BIOMES, getSectorForLevel } from '../constants/biomes';

export class WaveGenerator {
  private static nextEnemySeq: number = 1;

  /**
   * Computes the Recommended Squad Power (sum of 4 upgrade levels; base = 4)
   * required to comfortably clear a given level.
   * Levels 1-2: Onboarding (Power 4-5)
   * Levels 3-4: Tactical Escalation (Power 6-8)
   * Level 5: First Competitive Gear-Check Boss (Power 10)
   * Every 5 levels thereafter adds a Boss Gear-Check step requiring upgrade farming.
   */
  public static getRecommendedPower(level: number): number {
    if (level === 1) return 4;
    if (level === 2) return 5;
    if (level === 3) return 6;
    if (level === 4) return 8;
    if (level === 5) return 10; // Level 5 Competitive Gatekeeper Step
    const bossTiersPassed = Math.floor(level / 5);
    return Math.round(5 + level * 1.15 + bossTiersPassed * 1.8);
  }

  public static generate(level: number, cw: number = 380): LevelPlan {
    this.nextEnemySeq = 1;
    const sector: SectorId = getSectorForLevel(level);
    const biome = SECTOR_BIOMES[sector];

    const isTitan = level % 10 === 0;
    const isWarden = !isTitan && (level % 5 === 0);
    const isBossLevel = isTitan || isWarden;
    const tier = level >= 70 ? 5 : level >= 45 ? 4 : level >= 25 ? 3 : level >= 10 ? 2 : 1;
    const recommendedPower = this.getRecommendedPower(level);

    // Determine Distinct Mission Archetype
    let archetype: MissionArchetypeConfig;
    if (isTitan) {
      archetype = {
        id: 'TITAN_SHOWDOWN',
        badge: '☠️ TITAN GEAR-CHECK',
        badgeColor: '#ef4444',
        title: `TITAN SHOWDOWN #${Math.max(1, Math.floor(level / 10))}`,
        advisory: `Major Gear-Check Boss! Shatter the left/right armor plates first and detonate Phase 2 mines against the hull. (Rec. Power: ${recommendedPower})`,
        featuredBuff: 'AP ROUNDS'
      };
    } else if (isWarden) {
      archetype = {
        id: 'TITAN_SHOWDOWN',
        badge: '👑 WARDEN GATEKEEPER',
        badgeColor: '#ec4899',
        title: `WARDEN GATEKEEPER LV.${level}`,
        advisory: `Competitive Milestone Boss! Requires upgraded Firepower & Squad Size to breach the Warden's armored phalanx. Replay earlier levels if you need gold!`,
        featuredBuff: 'AP ROUNDS'
      };
    } else {
      const mode = (level - 1) % 5;
      if (mode === 0) {
        archetype = {
          id: 'SWARM_INFILTRATION',
          badge: '⚡ SWARM INFILTRATION',
          badgeColor: '#fb923c',
          title: level === 1 ? `Highway Recon Bootcamp` : `Rapid Sprinter Infiltration`,
          advisory: level === 1
            ? 'Eliminate advancing recon scouts while shooting +Squad gates to grow your volley width!'
            : 'High-speed sprinters rush in staggered flanks. Slide laterally to intercept and unlock Shotgun Vanguards!',
          featuredBuff: 'VANGUARD SHOTGUNS'
        };
      } else if (mode === 1) {
        archetype = {
          id: 'ARMORED_SIEGE',
          badge: '🛡️ BARRICADE SIEGE',
          badgeColor: '#38bdf8',
          title: level === 2 ? `Barricade Cover Ambush` : `Heavy Armor Phalanx`,
          advisory: level === 2
            ? 'Enemies take cover behind Armory Crates and unmaxed barriers! Focus fire to shatter crates and expose hidden troops.'
            : 'Armored Brutes and Shield Bearers advance behind heavy barriers. Bank shots off wall Ricochet Bumpers and claim AP Rounds!',
          featuredBuff: 'AP ROUNDS'
        };
      } else if (mode === 2) {
        archetype = {
          id: 'ARTILLERY_STORM',
          badge: '🎯 ARTILLERY BARRAGE',
          badgeColor: '#c084fc',
          title: `Trench Mortar Outpost`,
          advisory: 'Backline artillery lob mortar shells while Explosive Mines drift down-lane. Detonate mines near enemy squads for massive AoE damage!',
          featuredBuff: 'EMP MORTARS'
        };
      } else if (mode === 3) {
        archetype = {
          id: 'PRECISION_GRID',
          badge: '⚡ PRECISION GRID',
          badgeColor: '#fde047',
          title: `Overclock Highway Blitz`,
          advisory: 'Sliding gates and Overclock Speed Strips test your positioning. Stand on blue Speed Strips for +50% fire rate to break heavy waves!',
          featuredBuff: 'SPEED STRIPS'
        };
      } else {
        archetype = {
          id: 'CONVERSION_ZONE',
          badge: '🔮 CONVERSION ALTAR',
          badgeColor: '#a855f7',
          title: `High-Risk Weapon Evolution`,
          advisory: 'Build up your squad count first, then sacrifice troops at the purple Altar to permanently evolve Piercing Lasers or Homing Missiles!',
          featuredBuff: 'WEAPON EVOLUTION'
        };
      }
    }

    // Wave Count Progression: L1 = 2 brisk waves, L2-3 = 2 waves, L4 = 3 waves, L5+ = 3 to 6 waves
    const waveCount = level <= 3 ? 2 : Math.min(6, 3 + Math.floor(level / 9));

    // RPG Gear-Check Enemy HP Curve:
    // L1-L2: Accessible onboarding (15 -> 20 HP)
    // L3-L4: Tactical step-up (28 -> 38 HP)
    // L5: Competitive Gatekeeper step (54 HP + Armored Boss Phalanx!)
    // Every 5 levels adds a Gear-Check multiplier so players must upgrade to progress.
    const bossGateSteps = Math.floor(level / 5);
    let baseEnemyHP: number;
    if (level === 1) baseEnemyHP = 15;
    else if (level === 2) baseEnemyHP = 20;
    else if (level === 3) baseEnemyHP = 28;
    else if (level === 4) baseEnemyHP = 38;
    else if (level === 5) baseEnemyHP = 54; // Competitive Step Up at Level 5!
    else {
      const linearAndPower = 1 + (level - 1) * 0.16 + Math.pow(level - 1, 1.48) * 0.028;
      const gearCheckBoost = 1 + bossGateSteps * 0.22;
      baseEnemyHP = Math.round(16 * linearAndPower * gearCheckBoost);
    }

    // Brisk Highway Scroll Speed (67 px/s on L1 up to 106 px/s — enemies never sit still!)
    const scrollSpeed = Math.min(106, 66 + level * 0.55);

    // Meaningful Gate Caps & Charge Durability (Requires sustained volleys to charge/unlock)
    const maxAddCap = level <= 2 ? 6 : Math.min(24, 6 + Math.floor(level * 0.25));
    const hitsPerIncrement = level === 1 ? 6 : Math.min(22, Math.round(7 + level * 0.45));

    const gateQueue: GateQueueItem[] = [];
    const crateQueue: CrateQueueItem[] = [];
    const enemySchedule: EnemyScheduleItem[] = [];
    const obstacleQueue: ObstacleQueueItem[] = [];

    // =========================================================================
    // DISTINCT OPENING FORMATIONS (t = 0.15s — Every Level Starts Differently!)
    // =========================================================================
    let cursorTime = 0.15;
    const openFlip = level % 2; // 0 or 1

    if (archetype.id === 'SWARM_INFILTRATION') {
      // OPENING A: Immediate V-Wedge Recon Skirmish (Enemies on screen immediately!)
      const vPositions = [0.5, 0.26, 0.74];
      vPositions.forEach((xNorm, idx) => {
        const isFast = level >= 2 && idx > 0;
        const hp = Math.round(baseEnemyHP * (isFast ? 0.75 : 0.90));
        enemySchedule.push({
          spawnTime: 0.15 + idx * 0.28,
          xNorm,
          kind: isFast ? 'SPRINTER' : 'RUNNER',
          hp,
          maxHp: hp,
          speedMult: isFast ? 1.65 : 1.18,
        });
      });
      cursorTime = 1.35;
    } else if (archetype.id === 'ARMORED_SIEGE') {
      // OPENING B: Barricade Cover Ambush (Crate in front + Enemies marching right behind it!)
      const coverLane3 = openFlip === 0 ? 0 : 2; // Left or Right third
      const coverXNorm = (coverLane3 + 0.5) / 3;
      const flankXNorm = openFlip === 0 ? 0.78 : 0.22;
      const openCrateHP = Math.round(baseEnemyHP * 2.1);

      crateQueue.push({
        spawnTime: 0.15,
        lane3: coverLane3,
        hp: openCrateHP,
        maxHp: openCrateHP,
        boostType: 'AP',
        label: '⚡ AP ROUNDS (2.5x vs 🛡️)',
        color: '#fde047',
      });

      // Two enemies marching directly behind the crate using it as a shield!
      for (let k = 0; k < 2; k++) {
        const useBrute = level >= 4 && k === 0;
        const hp = Math.round(baseEnemyHP * (useBrute ? 1.8 : 1.0));
        enemySchedule.push({
          spawnTime: 0.55 + k * 0.55,
          xNorm: coverXNorm + (k === 0 ? -0.04 : 0.04),
          kind: useBrute ? 'BRUTE' : 'RUNNER',
          hp,
          maxHp: hp,
          speedMult: 1.05,
        });
      }

      // Fast Sprinter rushing the opposite unshielded lane!
      const sHp = Math.round(baseEnemyHP * 0.75);
      enemySchedule.push({
        spawnTime: 0.45,
        xNorm: flankXNorm,
        kind: 'SPRINTER',
        hp: sHp,
        maxHp: sHp,
        speedMult: 1.60,
      });

      cursorTime = 1.95;
    } else if (archetype.id === 'ARTILLERY_STORM') {
      // OPENING C: Mortar Outpost & Volatile Minefield
      const mineHp = Math.round(baseEnemyHP * 0.85);
      enemySchedule.push({
        spawnTime: 0.15,
        xNorm: 0.50,
        kind: 'MINE',
        hp: mineHp,
        maxHp: mineHp,
        speedMult: 1.15,
      });
      // Flanking Artillery Shooters & Escorts
      [0.24, 0.76].forEach((xNorm, idx) => {
        const shHp = Math.round(baseEnemyHP * 1.25);
        enemySchedule.push({
          spawnTime: 0.30 + idx * 0.25,
          xNorm,
          kind: 'SHOOTER',
          hp: shHp,
          maxHp: shHp,
          speedMult: 1.0,
        });
      });
      cursorTime = 1.75;
    } else if (archetype.id === 'PRECISION_GRID') {
      // OPENING D: Overclock Speed Strip + Pincer Assault
      obstacleQueue.push({
        spawnTime: 0.15,
        type: 'SPEED_STRIP',
        lane: openFlip === 0 ? 'LEFT' : 'RIGHT',
        angleDeg: 0,
        overclockRate: 1.5,
        dragFactor: 1.0,
      });
      [0.22, 0.50, 0.78].forEach((xNorm, idx) => {
        const isBrute = idx === 1;
        const hp = Math.round(baseEnemyHP * (isBrute ? 1.85 : 0.85));
        enemySchedule.push({
          spawnTime: 0.20 + idx * 0.22,
          xNorm,
          kind: isBrute ? 'BRUTE' : 'SPRINTER',
          hp,
          maxHp: hp,
          speedMult: isBrute ? 0.98 : 1.70,
        });
      });
      cursorTime = 1.65;
    } else if (isBossLevel) {
      // OPENING E: Gatekeeper Armored Honor Guard (Level 5, 10, 15...)
      // Immediately tests whether the player has upgraded their squad!
      [0.28, 0.72].forEach((xNorm, idx) => {
        const bHp = Math.round(baseEnemyHP * 1.9);
        enemySchedule.push({
          spawnTime: 0.15 + idx * 0.20,
          xNorm,
          kind: 'BRUTE',
          hp: bHp,
          maxHp: bHp,
          speedMult: 0.96,
        });
      });
      const guardHp = Math.round(baseEnemyHP * 1.5);
      enemySchedule.push({
        spawnTime: 0.45,
        xNorm: 0.50,
        kind: level >= 5 ? 'SHIELD_BEARER' : 'SHOOTER',
        hp: guardHp,
        maxHp: guardHp,
        speedMult: 0.94,
      });
      cursorTime = 1.90;
    } else {
      // OPENING F: Conversion Zone Swarm Rush
      for (let k = 0; k < 4; k++) {
        const hp = Math.round(baseEnemyHP * 0.9);
        enemySchedule.push({
          spawnTime: 0.15 + k * 0.22,
          xNorm: 0.20 + k * 0.20,
          kind: k % 2 === 0 ? 'RUNNER' : 'SPRINTER',
          hp,
          maxHp: hp,
          speedMult: k % 2 === 0 ? 1.2 : 1.65,
        });
      }
      cursorTime = 1.65;
    }

    // =========================================================================
    // MAIN TACTICAL WAVES
    // =========================================================================
    for (let w = 0; w < waveCount; w++) {
      const greedLane = (w + level) % 2; // 0 = Left, 1 = Right
      const threatLane = 1 - greedLane;
      const pairId = (level * 1000) + (w * 10) + 1;

      const isLockedMult = (w === waveCount - 1) && (level >= 3);
      const isAltarWave = (archetype.id === 'CONVERSION_ZONE' && w === 1) || (sector >= 4 && w === 1 && level >= 61);
      const isTacticalBuffGate = !isAltarWave && (w % 2 === 1) && (level >= 2);
      const isQuantumWave = sector === 5 && w % 2 === 0;

      // 1. GATES (Require sustained volleys to charge or unlock)
      if (isAltarWave) {
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: 'ALTAR',
          val: 0,
          minVal: 0,
          maxVal: 0,
          hitsPerStep: 3,
          altarSacrificeCost: Math.min(8, 3 + Math.floor(level * 0.1)),
          altarWeaponReward: (w + level) % 2 === 0 ? 'laserWeapon' : 'homingMissiles',
          pairId,
        });
        const hazVal = -(2 + Math.floor(level * 0.2));
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: 'HAZARD',
          val: hazVal,
          minVal: hazVal,
          maxVal: 0,
          hitsPerStep: Math.min(6, 4 + Math.floor(level * 0.15)),
          pairId,
        });
      } else if (isLockedMult) {
        const lockHits = Math.min(32, Math.round(12 + level * 1.1));
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: 'LOCKED_MULT',
          val: 2,
          minVal: 0,
          maxVal: 2,
          label: '🔒 x2 SQUAD',
          color: '#10b981',
          lockHitsRemaining: lockHits,
          lockHitsMax: lockHits,
          pairId,
        });
        const hazVal = -(2 + Math.floor(level * 0.25));
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: level <= 3 ? 'CHARGE_ADD' : 'HAZARD',
          val: level <= 3 ? 2 : hazVal,
          minVal: level <= 3 ? 2 : hazVal,
          maxVal: level <= 3 ? maxAddCap : 0,
          hitsPerStep: level <= 3 ? hitsPerIncrement : Math.min(6, 4 + Math.floor(level * 0.15)),
          pairId,
        });
      } else if (isTacticalBuffGate) {
        const buffType = (sector >= 2 && w === 2) ? 'SPLIT_SQUAD'
                       : archetype.id === 'ARMORED_SIEGE' ? 'AP' 
                       : archetype.id === 'SWARM_INFILTRATION' ? 'CRYO'
                       : archetype.id === 'ARTILLERY_STORM' ? 'BLAST'
                       : 'FIRERATE';
        const label = buffType === 'SPLIT_SQUAD' ? '⚡ DUAL SQUAD'
                    : buffType === 'AP' ? '⚡ AP ROUNDS'
                    : buffType === 'CRYO' ? '❄️ CRYO SLOW'
                    : buffType === 'BLAST' ? '💥 BLAST AoE'
                    : '🔥 FIRE RATE';
        const color = buffType === 'SPLIT_SQUAD' ? '#38bdf8'
                    : buffType === 'AP' ? '#fde047'
                    : buffType === 'CRYO' ? '#22d3ee'
                    : buffType === 'BLAST' ? '#fb923c'
                    : '#f43f5e';
        const lockHits = Math.min(30, Math.round(10 + level * 1.0));

        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: 'BUFF_GATE',
          boostType: buffType,
          label,
          color,
          minVal: 0,
          maxVal: 1,
          lockHitsRemaining: lockHits,
          lockHitsMax: lockHits,
          pairId,
        });
        const threatVal = level <= 2 ? 2 : -(1 + Math.floor(level * 0.18));
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: threatVal < 0 ? 'HAZARD' : 'CHARGE_ADD',
          val: threatVal,
          minVal: threatVal,
          maxVal: threatVal < 0 ? 0 : Math.max(5, Math.floor(maxAddCap * 0.8)),
          hitsPerStep: threatVal < 0 ? Math.min(6, 4 + Math.floor(level * 0.15)) : hitsPerIncrement,
          pairId,
        });
      } else {
        // Chargeable Math Gates (Greed lane always starts positive as a true reward block; paired gates stay in their own lane)
        const startVal = level === 1 ? 2 : 1;
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: isQuantumWave ? 'QUANTUM' : 'CHARGE_ADD',
          val: startVal,
          minVal: 0,
          maxVal: maxAddCap,
          hitsPerStep: hitsPerIncrement,
          sliding: false,
          flipPolarity: false,
          pairId,
        });
        const threatStartVal = level === 1 ? 1 : Math.max(-5, -Math.floor(level * 0.22));
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: threatStartVal < 0 ? 'HAZARD' : 'CHARGE_ADD',
          val: threatStartVal,
          minVal: threatStartVal,
          maxVal: threatStartVal < 0 ? 0 : Math.max(4, maxAddCap - 2),
          hitsPerStep: threatStartVal < 0 ? Math.min(6, 4 + Math.floor(level * 0.15)) : hitsPerIncrement,
          pairId,
        });
      }

      // 2. FIELD OBSTACLES
      if (level >= 4 && (archetype.id === 'PRECISION_GRID' || (sector >= 2 && w === 1))) {
        obstacleQueue.push({
          spawnTime: cursorTime + 0.9,
          type: w % 2 === 0 ? 'SPEED_STRIP' : 'HAZARD_STRIP',
          lane: threatLane === 0 ? 'LEFT' : 'RIGHT',
          angleDeg: 0,
          overclockRate: 1.5,
          dragFactor: 0.65,
        });
      }

      // 3. ENEMIES MARCHING BEHIND GATES & FLANKING
      // Spawn enemies right behind the gates (cursorTime + 0.45) so they use unmaxed gates as cover
      // while sprinters rush the opposite threat lane!
      const coverCount = level === 1 ? 2 : Math.min(4, 2 + Math.floor(w / 2));
      for (let c = 0; c < coverCount; c++) {
        const laneCenter = greedLane === 0 ? 0.26 : 0.74;
        const spread = (c - (coverCount - 1) / 2) * 0.11;
        const isHeavy = level >= 4 && c === 0 && (archetype.id === 'ARMORED_SIEGE' || isBossLevel);
        const eHp = Math.round(baseEnemyHP * (isHeavy ? 1.85 : 1.0));
        enemySchedule.push({
          spawnTime: cursorTime + 0.45 + c * 0.35,
          xNorm: Math.max(0.12, Math.min(0.88, laneCenter + spread)),
          kind: isHeavy ? 'BRUTE' : 'RUNNER',
          hp: eHp,
          maxHp: eHp,
          speedMult: isHeavy ? 0.96 : 1.16,
        });
      }

      if (level >= 2) {
        const isSwarm = archetype.id === 'SWARM_INFILTRATION';
        const sprinterCount = level === 2 ? 1 : isSwarm ? Math.min(4, 2 + Math.floor(w / 2)) : 2;
        for (let s = 0; s < sprinterCount; s++) {
          const laneCenter = threatLane === 0 ? 0.25 : 0.75;
          const jitter = (s % 2 === 0 ? -0.08 : 0.08);
          const sHp = Math.round(baseEnemyHP * 0.75);
          enemySchedule.push({
            spawnTime: cursorTime + 0.35 + s * 0.48,
            xNorm: Math.max(0.12, Math.min(0.88, laneCenter + jitter)),
            kind: 'SPRINTER',
            hp: sHp,
            maxHp: sHp,
            speedMult: level <= 2 ? 1.55 : isSwarm ? 1.95 : 1.72,
          });
        }
      }

      cursorTime += 2.2;

      // Ricochet Prism Mirrors & Central Diamond Beam Splitters spawn in the open corridor
      const crateLane3 = (level + w) % 3;
      if (level >= 6 && (w === 0 || archetype.id === 'ARMORED_SIEGE' || archetype.id === 'PRECISION_GRID' || sector >= 2)) {
        if (w % 2 === 0 && sector >= 2) {
          // Central Diamond Beam Splitter (Highway Median)
          obstacleQueue.push({
            spawnTime: cursorTime - 0.15,
            type: 'BEAM_SPLITTER',
            lane: 'CENTER',
            angleDeg: 0,
          });
        } else {
          // Wall Ricochet Prism Mirror
          const mirrorOnLeft = crateLane3 !== 0;
          obstacleQueue.push({
            spawnTime: cursorTime - 0.15,
            type: 'PRISM_MIRROR',
            lane: mirrorOnLeft ? 'LEFT' : 'RIGHT',
            angleDeg: mirrorOnLeft ? 45 : -45,
          });
        }
      }

      // 4. ARMORY CRATES & SPECIALISTS (High durability so they act as real tactical barriers)
      if (level >= 2 && (w % 2 === 0 || w === waveCount - 1)) {
        const boostType = (sector >= 2 && w === waveCount - 1) ? 'SPLIT_SQUAD'
                        : archetype.id === 'SWARM_INFILTRATION' ? 'VANGUARD'
                        : archetype.id === 'ARMORED_SIEGE' ? 'AP'
                        : archetype.id === 'ARTILLERY_STORM' ? 'MORTAR'
                        : archetype.id === 'PRECISION_GRID' ? 'SNIPER'
                        : 'BLAST';
        const label = boostType === 'SPLIT_SQUAD' ? '⚡ DUAL-THUMB SPLIT SQUAD'
                    : boostType === 'VANGUARD' ? '⚡ +2 VANGUARD SPECS'
                    : boostType === 'AP' ? '⚡ AP ROUNDS (2.5x vs 🛡️)'
                    : boostType === 'MORTAR' ? '🟡 +1 EMP MORTAR SPEC'
                    : boostType === 'SNIPER' ? '💎 +2 SNIPER SPECS'
                    : '💥 BLAST SPLASH AoE';
        const color = boostType === 'SPLIT_SQUAD' ? '#38bdf8'
                    : boostType === 'VANGUARD' ? '#f97316'
                    : boostType === 'AP' ? '#fde047'
                    : boostType === 'MORTAR' ? '#eab308'
                    : boostType === 'SNIPER' ? '#06b6d4'
                    : '#fb923c';

        const crateHP = Math.round(baseEnemyHP * (2.35 + w * 0.35));
        crateQueue.push({
          spawnTime: cursorTime,
          lane3: crateLane3,
          hp: crateHP,
          maxHp: crateHP,
          boostType,
          label,
          color,
        });

        // Mines & Shooters
        if (level >= 3 && (archetype.id === 'ARTILLERY_STORM' || archetype.id === 'PRECISION_GRID' || level >= 5)) {
          const mineLane = (crateLane3 + 1) % 3;
          const mHp = Math.round(baseEnemyHP * 0.85);
          enemySchedule.push({
            spawnTime: cursorTime + 0.25,
            xNorm: (mineLane + 0.5) / 3,
            kind: 'MINE',
            hp: mHp,
            maxHp: mHp,
            speedMult: 1.15,
          });
        }

        if (level >= 3 && (archetype.id === 'ARTILLERY_STORM' || level >= 5)) {
          const shooterLane = (crateLane3 + 2) % 3;
          const shHp = Math.round(baseEnemyHP * 1.35);
          enemySchedule.push({
            spawnTime: cursorTime + 0.35,
            xNorm: (shooterLane + 0.5) / 3,
            kind: 'SHOOTER',
            hp: shHp,
            maxHp: shHp,
            speedMult: 0.95,
          });
        }

        cursorTime += 1.95;
      }

      // 5. MAIN ASSAULT FORMATION
      const rowsInWave = level <= 2 ? 1 : level <= 4 ? 2 : Math.min(3, 2 + Math.floor(w / 2));
      for (let r = 0; r < rowsInWave; r++) {
        const countInRow = level === 1 ? 3 : level <= 3 ? 4 : 4 + (r % 2);
        for (let c = 0; c < countInRow; c++) {
          const xNorm = (c + 0.5) / countInRow;
          let kind: EnemyType = 'RUNNER';
          let hpMult = 0.95 + w * 0.16;
          let spdMult = 1.15;

          if (level >= 3 && r === 0 && (c === 1 || c === countInRow - 2)) {
            const isSiege = archetype.id === 'ARMORED_SIEGE';
            kind = (level >= 5 && isSiege && c === 1) || sector >= 4 ? 'SHIELD_BEARER' : 'BRUTE';
            hpMult *= isSiege ? 2.3 : 1.95;
            spdMult = 0.94;
          } else if (level >= 6 && r === rowsInWave - 1 && c === Math.floor(countInRow / 2)) {
            kind = 'HEALER_DRONE';
            hpMult *= 1.25;
            spdMult = 0.90;
          }

          const hp = Math.round(baseEnemyHP * hpMult);
          enemySchedule.push({
            spawnTime: cursorTime + r * 1.05 + (c % 2) * 0.14,
            xNorm,
            kind,
            hp,
            maxHp: hp,
            speedMult: spdMult,
          });
        }
      }

      cursorTime += rowsInWave * 1.15 + 1.85;
    }

    // 6. BOSS WAVE (Level 5 Warden Gatekeeper & Every 5 / 10 Levels)
    if (isBossLevel) {
      const bossPairId = (level * 1000) + 99;
      const bossLockHits = Math.min(36, 14 + Math.floor(level * 1.2));
      gateQueue.push({
        spawnTime: cursorTime - 0.8,
        lane: 0,
        kind: 'CHARGE_ADD',
        val: 2,
        maxVal: maxAddCap,
        hitsPerStep: hitsPerIncrement,
        pairId: bossPairId,
      });
      gateQueue.push({
        spawnTime: cursorTime - 0.8,
        lane: 1,
        kind: 'BUFF_GATE',
        boostType: 'AP',
        label: '⚡ BOSS BREAKER (AP)',
        color: '#fde047',
        lockHitsRemaining: bossLockHits,
        lockHitsMax: bossLockHits,
        pairId: bossPairId,
      });

      cursorTime += 1.5;

      // Boss Armored Escort Phalanx
      const escortCount = isTitan ? 4 : 3;
      for (let i = 0; i < escortCount; i++) {
        const isShielder = i === 1 && level >= 5;
        const isBrute = i % 2 === 0;
        const eHp = Math.round(baseEnemyHP * (isShielder ? 1.7 : isBrute ? 2.0 : 1.3));
        enemySchedule.push({
          spawnTime: cursorTime,
          xNorm: (i + 0.5) / escortCount,
          kind: isShielder ? 'SHIELD_BEARER' : isBrute ? 'BRUTE' : 'SHOOTER',
          hp: eHp,
          maxHp: eHp,
          speedMult: 0.92,
        });
      }

      // Competitive Boss HP (Requires Upgrades at Level 5+!)
      const bossMult = isTitan ? 15.5 : 10.5;
      const bossHP = Math.round(baseEnemyHP * bossMult);
      const bossKind: EnemyType = isTitan ? 'TITAN' : 'WARDEN';

      enemySchedule.push({
        spawnTime: cursorTime + 1.0,
        xNorm: 0.5,
        kind: bossKind,
        name: isTitan ? `TITAN MK-${Math.max(1, Math.floor(level / 10))}` : `WARDEN LV.${level}`,
        hp: bossHP,
        maxHp: bossHP,
        speedMult: 0.68,
      });
    }

    // Sort schedules chronologically since opening waves & sub-waves interleave
    gateQueue.sort((a, b) => a.spawnTime - b.spawnTime);
    crateQueue.sort((a, b) => a.spawnTime - b.spawnTime);
    enemySchedule.sort((a, b) => a.spawnTime - b.spawnTime);
    obstacleQueue.sort((a, b) => a.spawnTime - b.spawnTime);

    return {
      level,
      sector,
      biome,
      archetype,
      tier,
      recommendedPower,
      isBossLevel,
      isTitanLevel: isTitan,
      scrollSpeed,
      totalEnemies: enemySchedule.length,
      gateQueue,
      crateQueue,
      enemySchedule,
      obstacleQueue,
      coinReward: Math.round(55 + level * 16 + (isTitan ? 120 : isWarden ? 65 : 0))
    };
  }

  public static spawnEnemyEntity(
    eDef: EnemyScheduleItem, 
    cw: number, 
    scrollSpeed: number
  ): Enemy {
    const margin = 52;
    const safeNorm = Math.max(0.02, Math.min(0.98, eDef.xNorm));
    const x = margin + safeNorm * (cw - margin * 2);
    let r = 14;
    let color = '#f43f5e';
    let armored = false;

    if (eDef.kind === 'SPRINTER') {
      r = 13;
      color = '#fb923c';
    } else if (eDef.kind === 'BRUTE') {
      r = 21;
      color = '#64748b';
      armored = true;
    } else if (eDef.kind === 'SHOOTER') {
      r = 17;
      color = '#c084fc';
    } else if (eDef.kind === 'MINE') {
      r = 16;
      color = '#eab308';
    } else if (eDef.kind === 'SHIELD_BEARER') {
      r = 18;
      color = '#a855f7';
      armored = true;
    } else if (eDef.kind === 'HEALER_DRONE') {
      r = 15;
      color = '#10b981';
    } else if (eDef.kind === 'CAPTAIN') {
      r = 28;
      color = '#a855f7';
      armored = true;
    } else if (eDef.kind === 'WARDEN') {
      r = 33;
      color = '#ec4899';
      armored = true;
    } else if (eDef.kind === 'TITAN') {
      r = 40;
      color = '#ef4444';
      armored = true;
    }

    const isBoss = eDef.kind === 'CAPTAIN' || eDef.kind === 'WARDEN' || eDef.kind === 'TITAN';
    const seqId = this.nextEnemySeq++;

    const enemy: Enemy = {
      id: seqId,
      type: eDef.kind,
      x,
      // Spawn just above the visible top edge so enemies enter the screen immediately
      y: -r - 2,
      r,
      hp: eDef.hp,
      maxHp: eDef.maxHp,
      speed: scrollSpeed * eDef.speedMult,
      scoreVal: isBoss ? 200 : eDef.kind === 'BRUTE' ? 30 : 10,
      color,
      armored,
      isBoss,
      name: eDef.name,
      slowTimer: 0,
      shootCooldown: 1.4 + (seqId % 4) * 0.2,
      hitFlash: 0,
      bossPhase: 0,
      healTimer: eDef.kind === 'HEALER_DRONE' ? 1.8 : undefined,
      active: true,
    };

    if (isBoss) {
      const plateHp = Math.round(eDef.hp * 0.24);
      enemy.armorPlates = [
        { id: 'left', hp: plateHp, maxHp: plateHp, broken: false, relX: -r * 0.85, relY: 0, w: r * 0.7, h: r * 1.2 },
        { id: 'right', hp: plateHp, maxHp: plateHp, broken: false, relX: r * 0.85, relY: 0, w: r * 0.7, h: r * 1.2 },
      ];

      // Boss Tactical Guard Barriers: Frontal mini-walls that block direct frontal fire,
      // compelling players to angle shots using wall Prism Mirrors or Diamond Splitters!
      const shieldHp = Math.round(eDef.hp * 0.18);
      enemy.guardShields = [
        { id: 'guard_left', name: 'FLANK BARRIER', hp: shieldHp, maxHp: shieldHp, broken: false, relX: -r * 0.72, relY: r * 0.95, w: r * 0.85, h: 14, deflector: true },
        { id: 'guard_right', name: 'FLANK BARRIER', hp: shieldHp, maxHp: shieldHp, broken: false, relX: r * 0.72, relY: r * 0.95, w: r * 0.85, h: 14, deflector: true },
      ];
      if (eDef.kind === 'TITAN') {
        const centerShieldHp = Math.round(eDef.hp * 0.22);
        enemy.guardShields.push({
          id: 'guard_center',
          name: 'CORE DEFLECTOR',
          hp: centerShieldHp,
          maxHp: centerShieldHp,
          broken: false,
          relX: 0,
          relY: r * 1.18,
          w: r * 0.95,
          h: 15,
          deflector: true,
        });
      }

      enemy.enraged = false;
      enemy.enrageDeployed = false;
    }

    return enemy;
  }

  public static generateEndlessInitialPlan(cw: number = 380): LevelPlan {
    this.nextEnemySeq = 1;
    const biome = SECTOR_BIOMES[1];
    const initialChunk = this.generateEndlessChunk(1, 0.15, cw);
    const secondChunk = this.generateEndlessChunk(1, initialChunk.nextCursorTime, cw);

    return {
      level: 1,
      sector: 1,
      biome,
      archetype: {
        id: 'SWARM_INFILTRATION',
        badge: '♾️ ENDLESS SURVIVAL',
        badgeColor: '#38bdf8',
        title: 'Infinite Highway Survival',
        advisory: 'Enemies and obstacles scale endlessly. Hold the line as long as possible!',
        featuredBuff: 'DYNAMIC SCALE'
      },
      tier: 1,
      isBossLevel: false,
      isTitanLevel: false,
      recommendedPower: 4,
      scrollSpeed: 74,
      totalEnemies: 99999,
      coinReward: 0,
      gateQueue: [...initialChunk.gateQueue, ...secondChunk.gateQueue],
      crateQueue: [...initialChunk.crateQueue, ...secondChunk.crateQueue],
      enemySchedule: [...initialChunk.enemySchedule, ...secondChunk.enemySchedule],
      obstacleQueue: [...initialChunk.obstacleQueue, ...secondChunk.obstacleQueue],
    };
  }

  public static generateEndlessChunk(
    threatLevel: number,
    startTime: number,
    cw: number = 380
  ): {
    gateQueue: GateQueueItem[];
    crateQueue: CrateQueueItem[];
    enemySchedule: EnemyScheduleItem[];
    obstacleQueue: ObstacleQueueItem[];
    nextCursorTime: number;
  } {
    const gateQueue: GateQueueItem[] = [];
    const crateQueue: CrateQueueItem[] = [];
    const enemySchedule: EnemyScheduleItem[] = [];
    const obstacleQueue: ObstacleQueueItem[] = [];

    // Aggressive HP scaling calibrated for:
    // 2 min (~120s, threat 13) = Good (~300 HP base)
    // 3 min (~180s, threat 19) = Great (~550 HP base)
    // 5 min (~300s, threat 31) = Incredible (~1,150 HP base)
    const baseEnemyHP = Math.round(28 + Math.pow(threatLevel, 1.55) * 5.5);
    const maxAddCap = Math.min(4, 2 + Math.floor(threatLevel * 0.1));
    const hitsPerIncrement = Math.min(20, 8 + Math.floor(threatLevel * 0.5));
    const greedLane = (threatLevel + Math.floor(startTime)) % 2;
    const threatLane = 1 - greedLane;
    const pairId = Math.floor(startTime * 1000) + threatLevel;

    // 1. Choice Gate Dilemma (Endless mode grants controlled +1..+3 recruits, NEVER 2x compounding!)
    const waveVariant = threatLevel % 4;
    if (waveVariant === 0) {
      // Locked Reinforcement Gate (+1 to +3) vs Hazard
      const lockHits = Math.min(42, Math.round(14 + threatLevel * 1.5));
      const recruitBonus = Math.min(3, 1 + Math.floor(threatLevel * 0.1));
      gateQueue.push({
        spawnTime: startTime,
        lane: greedLane,
        kind: 'LOCKED_MULT',
        val: recruitBonus,
        minVal: 0,
        maxVal: recruitBonus,
        label: `🔒 +${recruitBonus} SQUAD`,
        color: '#10b981',
        lockHitsRemaining: lockHits,
        lockHitsMax: lockHits,
        pairId,
      });
      const hazVal = -(1 + Math.floor(threatLevel * 0.25));
      gateQueue.push({
        spawnTime: startTime,
        lane: threatLane,
        kind: 'HAZARD',
        val: hazVal,
        minVal: hazVal,
        maxVal: 0,
        hitsPerStep: Math.min(8, 4 + Math.floor(threatLevel * 0.2)),
        pairId,
      });
    } else if (waveVariant === 1) {
      // Tactical Buff Gate vs Hazard Neutralization
      const buffs: ('AP' | 'CRYO' | 'BLAST' | 'FIRERATE')[] = ['AP', 'CRYO', 'BLAST', 'FIRERATE'];
      const buffType = buffs[threatLevel % buffs.length];
      const label = buffType === 'AP' ? '⚡ AP ROUNDS (2.5x vs 🛡️)'
                  : buffType === 'CRYO' ? '❄️ CRYO SLOW (-45% SPD)'
                  : buffType === 'BLAST' ? '💥 BLAST SPLASH AoE'
                  : '🔥 FIRE RATE +25%';
      const color = buffType === 'AP' ? '#fde047' : buffType === 'CRYO' ? '#22d3ee' : buffType === 'BLAST' ? '#fb923c' : '#f43f5e';
      const lockHits = Math.min(36, Math.round(12 + threatLevel * 1.2));

      gateQueue.push({
        spawnTime: startTime,
        lane: greedLane,
        kind: 'BUFF_GATE',
        boostType: buffType,
        label,
        color,
        minVal: 0,
        maxVal: 1,
        lockHitsRemaining: lockHits,
        lockHitsMax: lockHits,
        pairId,
      });
      const hazVal = -(2 + Math.floor(threatLevel * 0.25));
      gateQueue.push({
        spawnTime: startTime,
        lane: threatLane,
        kind: 'HAZARD',
        val: hazVal,
        minVal: hazVal,
        maxVal: 0,
        hitsPerStep: Math.min(8, 4 + Math.floor(threatLevel * 0.2)),
        pairId,
      });
    } else if (waveVariant === 2) {
      // Altar vs Hazard Neutralization
      gateQueue.push({
        spawnTime: startTime,
        lane: greedLane,
        kind: 'ALTAR',
        val: 0,
        minVal: 0,
        maxVal: 0,
        hitsPerStep: 4,
        altarSacrificeCost: Math.min(8, 3 + Math.floor(threatLevel * 0.2)),
        altarWeaponReward: threatLevel % 2 === 0 ? 'laserWeapon' : 'homingMissiles',
        pairId,
      });
      const hazVal = -(2 + Math.floor(threatLevel * 0.25));
      gateQueue.push({
        spawnTime: startTime,
        lane: threatLane,
        kind: 'HAZARD',
        val: hazVal,
        minVal: hazVal,
        maxVal: 0,
        hitsPerStep: Math.min(8, 4 + Math.floor(threatLevel * 0.2)),
        pairId,
      });
    } else {
      // Standard Charge Add (+1 to maxAddCap) vs Hazard
      const maxCap = Math.min(4, 2 + Math.floor(threatLevel * 0.1));
      gateQueue.push({
        spawnTime: startTime,
        lane: greedLane,
        kind: 'CHARGE_ADD',
        val: 1,
        minVal: 0,
        maxVal: maxCap,
        hitsPerStep: hitsPerIncrement,
        pairId,
      });
      const hazVal = -(1 + Math.floor(threatLevel * 0.25));
      gateQueue.push({
        spawnTime: startTime,
        lane: threatLane,
        kind: 'HAZARD',
        val: hazVal,
        minVal: hazVal,
        maxVal: 0,
        hitsPerStep: Math.min(8, 4 + Math.floor(threatLevel * 0.2)),
        pairId,
      });
    }

    // 2. Obstacles: Speed Strips, Hazard Strips, Ricochet Prism Mirrors, or Diamond Beam Splitters
    if (threatLevel >= 2) {
      if (threatLevel % 3 === 0) {
        obstacleQueue.push({
          spawnTime: startTime + 0.85,
          type: 'BEAM_SPLITTER',
          lane: 'CENTER',
          angleDeg: 0,
        });
      } else if (threatLevel % 2 === 1) {
        obstacleQueue.push({
          spawnTime: startTime + 0.85,
          type: 'PRISM_MIRROR',
          lane: greedLane === 0 ? 'LEFT' : 'RIGHT',
          angleDeg: greedLane === 0 ? 45 : -45,
        });
      } else {
        obstacleQueue.push({
          spawnTime: startTime + 0.85,
          type: 'SPEED_STRIP',
          lane: threatLane === 0 ? 'LEFT' : 'RIGHT',
          angleDeg: 0,
          overclockRate: 1.5,
          dragFactor: 0.65,
        });
      }
    }

    // 3. Armory Crate (Armor, Specialists & Dual-Thumb Split Squad) - Spawns strictly every 3rd threat level
    if (threatLevel % 3 === 0) {
      const crateLane = (threatLevel + Math.floor(startTime * 2)) % 3;
      const crateHP = Math.round(baseEnemyHP * (3.5 + threatLevel * 0.2));
      const crateBoosts: ('AP' | 'SPLIT_SQUAD' | 'VANGUARD' | 'SNIPER' | 'MORTAR')[] = [
        'AP', 'SPLIT_SQUAD', 'VANGUARD', 'SNIPER', 'MORTAR'
      ];
      const cBoost = crateBoosts[threatLevel % crateBoosts.length];
      const cLabel = cBoost === 'AP' ? '⚡ AP ROUNDS (2.5x vs 🛡️)'
                   : cBoost === 'SPLIT_SQUAD' ? '⚡ DUAL-THUMB SPLIT SQUAD'
                   : cBoost === 'VANGUARD' ? '⚡ +1 VANGUARD SPEC'
                   : cBoost === 'SNIPER' ? '💎 +1 SNIPER SPEC'
                   : '🟡 +1 EMP MORTAR SPEC';
      const cColor = cBoost === 'AP' ? '#fde047'
                   : cBoost === 'SPLIT_SQUAD' ? '#38bdf8'
                   : cBoost === 'VANGUARD' ? '#f97316'
                   : cBoost === 'SNIPER' ? '#06b6d4'
                   : '#eab308';
      crateQueue.push({
        spawnTime: startTime + 1.35,
        lane3: crateLane,
        hp: crateHP,
        maxHp: crateHP,
        boostType: cBoost,
        label: cLabel,
        color: cColor,
      });
    }

    // 4. Enemy Waves (Marching Behind Gates & Flanking)
    const runnerCount = Math.min(8, 3 + Math.floor(threatLevel * 0.45));
    for (let r = 0; r < runnerCount; r++) {
      const eHp = Math.round(baseEnemyHP * 0.95);
      enemySchedule.push({
        spawnTime: startTime + 0.35 + r * 0.25,
        xNorm: 0.15 + (r / Math.max(1, runnerCount - 1)) * 0.70,
        kind: r % 2 === 0 ? 'RUNNER' : 'SPRINTER',
        hp: eHp,
        maxHp: eHp,
        speedMult: (r % 2 === 0 ? 1.25 : 1.75) + Math.min(0.5, threatLevel * 0.03),
      });
    }

    // Flanking Sprinters
    const sprinterCount = Math.min(6, 2 + Math.floor(threatLevel * 0.35));
    for (let s = 0; s < sprinterCount; s++) {
      const sHp = Math.round(baseEnemyHP * 0.80);
      const laneNorm = s % 2 === 0 ? 0.20 : 0.80;
      enemySchedule.push({
        spawnTime: startTime + 1.2 + s * 0.35,
        xNorm: laneNorm,
        kind: 'SPRINTER',
        hp: sHp,
        maxHp: sHp,
        speedMult: 1.85 + Math.min(0.7, threatLevel * 0.04),
      });
    }

    // Heavy Assault Formation
    const isBossWave = threatLevel % 5 === 0 && threatLevel >= 5;
    if (isBossWave) {
      const isTitan = threatLevel % 10 === 0;
      const bossHp = Math.round(baseEnemyHP * (isTitan ? 8.5 : 5.5));
      enemySchedule.push({
        spawnTime: startTime + 2.0,
        xNorm: 0.50,
        kind: isTitan ? 'TITAN' : 'WARDEN',
        name: isTitan ? `TITAN OMEGA (THREAT ${threatLevel})` : `WARDEN PRIME (THREAT ${threatLevel})`,
        hp: bossHp,
        maxHp: bossHp,
        speedMult: 0.85 + Math.min(0.35, threatLevel * 0.02),
      });

      // Boss escorts at threat >= 10
      if (threatLevel >= 10) {
        enemySchedule.push({
          spawnTime: startTime + 2.3,
          xNorm: 0.25,
          kind: 'SHIELD_BEARER',
          hp: Math.round(baseEnemyHP * 1.6),
          maxHp: Math.round(baseEnemyHP * 1.6),
          speedMult: 0.90,
        });
        enemySchedule.push({
          spawnTime: startTime + 2.3,
          xNorm: 0.75,
          kind: 'SHIELD_BEARER',
          hp: Math.round(baseEnemyHP * 1.6),
          maxHp: Math.round(baseEnemyHP * 1.6),
          speedMult: 0.90,
        });
      }
    } else {
      // Brutes & Shield Bearers
      const heavyCount = Math.min(4, 1 + Math.floor(threatLevel * 0.25));
      for (let h = 0; h < heavyCount; h++) {
        const isShield = threatLevel >= 3 && h === 0;
        const bHp = Math.round(baseEnemyHP * (isShield ? 1.6 : 2.2));
        enemySchedule.push({
          spawnTime: startTime + 1.8 + h * 0.35,
          xNorm: 0.22 + h * 0.28,
          kind: isShield ? 'SHIELD_BEARER' : 'BRUTE',
          hp: bHp,
          maxHp: bHp,
          speedMult: 0.95 + Math.min(0.3, threatLevel * 0.02),
        });
      }

      // Shooters / Artillery (spawn from Threat >= 2)
      if (threatLevel >= 2) {
        const shHp = Math.round(baseEnemyHP * 1.35);
        enemySchedule.push({
          spawnTime: startTime + 2.4,
          xNorm: (threatLevel % 2 === 0 ? 0.22 : 0.78),
          kind: 'SHOOTER',
          hp: shHp,
          maxHp: shHp,
          speedMult: 0.95,
        });
        // Dual shooters at threat >= 7
        if (threatLevel >= 7) {
          enemySchedule.push({
            spawnTime: startTime + 2.7,
            xNorm: (threatLevel % 2 === 0 ? 0.78 : 0.22),
            kind: 'SHOOTER',
            hp: shHp,
            maxHp: shHp,
            speedMult: 0.95,
          });
        }
      }
    }

    return {
      gateQueue,
      crateQueue,
      enemySchedule,
      obstacleQueue,
      nextCursorTime: startTime + 5.5,
    };
  }
}
