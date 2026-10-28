// 100-Level Tactical Wave & Split-Lane Dilemma Generator
import { LevelPlan, WaveStep, Gate, FieldObstacle, Enemy, EnemyType, SectorId } from '../types/game';
import { SECTOR_BIOMES, getSectorForLevel } from '../constants/biomes';

export class WaveGenerator {
  public static generate(level: number, cw: number = 380): LevelPlan {
    const sector: SectorId = getSectorForLevel(level);
    const biome = SECTOR_BIOMES[sector];

    const isTitan = level % 10 === 0;
    const isWarden = !isTitan && (level % 5 === 0);
    const isBossLevel = isTitan || isWarden;

    // Progression scaling
    const hpScale = Math.pow(1.058, level - 1);
    const baseEnemyHP = Math.round((28 + level * 9) * hpScale);
    const waveCount = Math.min(8, 4 + Math.floor(level / 18));
    const coinReward = Math.round(50 + level * 14 + (isTitan ? 350 : isWarden ? 180 : 0));

    const laneWidth = cw / 2;
    const leftLaneX = laneWidth * 0.5;
    const rightLaneX = laneWidth * 1.5;

    const waves: WaveStep[] = [];
    const features: string[] = [];

    let totalEnemies = 0;
    let currentYOffset = -220;

    for (let w = 0; w < waveCount; w++) {
      currentYOffset -= 480;
      const step: WaveStep = {
        spawnYOffset: currentYOffset,
        gates: [],
        obstacles: [],
        enemies: [],
      };

      // Split-Lane Strategy Decision:
      // In even waves, spawn a high-value gate on one lane and threats on the other
      const gateLane: 'LEFT' | 'RIGHT' = (w + level) % 2 === 0 ? 'LEFT' : 'RIGHT';
      const threatLane: 'LEFT' | 'RIGHT' = gateLane === 'LEFT' ? 'RIGHT' : 'LEFT';
      const gateX = gateLane === 'LEFT' ? leftLaneX : rightLaneX;
      const threatX = threatLane === 'LEFT' ? leftLaneX : rightLaneX;

      // 1. Sector & Wave Gate Generation
      const isAltarWave = sector >= 4 && w === 1 && level >= 61;
      const isQuantumWave = sector === 5 && w % 2 === 1;

      if (isAltarWave) {
        // Sacrifice / Conversion Altar
        step.gates!.push({
          id: w * 100 + 1,
          x: gateX,
          y: currentYOffset,
          width: 140,
          height: 60,
          lane: gateLane,
          type: 'ALTAR',
          op: '+',
          val: 0,
          chargeHits: 0,
          hitsPerStep: 1,
          maxVal: 0,
          lockHp: 0,
          maxLockHp: 0,
          isUnlocked: true,
          altarSacrificeCost: Math.min(25, 10 + Math.floor(level * 0.15)),
          altarWeaponReward: (w + level) % 2 === 0 ? 'laserWeapon' : 'homingMissiles',
        });
        features.push('Sacrifice Altar');
      } else {
        // Standard or Sector-Special Math Gate
        const maxAddCap = Math.min(26, 6 + Math.floor(level * 0.28));
        const hitsPerInc = Math.min(16, 7 + Math.floor(level * 0.12));
        const gateType = isQuantumWave ? 'QUANTUM' : 'MATH';

        step.gates!.push({
          id: w * 100 + 1,
          x: gateX,
          y: currentYOffset,
          width: 130,
          height: 52,
          lane: gateLane,
          type: gateType,
          op: '+',
          val: Math.min(maxAddCap, 3 + Math.floor(Math.random() * 4)),
          chargeHits: 0,
          hitsPerStep: hitsPerInc,
          maxVal: maxAddCap,
          lockHp: level >= 8 && Math.random() < 0.4 ? Math.round(baseEnemyHP * 0.6) : 0,
          maxLockHp: level >= 8 ? Math.round(baseEnemyHP * 0.6) : 0,
          isUnlocked: true,
          sliding: sector >= 2 && Math.random() < 0.6,
          slideSpeed: 45 + level * 0.3,
          slideDir: 1,
          flipPolarity: isQuantumWave,
          polarityTimer: 3.0,
        });

        // Occasional Specialist Armory Crate in opposite lane
        if (Math.random() < 0.35 && w > 0) {
          const specTypes: ('sniper' | 'vanguard' | 'mortar')[] = ['sniper', 'vanguard', 'mortar'];
          const chosenSpec = specTypes[Math.floor(Math.random() * specTypes.length)];
          step.gates!.push({
            id: w * 100 + 2,
            x: threatX,
            y: currentYOffset - 80,
            width: 90,
            height: 48,
            lane: threatLane,
            type: 'CRATE',
            op: '+',
            val: 1,
            chargeHits: 0,
            hitsPerStep: 6,
            maxVal: 1,
            lockHp: Math.round(baseEnemyHP * 0.4),
            maxLockHp: Math.round(baseEnemyHP * 0.4),
            isUnlocked: true,
            boostKey: chosenSpec,
          });
        }
      }

      // 2. Field Obstacles Generation (Phase 1)
      if (sector === 3 || (sector > 3 && Math.random() < 0.5)) {
        // Ricochet Prism Mirrors on lane borders
        step.obstacles!.push({
          id: w * 200 + 1,
          type: 'PRISM_MIRROR',
          x: gateLane === 'LEFT' ? 24 : cw - 24,
          y: currentYOffset + 120,
          width: 32,
          height: 80,
          angleDeg: gateLane === 'LEFT' ? 45 : -45,
          lane: gateLane,
          active: true,
        });
        features.push('Prism Bumper');
      }

      if (Math.random() < 0.45 && w > 0) {
        // Speed Strip or Hazard Strip
        const isSpeed = Math.random() < 0.6;
        step.obstacles!.push({
          id: w * 200 + 2,
          type: isSpeed ? 'SPEED_STRIP' : 'HAZARD_STRIP',
          x: threatX,
          y: currentYOffset + 160,
          width: 100,
          height: 120,
          angleDeg: 0,
          lane: threatLane,
          overclockRate: isSpeed ? 1.5 : 1.0,
          dragFactor: isSpeed ? 1.0 : 0.65,
          active: true,
        });
      }

      // 3. Enemy Threat Spawning (Phase 2 Synergies)
      const enemySpawnGroup: {
        type: EnemyType;
        lane: 'LEFT' | 'RIGHT' | 'CENTER';
        count: number;
        spacingY?: number;
      }[] = [];

      // Sector 4 & 5: Linked Shield Bearer + Brutes
      if (sector >= 4 && Math.random() < 0.55 && w > 0) {
        enemySpawnGroup.push({
          type: 'SHIELD_BEARER' as EnemyType,
          lane: threatLane,
          count: 1,
        });
        enemySpawnGroup.push({
          type: 'ARMORED_BRUTE' as EnemyType,
          lane: threatLane,
          count: 2,
          spacingY: 60,
        });
        totalEnemies += 3;
      } else if (level >= 15 && Math.random() < 0.4) {
        // Backline Healer Drone + Grunts
        enemySpawnGroup.push({
          type: 'HEALER_DRONE' as EnemyType,
          lane: threatLane,
          count: 1,
        });
        enemySpawnGroup.push({
          type: 'GRUNT' as EnemyType,
          lane: threatLane,
          count: 3 + Math.floor(level / 20),
          spacingY: 45,
        });
        totalEnemies += 4 + Math.floor(level / 20);
      } else if (sector === 2 || Math.random() < 0.45) {
        // Sprinters
        const sprinterCount = 2 + Math.floor(level / 25);
        enemySpawnGroup.push({
          type: 'SPRINTER' as EnemyType,
          lane: threatLane,
          count: sprinterCount,
          spacingY: 50,
        });
        totalEnemies += sprinterCount;
      } else {
        // Standard Grunts & Occasional Artillery
        const gruntCount = 3 + Math.floor(level / 16);
        enemySpawnGroup.push({
          type: 'GRUNT' as EnemyType,
          lane: threatLane,
          count: gruntCount,
          spacingY: 40,
        });
        totalEnemies += gruntCount;

        if (level >= 6 && Math.random() < 0.4) {
          enemySpawnGroup.push({
            type: 'ARTILLERY' as EnemyType,
            lane: gateLane,
            count: 1,
            spacingY: 80,
          });
          totalEnemies += 1;
        }
      }

      step.enemies = enemySpawnGroup;
      waves.push(step);
    }

    // 4. Boss Finale (Every 5 & 10 levels)
    if (isBossLevel) {
      currentYOffset -= 520;
      const bossType: EnemyType = isTitan ? 'TITAN_BOSS' : 'WARDEN_BOSS';
      const bossStep: WaveStep = {
        spawnYOffset: currentYOffset,
        gates: [
          {
            id: 9999,
            x: cw / 2,
            y: currentYOffset + 240,
            width: 140,
            height: 52,
            lane: 'CENTER',
            type: 'MATH',
            op: '+',
            val: Math.min(24, 8 + Math.floor(level * 0.2)),
            chargeHits: 0,
            hitsPerStep: 10,
            maxVal: Math.min(30, 12 + Math.floor(level * 0.25)),
            lockHp: 0,
            maxLockHp: 0,
            isUnlocked: true,
          }
        ],
        obstacles: [],
        enemies: [
          {
            type: bossType,
            lane: 'CENTER',
            count: 1,
          }
        ]
      };
      totalEnemies += 1;
      waves.push(bossStep);
    }

    return {
      level,
      sector,
      biome,
      totalEnemies: Math.max(12, totalEnemies),
      isBossLevel,
      isTitanLevel: isTitan,
      coinReward,
      waves,
      features,
    };
  }

  public static spawnEnemyInstance(
    type: EnemyType, 
    x: number, 
    y: number, 
    level: number, 
    cw: number
  ): Enemy {
    const hpScale = Math.pow(1.058, level - 1);
    const baseHP = Math.round((28 + level * 9) * hpScale);
    const isTitan = type === 'TITAN_BOSS';
    const isWarden = type === 'WARDEN_BOSS';

    let hp = baseHP;
    let width = 28;
    let height = 28;
    let speed = 42 + Math.min(30, level * 0.3);
    let scoreVal = 10;
    let isSprinter = false;
    let isShooter = false;

    if (type === 'SPRINTER') {
      hp = Math.round(baseHP * 0.55);
      speed *= 1.85;
      scoreVal = 15;
      isSprinter = true;
    } else if (type === 'ARMORED_BRUTE') {
      hp = Math.round(baseHP * 2.8);
      speed *= 0.65;
      width = 36;
      height = 36;
      scoreVal = 30;
    } else if (type === 'SHIELD_BEARER') {
      hp = Math.round(baseHP * 1.6);
      speed *= 0.8;
      width = 32;
      height = 32;
      scoreVal = 35;
    } else if (type === 'HEALER_DRONE') {
      hp = Math.round(baseHP * 0.9);
      speed *= 0.7;
      width = 26;
      height = 26;
      scoreVal = 40;
    } else if (type === 'ARTILLERY') {
      hp = Math.round(baseHP * 1.1);
      speed *= 0.55;
      scoreVal = 25;
      isShooter = true;
    } else if (type === 'EXPLOSIVE_MINE') {
      hp = Math.round(baseHP * 0.3);
      speed *= 0.4;
      width = 24;
      height = 24;
      scoreVal = 10;
    } else if (isWarden) {
      hp = Math.round(baseHP * 9.5);
      width = 64;
      height = 64;
      speed = 18;
      scoreVal = 150;
    } else if (isTitan) {
      hp = Math.round(baseHP * 18.0);
      width = 80;
      height = 80;
      speed = 14;
      scoreVal = 300;
    }

    const enemy: Enemy = {
      id: Math.floor(Math.random() * 10000000),
      type,
      x: Math.max(30, Math.min(cw - 30, x)),
      y,
      width,
      height,
      hp,
      maxHp: hp,
      speed,
      scoreVal,
      isBoss: isTitan || isWarden,
      isSprinter,
      isShooter,
      shootTimer: isShooter ? 2.2 : undefined,
      artilleryTargetX: isShooter ? x : undefined,
      healTimer: type === 'HEALER_DRONE' ? 1.8 : undefined,
      active: true,
    };

    // Phase 2 Boss Armor Plates & Enrage
    if (enemy.isBoss) {
      const plateHp = Math.round(hp * 0.22);
      enemy.armorPlates = [
        { id: 'left', hp: plateHp, maxHp: plateHp, broken: false, relX: -width * 0.42, relY: 0, w: width * 0.35, h: height * 0.7 },
        { id: 'right', hp: plateHp, maxHp: plateHp, broken: false, relX: width * 0.42, relY: 0, w: width * 0.35, h: height * 0.7 },
      ];
      enemy.bossPhase = 1;
      enemy.enraged = false;
      enemy.enrageDeployed = false;
    }

    return enemy;
  }
}
