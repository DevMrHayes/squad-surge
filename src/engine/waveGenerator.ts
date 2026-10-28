// 100-Level Tactical Wave & Split-Lane Dilemma Generator (Time-Scheduled Queue Architecture)
import { 
  LevelPlan, 
  GateQueueItem, 
  CrateQueueItem, 
  EnemyScheduleItem, 
  ObstacleQueueItem, 
  Enemy, 
  EnemyType, 
  SectorId 
} from '../types/game';
import { SECTOR_BIOMES, getSectorForLevel } from '../constants/biomes';

export class WaveGenerator {
  public static generate(level: number, cw: number = 380): LevelPlan {
    const sector: SectorId = getSectorForLevel(level);
    const biome = SECTOR_BIOMES[sector];

    const isTitan = level % 10 === 0;
    const isWarden = !isTitan && (level % 5 === 0);
    const tier = level >= 70 ? 5 : level >= 45 ? 4 : level >= 25 ? 3 : level >= 10 ? 2 : 1;

    const waveCount = Math.min(7, 4 + Math.floor(level / 20));
    const hpScale = Math.pow(1.062, level - 1);
    const baseEnemyHP = Math.round((24 + level * 8) * hpScale);
    const scrollSpeed = Math.min(74, 46 + level * 0.26);

    // Gate caps & charge requirements
    const maxAddCap = Math.min(24, 6 + Math.floor(level * 0.3));
    const hitsPerIncrement = Math.min(18, 8 + Math.floor(level * 0.15));

    const gateQueue: GateQueueItem[] = [];
    const crateQueue: CrateQueueItem[] = [];
    const enemySchedule: EnemyScheduleItem[] = [];
    const obstacleQueue: ObstacleQueueItem[] = [];

    let cursorTime = 1.0;

    const tacticalBoostPool: { boostType: 'AP' | 'CRYO' | 'BLAST' | 'FIRERATE' | 'SHIELD'; label: string; color: string }[] = [
      { boostType: 'AP', label: '⚡ AP ROUNDS (2.5x vs 🛡️)', color: '#fde047' },
      { boostType: 'CRYO', label: '❄️ CRYO SLOW (-45% SPD)', color: '#22d3ee' },
      { boostType: 'BLAST', label: '💥 BLAST SPLASH AoE', color: '#fb923c' },
      { boostType: 'FIRERATE', label: '🔥 FIRE RATE +25%', color: '#f43f5e' },
      { boostType: 'SHIELD', label: '🛡️ +2 SQUAD SHIELDS', color: '#c084fc' }
    ];

    for (let w = 0; w < waveCount; w++) {
      const greedLane = (w + level) % 2; // 0 = Left, 1 = Right
      const threatLane = 1 - greedLane;

      const isLockedMult = (w === waveCount - 2) && (level >= 2);
      const isTacticalBuffGate = (w % 2 === 1);
      const isAltarWave = sector >= 4 && w === 1 && level >= 61;
      const isQuantumWave = sector === 5 && w % 2 === 0;

      // 1. GATES
      if (isAltarWave) {
        // Sacrifice / Conversion Altar (Phase 1)
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: 'ALTAR',
          val: 0,
          maxVal: 0,
          hitsPerStep: 1,
          altarSacrificeCost: Math.min(25, 10 + Math.floor(level * 0.15)),
          altarWeaponReward: (w + level) % 2 === 0 ? 'laserWeapon' : 'homingMissiles',
        });
        // Opposite hazard gate
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: 'HAZARD',
          val: -(3 + Math.floor(level * 0.3)),
          maxVal: 4,
          hitsPerStep: hitsPerIncrement
        });
      } else if (isLockedMult) {
        const lockHits = Math.round(14 + level * 0.5);
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: 'LOCKED_MULT',
          val: 2,
          lockHitsRemaining: lockHits,
          lockHitsMax: lockHits
        });
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: 'HAZARD',
          val: -(4 + Math.floor(level * 0.4)),
          maxVal: 4,
          hitsPerStep: hitsPerIncrement
        });
      } else if (isTacticalBuffGate) {
        const buff = tacticalBoostPool[(level + w) % tacticalBoostPool.length];
        const lockHits = Math.round(11 + level * 0.35);
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: 'BUFF_GATE',
          boostType: buff.boostType,
          label: buff.label,
          color: buff.color,
          lockHitsRemaining: lockHits,
          lockHitsMax: lockHits
        });
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: 'CHARGE_ADD',
          val: -(2 + Math.floor(level * 0.25) + w),
          maxVal: Math.max(4, Math.floor(maxAddCap * 0.75)),
          hitsPerStep: hitsPerIncrement
        });
      } else {
        // Chargeable Gate that starts slightly negative or zero
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: isQuantumWave ? 'QUANTUM' : 'CHARGE_ADD',
          val: -(1 + Math.floor(level * 0.2) + w),
          maxVal: maxAddCap,
          hitsPerStep: hitsPerIncrement,
          sliding: sector >= 2 && Math.random() < 0.6,
          flipPolarity: isQuantumWave,
        });
      }

      // 2. FIELD OBSTACLES (Phase 1)
      if (sector === 3 || (sector > 3 && Math.random() < 0.5)) {
        obstacleQueue.push({
          spawnTime: cursorTime + 0.6,
          type: 'PRISM_MIRROR',
          lane: greedLane === 0 ? 'LEFT' : 'RIGHT',
          angleDeg: greedLane === 0 ? 45 : -45,
        });
      }

      if (Math.random() < 0.45 && w > 0) {
        obstacleQueue.push({
          spawnTime: cursorTime + 1.2,
          type: Math.random() < 0.6 ? 'SPEED_STRIP' : 'HAZARD_STRIP',
          lane: threatLane === 0 ? 'LEFT' : 'RIGHT',
          angleDeg: 0,
          overclockRate: 1.5,
          dragFactor: 0.65,
        });
      }

      // 3. FAST SPRINTERS in Threat Lane
      const sprinterCount = 2 + Math.floor(w / 2);
      for (let s = 0; s < sprinterCount; s++) {
        const laneCenter = threatLane === 0 ? 0.23 : 0.77;
        const jitter = (s % 2 === 0 ? -0.07 : 0.07);
        const sHp = Math.round(baseEnemyHP * 0.65);
        enemySchedule.push({
          spawnTime: cursorTime + 0.3 + s * 0.6,
          xNorm: Math.max(0.12, Math.min(0.88, laneCenter + jitter)),
          kind: 'SPRINTER',
          hp: sHp,
          maxHp: sHp,
          speedMult: 2.15
        });
      }

      cursorTime += 3.0;

      // 4. ARMORY CRATE + MINE / ARTILLERY DILEMMA
      if (w % 2 === 0 || w === waveCount - 1) {
        const cDef = tacticalBoostPool[(level + w + 2) % tacticalBoostPool.length];
        const crateHP = Math.round(baseEnemyHP * (1.75 + w * 0.32));
        const crateLane3 = (level + w) % 3;
        crateQueue.push({
          spawnTime: cursorTime,
          lane3: crateLane3,
          hp: crateHP,
          maxHp: crateHP,
          ...cDef
        });

        const mineLane = (crateLane3 + 1) % 3;
        const mHp = Math.round(baseEnemyHP * 0.85);
        enemySchedule.push({
          spawnTime: cursorTime + 0.2,
          xNorm: (mineLane + 0.5) / 3,
          kind: 'MINE',
          hp: mHp,
          maxHp: mHp,
          speedMult: 1.08
        });

        if (level >= 1) {
          const shooterLane = (crateLane3 + 2) % 3;
          const shHp = Math.round(baseEnemyHP * 1.4);
          enemySchedule.push({
            spawnTime: cursorTime + 0.35,
            xNorm: (shooterLane + 0.5) / 3,
            kind: 'SHOOTER',
            hp: shHp,
            maxHp: shHp,
            speedMult: 0.82
          });
        }

        cursorTime += 2.7;
      }

      // 5. MAIN COMBAT WAVE (Swarmers + Armored Brutes + Support Units)
      const rowsInWave = 2 + Math.floor(w / 2);
      for (let r = 0; r < rowsInWave; r++) {
        const countInRow = 4 + (r % 2);
        for (let c = 0; c < countInRow; c++) {
          const xNorm = (c + 0.5) / countInRow;
          let kind: EnemyType = 'RUNNER';
          let hpMult = 0.95 + w * 0.2;
          let spdMult = 1.0;

          if (r === 0 && (c === 1 || c === countInRow - 2)) {
            kind = (sector >= 4 && c === 1) ? 'SHIELD_BEARER' : 'BRUTE';
            hpMult *= 2.5;
            spdMult = 0.78;
          } else if (r === rowsInWave - 1 && c === Math.floor(countInRow / 2)) {
            if (level >= 15 && Math.random() < 0.4) {
              kind = 'HEALER_DRONE';
              hpMult *= 1.1;
              spdMult = 0.72;
            } else {
              kind = (w + r) % 2 === 0 ? 'SHOOTER' : 'SPRINTER';
              hpMult *= kind === 'SHOOTER' ? 1.45 : 0.72;
              spdMult = kind === 'SPRINTER' ? 2.1 : 0.85;
            }
          }

          const hp = Math.round(baseEnemyHP * hpMult);
          enemySchedule.push({
            spawnTime: cursorTime + r * 1.3 + (c % 2) * 0.15,
            xNorm,
            kind,
            hp,
            maxHp: hp,
            speedMult: spdMult
          });
        }
      }

      cursorTime += rowsInWave * 1.4 + 3.0;
    }

    // 6. FINAL BOSS WAVE
    gateQueue.push({
      spawnTime: cursorTime - 1.0,
      lane: 0,
      kind: 'CHARGE_ADD',
      val: 1,
      maxVal: maxAddCap,
      hitsPerStep: hitsPerIncrement
    });
    gateQueue.push({
      spawnTime: cursorTime - 1.0,
      lane: 1,
      kind: 'BUFF_GATE',
      boostType: 'AP',
      label: '⚡ BOSS BREAKER (AP)',
      color: '#fde047',
      lockHitsRemaining: 12,
      lockHitsMax: 12
    });

    cursorTime += 2.2;

    for (let i = 0; i < 4; i++) {
      const isBrute = i === 1 || i === 2;
      const eHp = Math.round(baseEnemyHP * (isBrute ? 2.3 : 1.25));
      enemySchedule.push({
        spawnTime: cursorTime,
        xNorm: (i + 0.5) / 4,
        kind: isBrute ? 'BRUTE' : 'SHOOTER',
        hp: eHp,
        maxHp: eHp,
        speedMult: 0.82
      });
    }

    const bossMult = isTitan ? 17 : isWarden ? 11.5 : 7.2;
    const bossHP = Math.round(baseEnemyHP * bossMult);
    const bossKind: EnemyType = isTitan ? 'TITAN' : isWarden ? 'WARDEN' : 'CAPTAIN';

    enemySchedule.push({
      spawnTime: cursorTime + 1.4,
      xNorm: 0.5,
      kind: bossKind,
      name: isTitan ? `TITAN MK-${Math.max(1, Math.floor(level / 10))}` : isWarden ? `WARDEN LV.${level}` : `COMMANDER #${level}`,
      hp: bossHP,
      maxHp: bossHP,
      speedMult: 0.52
    });

    return {
      level,
      sector,
      biome,
      tier,
      isBossLevel: isTitan || isWarden,
      isTitanLevel: isTitan,
      scrollSpeed,
      totalEnemies: enemySchedule.length,
      gateQueue,
      crateQueue,
      enemySchedule,
      obstacleQueue,
      coinReward: Math.round(55 + level * 22 + (isTitan ? 110 : isWarden ? 55 : 0))
    };
  }

  public static spawnEnemyEntity(
    eDef: EnemyScheduleItem, 
    cw: number, 
    scrollSpeed: number
  ): Enemy {
    const margin = 32;
    const x = margin + eDef.xNorm * (cw - margin * 2);
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

    const enemy: Enemy = {
      id: Math.floor(Math.random() * 10000000),
      type: eDef.kind,
      x,
      y: -r - 15,
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
      shootCooldown: 1.4 + Math.random() * 1.1,
      hitFlash: 0,
      bossPhase: Math.random() * Math.PI * 2,
      healTimer: eDef.kind === 'HEALER_DRONE' ? 1.8 : undefined,
      active: true,
    };

    if (isBoss) {
      const plateHp = Math.round(eDef.hp * 0.22);
      enemy.armorPlates = [
        { id: 'left', hp: plateHp, maxHp: plateHp, broken: false, relX: -r * 0.85, relY: 0, w: r * 0.7, h: r * 1.2 },
        { id: 'right', hp: plateHp, maxHp: plateHp, broken: false, relX: r * 0.85, relY: 0, w: r * 0.7, h: r * 1.2 },
      ];
      enemy.enraged = false;
      enemy.enrageDeployed = false;
    }

    return enemy;
  }
}
