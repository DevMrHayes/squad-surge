// Squad Surge: 100-Level Tactical Wave & Split-Lane Dilemma Generator
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
  public static generate(level: number, cw: number = 380): LevelPlan {
    const sector: SectorId = getSectorForLevel(level);
    const biome = SECTOR_BIOMES[sector];

    const isTitan = level % 10 === 0;
    const isWarden = !isTitan && (level % 5 === 0);
    const isBossLevel = isTitan || isWarden;
    const tier = level >= 70 ? 5 : level >= 45 ? 4 : level >= 25 ? 3 : level >= 10 ? 2 : 1;

    // Determine Distinct Mission Archetype
    let archetype: MissionArchetypeConfig;
    if (isTitan) {
      archetype = {
        id: 'TITAN_SHOWDOWN',
        badge: '☠️ TITAN CLASH',
        badgeColor: '#ef4444',
        title: `TITAN SHOWDOWN #${Math.max(1, Math.floor(level / 10))}`,
        advisory: 'Destroy the left and right weak-point armor plates first. Watch for the Phase 2 enrage minefields!',
        featuredBuff: 'AP ROUNDS'
      };
    } else if (isWarden) {
      archetype = {
        id: 'TITAN_SHOWDOWN',
        badge: '👑 WARDEN ASSAULT',
        badgeColor: '#ec4899',
        title: `WARDEN ASSAULT LV.${level}`,
        advisory: 'Focus fire on the Warden weak-points while dodging high-damage mortar artillery shells.',
        featuredBuff: 'AP ROUNDS'
      };
    } else {
      const mode = (level - 1) % 5;
      if (mode === 0) {
        archetype = {
          id: 'SWARM_INFILTRATION',
          badge: '⚡ SWARM INFILTRATION',
          badgeColor: '#fb923c',
          title: `Rapid Sprinter Infiltration`,
          advisory: 'High-speed sprinters rush in staggered flanks. Slide laterally to intercept and claim the Shotgun Vanguard crate!',
          featuredBuff: 'VANGUARD SHOTGUNS'
        };
      } else if (mode === 1) {
        archetype = {
          id: 'ARMORED_SIEGE',
          badge: '🛡️ ARMORED PHALANX',
          badgeColor: '#38bdf8',
          title: `Heavy Armor Siege`,
          advisory: 'Armored Brutes and Shield Bearers advance in tight formation. Deflect shots through Ricochet Prism mirrors and claim AP Rounds!',
          featuredBuff: 'AP ROUNDS'
        };
      } else if (mode === 2) {
        archetype = {
          id: 'ARTILLERY_STORM',
          badge: '🎯 ARTILLERY BARRAGE',
          badgeColor: '#c084fc',
          title: `Trench Mortar Encampment`,
          advisory: 'Backline artillery lob shells over gates. Use Yellow EMP Mortars or Cyan Snipers to neutralize them before perimeter breach.',
          featuredBuff: 'EMP MORTARS'
        };
      } else if (mode === 3) {
        archetype = {
          id: 'PRECISION_GRID',
          badge: '⚡ PRECISION GRID',
          badgeColor: '#fde047',
          title: `Oscillating Highway Grid`,
          advisory: 'Sliding gates and alternating speed/hazard strips test your reflexes. Stand on Speed Strips for +50% fire rate.',
          featuredBuff: 'SPEED STRIPS'
        };
      } else {
        archetype = {
          id: 'CONVERSION_ZONE',
          badge: '🔮 CONVERSION ALTAR',
          badgeColor: '#a855f7',
          title: `High-Risk Weapon Evolution`,
          advisory: 'Sacrifice squad soldiers at the dark conversion altar to evolve your squad with Piercing Lasers or Homing Micro-Missiles.',
          featuredBuff: 'WEAPON EVOLUTION'
        };
      }
    }

    // Smooth wave count progression: L1-2 = 2 waves, L3-8 = 3 waves, scaling to 6 waves max
    const waveCount = level <= 2 ? 2 : Math.min(6, 2 + Math.floor(level / 8));

    // Smooth enemy HP curve (Eliminates the impossible Level 2 wall)
    const scaleFactor = 1 + (level - 1) * 0.08 + Math.pow(Math.max(0, level - 1), 1.4) * 0.010;
    const baseEnemyHP = Math.round(16 * scaleFactor);
    const scrollSpeed = Math.min(68, 42 + level * 0.22);

    // Gate caps & charge requirements
    const maxAddCap = Math.min(26, 8 + Math.floor(level * 0.25));
    const hitsPerIncrement = Math.min(16, 6 + Math.floor(level * 0.12));

    const gateQueue: GateQueueItem[] = [];
    const crateQueue: CrateQueueItem[] = [];
    const enemySchedule: EnemyScheduleItem[] = [];
    const obstacleQueue: ObstacleQueueItem[] = [];

    let cursorTime = 1.0;

    for (let w = 0; w < waveCount; w++) {
      const greedLane = (w + level) % 2; // 0 = Left, 1 = Right
      const threatLane = 1 - greedLane;
      const pairId = (level * 1000) + (w * 10) + 1; // Mutual exclusion pair identifier

      const isLockedMult = (w === waveCount - 1) && (level >= 3);
      const isAltarWave = (archetype.id === 'CONVERSION_ZONE' && w === 0) || (sector >= 4 && w === 1 && level >= 61);
      const isTacticalBuffGate = !isAltarWave && (w % 2 === 1) && (level >= 2);
      const isQuantumWave = sector === 5 && w % 2 === 0;

      // 1. GATES
      if (isAltarWave) {
        // Sacrifice / Conversion Altar
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: 'ALTAR',
          val: 0,
          maxVal: 0,
          hitsPerStep: 1,
          altarSacrificeCost: Math.min(20, 8 + Math.floor(level * 0.12)),
          altarWeaponReward: (w + level) % 2 === 0 ? 'laserWeapon' : 'homingMissiles',
          pairId,
        });
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: 'HAZARD',
          val: -(2 + Math.floor(level * 0.2)),
          maxVal: 4,
          hitsPerStep: hitsPerIncrement,
          pairId,
        });
      } else if (isLockedMult) {
        const lockHits = Math.min(20, Math.round(8 + level * 0.3));
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: 'LOCKED_MULT',
          val: 2,
          lockHitsRemaining: lockHits,
          lockHitsMax: lockHits,
          pairId,
        });
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: level <= 3 ? 'CHARGE_ADD' : 'HAZARD',
          val: level <= 3 ? 3 : -(2 + Math.floor(level * 0.25)),
          maxVal: maxAddCap,
          hitsPerStep: hitsPerIncrement,
          pairId,
        });
      } else if (isTacticalBuffGate) {
        const buffType = archetype.id === 'ARMORED_SIEGE' ? 'AP' 
                       : archetype.id === 'SWARM_INFILTRATION' ? 'CRYO'
                       : archetype.id === 'ARTILLERY_STORM' ? 'BLAST'
                       : 'FIRERATE';
        const label = buffType === 'AP' ? '⚡ AP ROUNDS (2.5x vs 🛡️)'
                    : buffType === 'CRYO' ? '❄️ CRYO SLOW (-45% SPD)'
                    : buffType === 'BLAST' ? '💥 BLAST SPLASH AoE'
                    : '🔥 FIRE RATE +25%';
        const color = buffType === 'AP' ? '#fde047'
                    : buffType === 'CRYO' ? '#22d3ee'
                    : buffType === 'BLAST' ? '#fb923c'
                    : '#f43f5e';
        const lockHits = Math.min(16, Math.round(6 + level * 0.25));

        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: 'BUFF_GATE',
          boostType: buffType,
          label,
          color,
          lockHitsRemaining: lockHits,
          lockHitsMax: lockHits,
          pairId,
        });
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: 'CHARGE_ADD',
          val: level <= 2 ? 3 : -(1 + Math.floor(level * 0.15)),
          maxVal: Math.max(6, Math.floor(maxAddCap * 0.8)),
          hitsPerStep: hitsPerIncrement,
          pairId,
        });
      } else {
        // Chargeable Gate
        const startVal = level <= 2 ? (w === 0 ? 4 : 3) : Math.max(-3, 2 - Math.floor(level * 0.15) - w);
        const isSliding = (archetype.id === 'PRECISION_GRID') || (sector >= 2 && Math.random() < 0.5);
        gateQueue.push({
          spawnTime: cursorTime,
          lane: greedLane,
          kind: isQuantumWave ? 'QUANTUM' : 'CHARGE_ADD',
          val: startVal,
          maxVal: maxAddCap,
          hitsPerStep: hitsPerIncrement,
          sliding: isSliding,
          flipPolarity: isQuantumWave,
          pairId,
        });
        gateQueue.push({
          spawnTime: cursorTime,
          lane: threatLane,
          kind: 'CHARGE_ADD',
          val: level <= 2 ? 2 : Math.max(-4, 1 - Math.floor(level * 0.2)),
          maxVal: Math.max(4, maxAddCap - 2),
          hitsPerStep: hitsPerIncrement,
          pairId,
        });
      }

      // 2. FIELD OBSTACLES (Prism Mirrors in Armored Siege; Speed/Hazard Strips in Precision Grid)
      if (archetype.id === 'ARMORED_SIEGE' || sector === 3 || (sector > 3 && Math.random() < 0.45)) {
        obstacleQueue.push({
          spawnTime: cursorTime + 0.6,
          type: 'PRISM_MIRROR',
          lane: greedLane === 0 ? 'LEFT' : 'RIGHT',
          angleDeg: greedLane === 0 ? 45 : -45,
        });
      }

      if (archetype.id === 'PRECISION_GRID' || (sector >= 2 && Math.random() < 0.4 && w > 0)) {
        obstacleQueue.push({
          spawnTime: cursorTime + 1.2,
          type: Math.random() < 0.6 ? 'SPEED_STRIP' : 'HAZARD_STRIP',
          lane: threatLane === 0 ? 'LEFT' : 'RIGHT',
          angleDeg: 0,
          overclockRate: 1.5,
          dragFactor: 0.65,
        });
      }

      // 3. SPRINTERS & FLANKERS
      if (level >= 2) {
        const isSwarm = archetype.id === 'SWARM_INFILTRATION';
        const sprinterCount = level <= 3 
          ? (w === 0 ? (isSwarm ? 1 : 0) : 1) 
          : isSwarm 
          ? Math.min(4, 2 + Math.floor(w / 2)) 
          : Math.min(2, 1 + Math.floor(w / 3));

        for (let s = 0; s < sprinterCount; s++) {
          const laneCenter = threatLane === 0 ? 0.25 : 0.75;
          const jitter = isSwarm ? (s % 2 === 0 ? -0.1 : 0.1) : 0;
          const sHp = Math.round(baseEnemyHP * 0.65);
          enemySchedule.push({
            spawnTime: cursorTime + 0.5 + s * (isSwarm ? 0.5 : 0.8),
            xNorm: Math.max(0.12, Math.min(0.88, laneCenter + jitter)),
            kind: 'SPRINTER',
            hp: sHp,
            maxHp: sHp,
            speedMult: level <= 3 ? 1.55 : isSwarm ? 2.1 : 1.85
          });
        }
      }

      cursorTime += 2.8;

      // 4. ARMORY CRATES & SPECIALISTS
      if (level >= 2 && (w % 2 === 0 || w === waveCount - 1)) {
        const boostType = archetype.id === 'SWARM_INFILTRATION' ? 'VANGUARD'
                        : archetype.id === 'ARMORED_SIEGE' ? 'AP'
                        : archetype.id === 'ARTILLERY_STORM' ? 'MORTAR'
                        : archetype.id === 'PRECISION_GRID' ? 'FIRERATE'
                        : 'BLAST';
        const label = boostType === 'VANGUARD' ? '⚡ +2 VANGUARD SPECS'
                    : boostType === 'AP' ? '⚡ AP ROUNDS (2.5x vs 🛡️)'
                    : boostType === 'MORTAR' ? '🟡 +1 EMP MORTAR SPEC'
                    : boostType === 'FIRERATE' ? '🔥 FIRE RATE +35%'
                    : '💥 BLAST SPLASH AoE';
        const color = boostType === 'VANGUARD' ? '#f97316'
                    : boostType === 'AP' ? '#fde047'
                    : boostType === 'MORTAR' ? '#eab308'
                    : boostType === 'FIRERATE' ? '#f43f5e'
                    : '#fb923c';

        const crateHP = Math.round(baseEnemyHP * (1.3 + w * 0.2));
        const crateLane3 = (level + w) % 3;
        crateQueue.push({
          spawnTime: cursorTime,
          lane3: crateLane3,
          hp: crateHP,
          maxHp: crateHP,
          boostType,
          label,
          color,
        });

        // Mines appear in Artillery & Precision Grid starting Level 3+
        if (level >= 3 && (archetype.id === 'ARTILLERY_STORM' || archetype.id === 'PRECISION_GRID' || level >= 6)) {
          const mineLane = (crateLane3 + 1) % 3;
          const mHp = Math.round(baseEnemyHP * 0.75);
          enemySchedule.push({
            spawnTime: cursorTime + 0.2,
            xNorm: (mineLane + 0.5) / 3,
            kind: 'MINE',
            hp: mHp,
            maxHp: mHp,
            speedMult: 1.05
          });
        }

        // Shooters appear in Artillery Storm & higher levels
        if (level >= 4 && (archetype.id === 'ARTILLERY_STORM' || level >= 8)) {
          const shooterLane = (crateLane3 + 2) % 3;
          const shHp = Math.round(baseEnemyHP * 1.25);
          enemySchedule.push({
            spawnTime: cursorTime + 0.4,
            xNorm: (shooterLane + 0.5) / 3,
            kind: 'SHOOTER',
            hp: shHp,
            maxHp: shHp,
            speedMult: 0.80
          });
        }

        cursorTime += 2.4;
      }

      // 5. MAIN COMBAT WAVE
      const rowsInWave = level <= 2 ? 1 : Math.min(3, 1 + Math.floor(w / 2));
      for (let r = 0; r < rowsInWave; r++) {
        const countInRow = level === 1 ? 3 : level === 2 ? 4 : 4 + (r % 2);
        for (let c = 0; c < countInRow; c++) {
          const xNorm = (c + 0.5) / countInRow;
          let kind: EnemyType = 'RUNNER';
          let hpMult = 0.9 + w * 0.15;
          let spdMult = 1.0;

          // Armored Siege focuses on Brutes & Shield Bearers
          if (level >= 4 && r === 0 && (c === 1 || c === countInRow - 2)) {
            const isSiege = archetype.id === 'ARMORED_SIEGE';
            kind = (isSiege && c === 1) || sector >= 4 ? 'SHIELD_BEARER' : 'BRUTE';
            hpMult *= isSiege ? 2.4 : 2.0;
            spdMult = 0.76;
          } else if (level >= 15 && r === rowsInWave - 1 && c === Math.floor(countInRow / 2) && Math.random() < 0.35) {
            kind = 'HEALER_DRONE';
            hpMult *= 1.1;
            spdMult = 0.72;
          }

          const hp = Math.round(baseEnemyHP * hpMult);
          enemySchedule.push({
            spawnTime: cursorTime + r * 1.2 + (c % 2) * 0.12,
            xNorm,
            kind,
            hp,
            maxHp: hp,
            speedMult: spdMult
          });
        }
      }

      cursorTime += rowsInWave * 1.3 + 2.5;
    }

    // 6. BOSS WAVE (Only for levels % 5 === 0 or % 10 === 0)
    if (isBossLevel) {
      const bossPairId = (level * 1000) + 99;
      gateQueue.push({
        spawnTime: cursorTime - 1.0,
        lane: 0,
        kind: 'CHARGE_ADD',
        val: 3,
        maxVal: maxAddCap,
        hitsPerStep: hitsPerIncrement,
        pairId: bossPairId,
      });
      gateQueue.push({
        spawnTime: cursorTime - 1.0,
        lane: 1,
        kind: 'BUFF_GATE',
        boostType: 'AP',
        label: '⚡ BOSS BREAKER (AP)',
        color: '#fde047',
        lockHitsRemaining: Math.min(14, 8 + Math.floor(level * 0.2)),
        lockHitsMax: Math.min(14, 8 + Math.floor(level * 0.2)),
        pairId: bossPairId,
      });

      cursorTime += 1.8;

      // Boss escort
      for (let i = 0; i < (isTitan ? 4 : 2); i++) {
        const isBrute = i % 2 === 0;
        const eHp = Math.round(baseEnemyHP * (isBrute ? 1.8 : 1.1));
        enemySchedule.push({
          spawnTime: cursorTime,
          xNorm: (i + 0.5) / (isTitan ? 4 : 2),
          kind: isBrute ? 'BRUTE' : 'SHOOTER',
          hp: eHp,
          maxHp: eHp,
          speedMult: 0.80
        });
      }

      const bossMult = isTitan ? 14 : 8.5;
      const bossHP = Math.round(baseEnemyHP * bossMult);
      const bossKind: EnemyType = isTitan ? 'TITAN' : 'WARDEN';

      enemySchedule.push({
        spawnTime: cursorTime + 1.2,
        xNorm: 0.5,
        kind: bossKind,
        name: isTitan ? `TITAN MK-${Math.max(1, Math.floor(level / 10))}` : `WARDEN LV.${level}`,
        hp: bossHP,
        maxHp: bossHP,
        speedMult: 0.50
      });
    }

    return {
      level,
      sector,
      biome,
      archetype,
      tier,
      isBossLevel,
      isTitanLevel: isTitan,
      scrollSpeed,
      totalEnemies: enemySchedule.length,
      gateQueue,
      crateQueue,
      enemySchedule,
      obstacleQueue,
      coinReward: Math.round(50 + level * 14 + (isTitan ? 100 : isWarden ? 50 : 0))
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
      shootCooldown: 1.5 + Math.random() * 1.0,
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
