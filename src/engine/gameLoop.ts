// Squad Surge: Core 60FPS Time-Scheduled Game Loop & State Manager
import { 
  PlayerState, 
  LevelPlan, 
  Gate, 
  Crate,
  FieldObstacle, 
  Enemy, 
  EnemyMortarShell,
  Bullet, 
  Particle, 
  Shockwave,
  FloatingText,
  GateQueueItem,
  CrateQueueItem,
  EnemyScheduleItem,
  ObstacleQueueItem,
  SaveData,
  SectorId,
  MissionAccolade
} from '../types/game';
import { SECTOR_BIOMES } from '../constants/biomes';
import { WaveGenerator } from './waveGenerator';
import { CombatEngine } from './combat';
import { GameRenderer } from './renderer';
import { storage } from '../services/storage';
import { sfx } from '../services/audio';

export type GameMode = 'READY' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';

export interface GameOverDetails {
  isEndless?: boolean;
  timeSurvived?: number;
  threatLevel?: number;
  isNewRecord?: boolean;
  prevBest?: number;
  accolades?: MissionAccolade[];
}

export class GameLoop {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public cw: number = 380;
  public ch: number = 640;

  public mode: GameMode = 'READY';
  public currentLevel: number = 1;
  public isEndless: boolean = false;
  public endlessThreatLevel: number = 1;
  public endlessTimeSurvived: number = 0;
  private endlessNextCursorTime: number = 0;
  private celebratedNewRecord: boolean = false;
  public plan: LevelPlan;
  public elapsed: number = 0;
  public trauma: number = 0;

  // Boss Arena Standoff & Accolade Benchmark Metrics
  public isBossArenaActive: boolean = false;
  public arenaBoss: Enemy | null = null;
  public soldiersLostInLevel: number = 0;
  public highestSquadInLevel: number = 0;
  public ricochetKillsInLevel: number = 0;
  public altarUsedInLevel: boolean = false;
  public bossDefeatedInLevel: 'TITAN' | 'WARDEN' | 'CAPTAIN' | null = null;
  public endlessMilestonesClaimed: Set<number> = new Set();

  public player: PlayerState;
  public gates: Gate[] = [];
  public crates: Crate[] = [];
  public obstacles: FieldObstacle[] = [];
  public enemies: Enemy[] = [];
  public enemyMortars: EnemyMortarShell[] = [];
  public bullets: Bullet[] = [];
  public particles: Particle[] = [];
  public shockwaves: Shockwave[] = [];
  public floatTexts: FloatingText[] = [];

  // Queues
  private gateQueue: GateQueueItem[] = [];
  private crateQueue: CrateQueueItem[] = [];
  private enemySchedule: EnemyScheduleItem[] = [];
  private obstacleQueue: ObstacleQueueItem[] = [];

  public enemiesKilled: number = 0;
  public sessionCoinsEarned: number = 0;
  public sessionScore: number = 0;
  public targetX: number = 190;
  public isDragging: boolean = false;
  public dualThumbBannerTimer: number = 0;

  private lastTS: number = 0;
  private animFrameId: number | null = null;

  private onHUDUpdate?: (level: number, left: number, total: number, coins: number, isEndless?: boolean, endlessTime?: number, endlessThreat?: number) => void;
  private onGameOver?: (won: boolean, coinsEarned: number, reason?: string, details?: GameOverDetails) => void;

  constructor(
    canvas: HTMLCanvasElement, 
    callbacks: {
      onHUDUpdate: (level: number, left: number, total: number, coins: number, isEndless?: boolean, endlessTime?: number, endlessThreat?: number) => void;
      onGameOver: (won: boolean, coinsEarned: number, reason?: string, details?: GameOverDetails) => void;
    }
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onHUDUpdate = callbacks.onHUDUpdate;
    this.onGameOver = callbacks.onGameOver;

    this.player = this.createDefaultPlayer();
    this.plan = WaveGenerator.generate(1, this.cw);

    this.setupTouchControls();
    this.resize();
  }

  private createDefaultPlayer(): PlayerState {
    const save = storage.getSave();
    const startCount = 5 + (save.upgrades.startSquad - 1) * 2;
    return {
      x: this.cw / 2,
      y: this.ch * 0.78,
      count: startCount,
      shields: 0,
      maxVisualBarrels: 14,
      fireTimer: 0,
      sniperTimer: 0,
      vanguardTimer: 0,
      mortarTimer: 0,
      members: [],
      specialists: {
        sniper: 0,
        vanguard: 0,
        mortar: 0,
      },
      buffs: {
        apTimer: 0,
        cryoTimer: 0,
        rapidTimer: 0,
        blastTimer: 0,
        laserWeapon: false,
        homingMissiles: false,
        splitSquadTimer: 0,
      },
      leftWingX: this.cw * 0.28,
      rightWingX: this.cw * 0.72,
      targetLeftX: this.cw * 0.28,
      targetRightX: this.cw * 0.72,
      dragSpeedMultiplier: 1.0,
      fireRateMultiplier: 1.0,
    };
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || { width: 380, height: 640 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = Math.max(320, rect.width);
    this.ch = Math.max(480, rect.height);

    this.canvas.width = Math.floor(this.cw * dpr);
    this.canvas.height = Math.floor(this.ch * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.player) {
      this.player.y = this.ch * 0.78;
      if (this.mode === 'READY') {
        this.player.x = this.cw / 2;
        this.targetX = this.cw / 2;
        // Re-align any pre-spawned ready gates to current tablet/phone width
        const margin = 18;
        const centerDividerW = 24;
        const laneW = (this.cw - margin * 2 - centerDividerW) / 2;
        for (const g of this.gates) {
          g.w = laneW;
          g.x = g.lane === 'LEFT'
            ? margin + laneW / 2
            : margin + laneW + centerDividerW + laneW / 2;
        }
      }
    }
  }

  public initLevel(lvl: number, isEndless: boolean = false): void {
    if (this.isEndless && this.endlessTimeSurvived > 0) {
      storage.updateEndlessBestTime(this.endlessTimeSurvived, this.endlessThreatLevel);
    }
    this.isEndless = isEndless;
    this.elapsed = 0;
    this.trauma = 0;
    this.enemiesKilled = 0;
    this.sessionCoinsEarned = 0;
    this.sessionScore = 0;

    // Reset Boss Arena Standoff & Accolade Metrics
    this.isBossArenaActive = false;
    this.arenaBoss = null;
    this.soldiersLostInLevel = 0;
    this.highestSquadInLevel = 5;
    this.ricochetKillsInLevel = 0;
    this.altarUsedInLevel = false;
    this.bossDefeatedInLevel = null;
    this.endlessMilestonesClaimed.clear();

    if (isEndless) {
      this.currentLevel = 1;
      this.endlessThreatLevel = 1;
      this.endlessTimeSurvived = 0;
      this.celebratedNewRecord = false;
      this.plan = WaveGenerator.generateEndlessInitialPlan(this.cw);
      this.endlessNextCursorTime = 11.15;
    } else {
      this.currentLevel = Math.max(1, Math.min(100, lvl));
      this.plan = WaveGenerator.generate(this.currentLevel, this.cw);
    }

    this.player = this.createDefaultPlayer();
    this.highestSquadInLevel = this.player.count;
    this.targetX = this.cw / 2;
    this.player.x = this.cw / 2;

    this.gates = [];
    this.crates = [];
    this.obstacles = [];
    this.enemies = [];
    this.enemyMortars = [];
    this.bullets = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatTexts = [];

    // Clone queues
    this.gateQueue = [...this.plan.gateQueue];
    this.crateQueue = [...this.plan.crateQueue];
    this.enemySchedule = [...this.plan.enemySchedule];
    this.obstacleQueue = [...this.plan.obstacleQueue];

    // Pre-spawn first gate dilemma on-screen at ch * 0.22 so player immediately sees it
    if (this.gateQueue.length > 0) {
      const firstTime = this.gateQueue[0].spawnTime;
      while (this.gateQueue.length > 0 && Math.abs(this.gateQueue[0].spawnTime - firstTime) < 0.1) {
        this.spawnGateEntity(this.gateQueue.shift()!, this.ch * 0.22);
      }
    }

    CombatEngine.updateSquadFormation(this.player);
    this.mode = 'READY';
    this.notifyHUD();
  }

  public startCombat(): void {
    if (this.mode === 'READY') {
      this.mode = 'PLAYING';
      sfx.startBGM();
    }
  }

  public pause(): void {
    if (this.mode === 'PLAYING') {
      this.mode = 'PAUSED';
      if (this.isEndless && this.endlessTimeSurvived > 0) {
        storage.updateEndlessBestTime(this.endlessTimeSurvived, this.endlessThreatLevel);
      }
      sfx.pauseBGM();
    }
  }

  public resume(): void {
    if (this.mode === 'PAUSED') {
      this.mode = 'PLAYING';
      sfx.resumeBGM();
    }
  }

  private activeTouches: Map<number, number> = new Map();

  private setupTouchControls(): void {
    const updateTouchPositions = () => {
      const isSplit = (this.player.buffs.splitSquadTimer ?? 0) > 0;
      if (this.activeTouches.size === 0) return;

      const xs = Array.from(this.activeTouches.values()).sort((a, b) => a - b);

      if (isSplit) {
        if (xs.length >= 2) {
          // Dual-touch: leftmost touch controls Left Wing, rightmost touch controls Right Wing
          this.player.targetLeftX = Math.max(28, Math.min(this.cw / 2 - 20, xs[0]));
          this.player.targetRightX = Math.max(this.cw / 2 + 20, Math.min(this.cw - 28, xs[xs.length - 1]));
        } else {
          // Single-touch during split: update targeted wing based on screen half
          const x = xs[0];
          if (x < this.cw / 2) {
            this.player.targetLeftX = Math.max(28, Math.min(this.cw / 2 - 20, x));
          } else {
            this.player.targetRightX = Math.max(this.cw / 2 + 20, Math.min(this.cw - 28, x));
          }
        }
      } else {
        this.targetX = Math.max(32, Math.min(this.cw - 32, xs[0]));
      }
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      const rect = this.canvas.getBoundingClientRect();
      this.activeTouches.set(e.pointerId, e.clientX - rect.left);
      updateTouchPositions();
      if (this.mode === 'READY') this.startCombat();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      if (this.activeTouches.has(e.pointerId)) {
        const rect = this.canvas.getBoundingClientRect();
        this.activeTouches.set(e.pointerId, e.clientX - rect.left);
        updateTouchPositions();
      }
    });

    window.addEventListener('pointerup', (e) => {
      this.activeTouches.delete(e.pointerId);
      if (this.activeTouches.size === 0) {
        this.isDragging = false;
      } else {
        updateTouchPositions();
      }
    });

    window.addEventListener('pointercancel', (e) => {
      this.activeTouches.delete(e.pointerId);
      if (this.activeTouches.size === 0) {
        this.isDragging = false;
      } else {
        updateTouchPositions();
      }
    });
  }

  private spawnGateEntity(gDef: GateQueueItem, overrideY?: number): void {
    const margin = 18;
    const centerDividerW = 24; // 24px distinct highway median
    const laneW = (this.cw - margin * 2 - centerDividerW) / 2;
    const x = gDef.lane === 0 
      ? margin + laneW / 2 
      : margin + laneW + centerDividerW + laneW / 2;

    this.gates.push({
      id: Math.random(),
      x,
      y: overrideY !== undefined ? overrideY : -45,
      w: laneW,
      h: 50,
      lane: gDef.lane === 0 ? 'LEFT' : 'RIGHT',
      kind: gDef.kind,
      val: gDef.val !== undefined ? gDef.val : 0,
      minVal: gDef.minVal !== undefined ? gDef.minVal : (gDef.val !== undefined ? gDef.val : 0),
      maxVal: gDef.maxVal !== undefined ? gDef.maxVal : 10,
      hitsPerStep: gDef.hitsPerStep || 10,
      chargeHits: 0,
      lockHitsRemaining: gDef.lockHitsRemaining || 0,
      lockHitsMax: gDef.lockHitsMax || 10,
      unlocked: gDef.kind === 'CHARGE_ADD' || gDef.kind === 'HAZARD' || gDef.kind === 'QUANTUM' || (gDef.kind === 'ALTAR' && (gDef.altarSacrificeCost ?? 0) <= 0),
      boostType: gDef.boostType,
      label: gDef.label,
      color: gDef.color,
      hitScale: 0,
      altarSacrificeCost: gDef.altarSacrificeCost,
      altarWeaponReward: gDef.altarWeaponReward,
      sliding: gDef.sliding,
      slideSpeed: 45,
      slideDir: 1,
      flipPolarity: gDef.flipPolarity,
      polarityTimer: 3.0,
      pairId: gDef.pairId,
    });
  }

  private spawnCrateEntity(cDef: CrateQueueItem): void {
    const margin = 20;
    const laneW = (this.cw - margin * 2) / 3;
    const x = margin + cDef.lane3 * laneW + laneW / 2;
    this.crates.push({
      id: Math.random(),
      x,
      y: -48,
      w: Math.min(136, laneW - 8),
      h: 48,
      hp: cDef.hp,
      maxHp: cDef.maxHp,
      boostType: cDef.boostType,
      label: cDef.label,
      color: cDef.color,
      hitScale: 0,
    });
  }

  private spawnObstacleEntity(oDef: ObstacleQueueItem): void {
    const isLeft = oDef.lane === 'LEFT';
    const scaleFactor = Math.max(1, Math.min(1.4, this.cw / 390));
    const prismMargin = Math.round(54 * scaleFactor);
    const prismX = isLeft ? prismMargin : this.cw - prismMargin;
    const stripX = isLeft ? this.cw * 0.27 : this.cw * 0.73;
    let ox = stripX;
    let ow = Math.round(116 * scaleFactor);
    let oh = 110;

    if (oDef.type === 'PRISM_MIRROR') {
      ox = prismX;
      ow = Math.round(78 * scaleFactor);
      oh = 76;
    } else if (oDef.type === 'BEAM_SPLITTER') {
      ox = this.cw / 2;
      ow = Math.round(42 * scaleFactor);
      oh = Math.round(42 * scaleFactor);
    }

    this.obstacles.push({
      id: Math.random(),
      type: oDef.type,
      x: ox,
      y: -50,
      width: ow,
      height: oh,
      angleDeg: oDef.angleDeg,
      lane: oDef.lane,
      overclockRate: oDef.overclockRate,
      dragFactor: oDef.dragFactor,
      active: true,
    });
  }

  public unlockTacticalBoost(boostType: string, x: number, y: number, color: string): void {
    const save = storage.getSave();
    save.coins += 10;
    this.sessionCoinsEarned += 10;
    this.sessionScore += 250;
    this.spawnFloatText(x, y - 48, '+10 🪙 CRATE BONUS', '#fbbf24');
    this.notifyHUD();
    const duration = this.isEndless ? 5.0 : 8.0;
    if (boostType === 'AP') {
      this.player.buffs.apTimer = duration;
      this.spawnFloatText(x, y - 24, '⚡ AP ROUNDS (2.5x vs 🛡️)!', color);
    } else if (boostType === 'CRYO') {
      this.player.buffs.cryoTimer = duration;
      this.spawnFloatText(x, y - 24, '❄️ CRYO SLOW ACTIVE!', color);
    } else if (boostType === 'BLAST') {
      this.player.buffs.blastTimer = duration;
      this.spawnFloatText(x, y - 24, '💥 BLAST SPLASH AoE!', color);
    } else if (boostType === 'FIRERATE') {
      this.player.buffs.rapidTimer = duration;
      this.spawnFloatText(x, y - 24, '🔥 FIRE RATE +35%!', color);
    } else if (boostType === 'SPLIT_SQUAD') {
      this.player.buffs.splitSquadTimer = 10.0;
      this.dualThumbBannerTimer = 2.8; // Trigger prominent "Dual thumb has split" banner!
      const spreadOffset = Math.min(84, this.cw * 0.22);
      this.player.leftWingX = Math.max(34, this.player.x - spreadOffset);
      this.player.rightWingX = Math.min(this.cw - 34, this.player.x + spreadOffset);
      this.player.targetLeftX = this.player.leftWingX;
      this.player.targetRightX = this.player.rightWingX;
      this.spawnFloatText(x, y - 24, '⚡ DUAL-THUMB SPLIT SQUAD (10s)!', '#38bdf8');
      if (this.shockwaves) {
        CombatEngine.createShockwave(x, y, '#38bdf8', this.shockwaves, 72);
      }
    } else if (boostType === 'SHIELD') {
      const shieldAdd = this.isEndless ? 1 : 2;
      this.player.shields = Math.min(this.isEndless ? 2 : 5, this.player.shields + shieldAdd);
      this.spawnFloatText(x, y - 24, `🛡️ +${shieldAdd} SQUAD SHIELDS!`, color);
    } else if (boostType === 'SNIPER') {
      const specAdd = this.isEndless ? 1 : 2;
      this.player.specialists.sniper = Math.min(this.isEndless ? 2 : 10, this.player.specialists.sniper + specAdd);
      this.spawnFloatText(x, y - 24, `💎 +${specAdd} SNIPER SPECS!`, '#06b6d4');
      CombatEngine.updateSquadFormation(this.player);
    } else if (boostType === 'VANGUARD') {
      const specAdd = this.isEndless ? 1 : 2;
      this.player.specialists.vanguard = Math.min(this.isEndless ? 2 : 10, this.player.specialists.vanguard + specAdd);
      this.spawnFloatText(x, y - 24, `⚡ +${specAdd} VANGUARD SPECS!`, '#f97316');
      CombatEngine.updateSquadFormation(this.player);
    } else if (boostType === 'MORTAR') {
      const specAdd = 1;
      this.player.specialists.mortar = Math.min(this.isEndless ? 1 : 5, this.player.specialists.mortar + specAdd);
      this.spawnFloatText(x, y - 24, '🟡 +1 EMP MORTAR SPEC!', '#eab308');
      CombatEngine.updateSquadFormation(this.player);
    }
  }

  public spawnFloatText(x: number, y: number, text: string, color: string, fontSize: number = 14): void {
    this.floatTexts.push({
      id: Math.random(),
      text,
      x,
      y,
      vy: -35,
      color,
      fontSize,
      alpha: 1.0,
      life: 0.9,
    });
  }

  public get enemiesLeft(): number {
    return Math.max(0, this.plan.totalEnemies - this.enemiesKilled);
  }

  public get totalEnemiesInLevel(): number {
    return this.plan.totalEnemies;
  }

  private damageSquad(lossCount: number, label: string): boolean {
    const squadY = this.ch * 0.78;
    if (this.player.shields > 0) {
      this.player.shields--;
      sfx.playExplosion(false);
      this.trauma = Math.min(1.0, this.trauma + 0.20);
      CombatEngine.createExplosionParticles(this.player.x, squadY, '#c084fc', this.particles, 14);
      CombatEngine.createShockwave(this.player.x, squadY, '#c084fc', this.shockwaves, 48);
      this.spawnFloatText(this.player.x, squadY - 28, '🛡️ SHIELD BLOCKED HIT!', '#c084fc');
      return false;
    }
    this.soldiersLostInLevel += lossCount;
    this.player.count = Math.max(0, this.player.count - lossCount);
    sfx.playLose();
    this.trauma = Math.min(1.0, this.trauma + 0.30);
    CombatEngine.createExplosionParticles(this.player.x, squadY, '#f43f5e', this.particles, 14);
    CombatEngine.createShockwave(this.player.x, squadY, '#f43f5e', this.shockwaves, 52);
    this.spawnFloatText(this.player.x, squadY - 28, label, '#f87171');
    CombatEngine.updateSquadFormation(this.player);

    if (this.player.count <= 0) {
      this.triggerDefeat('All soldiers in your squad were eliminated!');
      return true;
    }
    return false;
  }

  private triggerDefeat(reason: string): void {
    this.mode = 'DEFEAT';
    sfx.pauseBGM();
    sfx.playLose();

    if (this.isEndless) {
      const res = storage.recordEndlessRun(this.endlessTimeSurvived, this.endlessThreatLevel, this.sessionCoinsEarned);
      if (this.onGameOver) {
        this.onGameOver(false, this.sessionCoinsEarned, reason, {
          isEndless: true,
          timeSurvived: this.endlessTimeSurvived,
          threatLevel: this.endlessThreatLevel,
          isNewRecord: res.isNewRecord,
          prevBest: res.prevBest,
        });
      }
    } else {
      const consolation = Math.round(this.plan.coinReward * 0.25);
      storage.recordLoss(consolation);
      if (this.onGameOver) this.onGameOver(false, consolation, reason);
    }
  }

  private notifyHUD(): void {
    if (this.onHUDUpdate) {
      const save = storage.getSave();
      const remaining = this.isEndless ? 0 : Math.max(0, this.plan.totalEnemies - this.enemiesKilled);
      this.onHUDUpdate(
        this.currentLevel, 
        remaining, 
        this.isEndless ? 0 : this.plan.totalEnemies, 
        save.coins,
        this.isEndless,
        this.endlessTimeSurvived,
        this.endlessThreatLevel
      );
    }
  }

  public update(dt: number): void {
    if (this.mode !== 'PLAYING') return;

    this.elapsed += dt;

    if (this.isEndless) {
      this.endlessTimeSurvived += dt;
      // Threat increases every 10 seconds:
      // ~60s = Threat 7 (Midway)
      // ~120s (2m) = Threat 13 ("Good if you make it")
      // ~180s (3m) = Threat 19 ("Great if you make it")
      // ~300s (5m) = Threat 31 ("Incredible if you make it")
      const targetThreat = Math.floor(this.endlessTimeSurvived / 10) + 1;
      if (targetThreat > this.endlessThreatLevel) {
        this.endlessThreatLevel = targetThreat;
        const sId = Math.min(5, Math.ceil(targetThreat / 6)) as SectorId;
        this.plan.biome = SECTOR_BIOMES[sId];
        this.spawnFloatText(this.cw / 2, this.ch * 0.28, `⚡ THREAT LEVEL ${targetThreat}!`, '#fde047');
        sfx.playGateCharge();
        this.trauma = Math.min(1.0, this.trauma + 0.35);
      }
      if (!this.isBossArenaActive) {
        this.plan.scrollSpeed = Math.min(140, 75 + this.endlessThreatLevel * 2.2);
      } else {
        this.plan.scrollSpeed = 0;
      }

      // High-Yield Duration Accolade Milestones (scales with 2k+ upgrade costs):
      const durationMilestones = [
        { sec: 30, coins: 50, name: 'TACTICAL START (30 SEC)' },
        { sec: 60, coins: 150, name: 'INITIAL SURGE (1 MIN)' },
        { sec: 120, coins: 500, name: 'MOMENTUM (2 MIN)' },
        { sec: 180, coins: 1500, name: 'SUSTAINED PRESSURE (3 MIN)' },
        { sec: 300, coins: 5000, name: 'ENDLESS COLOSSUS (5 MIN)' },
        { sec: 420, coins: 10000, name: 'APEX VANGUARD (7 MIN)' },
        { sec: 600, coins: 25000, name: 'HIGHWAY GOD (10 MIN)' },
      ];
      for (const m of durationMilestones) {
        if (this.endlessTimeSurvived >= m.sec && !this.endlessMilestonesClaimed.has(m.sec)) {
          this.endlessMilestonesClaimed.add(m.sec);
          this.sessionCoinsEarned += m.coins;
          const save = storage.getSave();
          save.coins += m.coins;
          storage.saveLocal();
          sfx.playGateCharge();
          this.spawnFloatText(this.player.x, this.player.y - 36, `🎖️ ${m.name}: +${m.coins} 🪙!`, '#fbbf24', 13);
          this.notifyHUD();
        }
      }

      // In-Game Personal Best Surpassed Notification & Real-Time Auto-Save
      const prevBest = storage.getSave().stats.endlessBestTime || 0;
      if (this.endlessTimeSurvived > prevBest) {
        storage.updateEndlessBestTime(this.endlessTimeSurvived, this.endlessThreatLevel);
        if (!this.celebratedNewRecord && this.endlessTimeSurvived >= 5) {
          this.celebratedNewRecord = true;
          this.spawnFloatText(this.cw / 2, this.ch * 0.35, '🏆 NEW PERSONAL BEST SURPASSED!', '#34d399');
          sfx.playGateCharge();
          this.trauma = Math.min(1.0, this.trauma + 0.25);
        }
      }

      // Continuous endless queue refill
      if (this.gateQueue.length < 3 || this.enemySchedule.length < 8) {
        const chunk = WaveGenerator.generateEndlessChunk(this.endlessThreatLevel, this.endlessNextCursorTime, this.cw);
        this.gateQueue.push(...chunk.gateQueue);
        this.crateQueue.push(...chunk.crateQueue);
        this.enemySchedule.push(...chunk.enemySchedule);
        this.obstacleQueue.push(...chunk.obstacleQueue);
        this.endlessNextCursorTime = chunk.nextCursorTime;
      }
      this.notifyHUD();
    }

    // Camera trauma decay
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
    }

    // Active buffs timer decay
    if (this.player.buffs.apTimer > 0) this.player.buffs.apTimer -= dt;
    if (this.player.buffs.cryoTimer > 0) this.player.buffs.cryoTimer -= dt;
    if (this.player.buffs.rapidTimer > 0) this.player.buffs.rapidTimer -= dt;
    if (this.player.buffs.blastTimer > 0) this.player.buffs.blastTimer -= dt;
    if (this.player.buffs.splitSquadTimer > 0) this.player.buffs.splitSquadTimer -= dt;
    if (this.dualThumbBannerTimer > 0) this.dualThumbBannerTimer -= dt;

    // Reposition squad to ch * 0.69 to provide generous ~215px thumb navigation zone below the crew
    const squadY = this.ch * 0.69;
    this.player.y = squadY;

    // 1. Smooth squad movement toward targetX or dual wings
    const dragSpeed = 20 * this.player.dragSpeedMultiplier;
    const isSplitMode = (this.player.buffs.splitSquadTimer ?? 0) > 0;
    if (isSplitMode) {
      const targetL = this.player.targetLeftX ?? (this.cw * 0.28);
      const targetR = this.player.targetRightX ?? (this.cw * 0.72);
      this.player.leftWingX = (this.player.leftWingX ?? targetL) + (targetL - (this.player.leftWingX ?? targetL)) * Math.min(1.0, dragSpeed * dt);
      this.player.rightWingX = (this.player.rightWingX ?? targetR) + (targetR - (this.player.rightWingX ?? targetR)) * Math.min(1.0, dragSpeed * dt);
      this.player.leftWingX = Math.max(28, Math.min(this.cw / 2 - 20, this.player.leftWingX));
      this.player.rightWingX = Math.max(this.cw / 2 + 20, Math.min(this.cw - 28, this.player.rightWingX));
      this.player.x = (this.player.leftWingX + this.player.rightWingX) / 2;
    } else {
      this.player.x += (this.targetX - this.player.x) * Math.min(1.0, dragSpeed * dt);
      this.player.x = Math.max(34, Math.min(this.cw - 34, this.player.x));
      if (this.player.leftWingX !== undefined) {
        this.player.leftWingX += (this.player.x - this.player.leftWingX) * Math.min(1.0, 10 * dt);
      }
      if (this.player.rightWingX !== undefined) {
        this.player.rightWingX += (this.player.x - this.player.rightWingX) * Math.min(1.0, 10 * dt);
      }
    }

    // 2. Process Scheduled Spawns
    while (this.gateQueue.length > 0 && this.gateQueue[0].spawnTime <= this.elapsed) {
      this.spawnGateEntity(this.gateQueue.shift()!);
    }
    while (this.crateQueue.length > 0 && this.crateQueue[0].spawnTime <= this.elapsed) {
      this.spawnCrateEntity(this.crateQueue.shift()!);
    }
    while (this.enemySchedule.length > 0 && this.enemySchedule[0].spawnTime <= this.elapsed) {
      const eDef = this.enemySchedule.shift()!;
      this.enemies.push(WaveGenerator.spawnEnemyEntity(eDef, this.cw, this.plan.scrollSpeed));
    }
    while (this.obstacleQueue.length > 0 && this.obstacleQueue[0].spawnTime <= this.elapsed) {
      this.spawnObstacleEntity(this.obstacleQueue.shift()!);
    }

    // 3. Firing Volleys
    const save = storage.getSave();
    CombatEngine.firePlayerVolleys(
      this.player, 
      dt, 
      this.bullets, 
      save.upgrades.firepower, 
      save.upgrades.fireRate, 
      save.upgrades.armorPierce, 
      this.enemies
    );

    // 4. Update Bullets & Obstacle Interactions
    CombatEngine.updateBullets(this.bullets, dt, this.enemies, this.particles, (amt) => {
      this.trauma = Math.min(1.0, this.trauma + amt);
    }, this.shockwaves, this.cw);

    CombatEngine.handleObstacleInteractions(this.player, this.obstacles, this.bullets, dt, this.particles);

    // Prevent enemies from phasing or getting stuck: bounce them into open lanes
    CombatEngine.handleEnemyObstacleCollisions(this.enemies, this.obstacles, this.cw, dt);
    CombatEngine.keepEnemiesBehindBarriers(this.enemies, this.gates, this.crates, squadY);

    CombatEngine.handleGateAndCrateHits(
      this.gates, 
      this.crates, 
      this.bullets, 
      this.particles, 
      this.floatTexts,
      (type, x, y, col) => this.unlockTacticalBoost(type, x, y, col),
      this.shockwaves
    );

    const prevRicochet = save.stats.ricochetKills || 0;
    CombatEngine.handleEnemyInteractions(
      this.player, 
      this.enemies, 
      this.bullets, 
      this.particles, 
      this.floatTexts, 
      dt, 
      save.upgrades.armorPierce,
      (amt) => { this.trauma = Math.min(1.0, this.trauma + amt); },
      save.stats,
      this.shockwaves
    );
    if ((save.stats.ricochetKills || 0) > prevRicochet) {
      this.ricochetKillsInLevel += ((save.stats.ricochetKills || 0) - prevRicochet);
    }

    // 5. Update Descending Gates
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.y += this.plan.scrollSpeed * dt;
      if (g.hitScale > 0) g.hitScale = Math.max(0, g.hitScale - dt * 6);

      // Sliding gate horizontal oscillation (only for unpaired single gates; paired gates stay strictly in their own lane)
      if (g.sliding && !g.pairId) {
        g.x += (g.slideSpeed || 48) * (g.slideDir || 1) * dt;
        const minX = 28 + g.w / 2;
        const maxX = this.cw - 28 - g.w / 2;
        if (g.x <= minX) { g.x = minX; g.slideDir = 1; }
        if (g.x >= maxX) { g.x = maxX; g.slideDir = -1; }
      }

      if (g.y > this.ch + 45) {
        this.gates.splice(i, 1);
      }
    }

    // Prioritize cleared/positive reward gates first when resolving gate traversal at squadY
    const getGatePriority = (g: typeof this.gates[number]): number => {
      if ((g.kind === 'LOCKED_MULT' || g.kind === 'BUFF_GATE') && g.unlocked) return 100 + g.val;
      if (g.kind === 'ALTAR' && (g.altarSacrificeCost ?? 0) <= 0) return 95;
      if ((g.kind === 'CHARGE_ADD' || g.kind === 'QUANTUM') && g.val > 0) return 50 + g.val;
      if (g.kind === 'HAZARD' && g.val >= 0) return 10;
      if ((g.kind === 'LOCKED_MULT' || g.kind === 'BUFF_GATE') && !g.unlocked) return 0;
      if (g.kind === 'ALTAR') return -50 - (g.altarSacrificeCost ?? 0);
      return -100 + g.val;
    };

    const touchedGates = this.gates
      .filter(g => {
        if (Math.abs(g.y - squadY) > 22) return false;
        const halfW = g.w / 2 - 2; // Strictly within visual gate bounds (never bleeding across the center median)
        if (isSplitMode) {
          const lx = this.player.leftWingX ?? this.player.x;
          const rx = this.player.rightWingX ?? this.player.x;
          return Math.abs(g.x - lx) <= halfW || Math.abs(g.x - rx) <= halfW;
        }
        return Math.abs(g.x - this.player.x) <= halfW;
      })
      .sort((a, b) => getGatePriority(b) - getGatePriority(a));

    for (const g of touchedGates) {
      const idx = this.gates.findIndex(item => item.id === g.id);
      if (idx === -1) continue; // Already shattered by sibling mutual exclusion

      // MUTUAL EXCLUSION: If gate is paired, shatter the sibling gate in this dilemma row
      if (g.pairId) {
        for (let s = this.gates.length - 1; s >= 0; s--) {
          const sib = this.gates[s];
          if (sib.id !== g.id && sib.pairId === g.pairId) {
            CombatEngine.createExplosionParticles(sib.x, sib.y, '#94a3b8', this.particles, 10, true);
            this.spawnFloatText(sib.x, squadY - 24, '🚫 LOCKED OUT', '#94a3b8');
            this.gates.splice(s, 1);
          }
        }
      }

      const squadCap = this.isEndless ? 40 : 220;
      if ((g.kind === 'LOCKED_MULT' || g.kind === 'BUFF_GATE') && !g.unlocked) {
        this.spawnFloatText(this.player.x, squadY - 28, '🔒 LOCKED GATE (NO EFFECT)', '#94a3b8');
      } else if (g.kind === 'LOCKED_MULT') {
        const added = this.isEndless
          ? Math.min(3, Math.max(1, g.val))
          : Math.min(40, Math.round(this.player.count * (g.val - 1)));
        this.player.count = Math.min(squadCap, this.player.count + added);
        this.highestSquadInLevel = Math.max(this.highestSquadInLevel, this.player.count);
        sfx.playGateCharge();
        CombatEngine.updateSquadFormation(this.player);
        this.spawnFloatText(this.player.x, squadY - 28, this.isEndless ? `+${added} SQUAD` : `x${g.val} SQUAD!`, '#34d399');
      } else if (g.kind === 'BUFF_GATE') {
        if (g.boostType) this.unlockTacticalBoost(g.boostType, g.x, g.y, g.color || '#fde047');
      } else if (g.kind === 'ALTAR') {
        const cost = Math.max(0, g.altarSacrificeCost ?? 0);
        if (cost > 0) {
          const actualDeduct = Math.min(this.player.count - 1, cost);
          this.player.count = Math.max(1, this.player.count - actualDeduct);
        }
        save.stats.altarsUsed++;
        this.altarUsedInLevel = true;
        if (g.altarWeaponReward === 'laserWeapon') {
          this.player.buffs.laserWeapon = true;
          this.spawnFloatText(this.player.x, squadY - 30, '⚡ LASER EVOLVED!', '#c084fc');
        } else {
          this.player.buffs.homingMissiles = true;
          this.spawnFloatText(this.player.x, squadY - 30, '🚀 HOMING MISSILES!', '#f43f5e');
        }
        sfx.playAltarSacrifice();
        CombatEngine.createShockwave(this.player.x, squadY, '#c084fc', this.shockwaves, 72);
        CombatEngine.updateSquadFormation(this.player);
      } else if (g.kind === 'CHARGE_ADD' || g.kind === 'HAZARD' || g.kind === 'QUANTUM') {
        const delta = g.val;
        if (delta > 0) {
          this.player.count = Math.min(squadCap, this.player.count + delta);
          this.highestSquadInLevel = Math.max(this.highestSquadInLevel, this.player.count);
          sfx.playGateCharge();
          this.spawnFloatText(this.player.x, squadY - 28, `+${delta} SQUAD`, '#38bdf8');
        } else if (delta < 0) {
          if (this.damageSquad(Math.abs(delta), `HAZARD ${delta}!`)) return;
        }
        CombatEngine.updateSquadFormation(this.player);
      }

      const removeIdx = this.gates.findIndex(item => item.id === g.id);
      if (removeIdx !== -1) this.gates.splice(removeIdx, 1);
    }

    // 6. Update Descending Crates (Unopened reward crates expire harmlessly without shrinking squad)
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.y += this.plan.scrollSpeed * 0.9 * dt;
      if (c.hitScale > 0) c.hitScale = Math.max(0, c.hitScale - dt * 6);

      const touchesCrate = isSplitMode
        ? (Math.abs(c.y - squadY) <= 20 && (
            Math.abs(c.x - (this.player.leftWingX ?? this.player.x)) <= c.w / 2 ||
            Math.abs(c.x - (this.player.rightWingX ?? this.player.x)) <= c.w / 2
          ))
        : (Math.abs(c.y - squadY) <= 20 && Math.abs(c.x - this.player.x) <= c.w / 2);

      if (touchesCrate) {
        this.crates.splice(i, 1);
        this.spawnFloatText(c.x, squadY - 26, '🔒 CRATE UNOPENED', '#94a3b8');
        continue;
      }
      if (c.y > this.ch + 50) this.crates.splice(i, 1);
    }

    // 7. Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.y += this.plan.scrollSpeed * dt;
      if (o.y > this.ch + 60) this.obstacles.splice(i, 1);
    }

    // 8. Update Enemies & Mortar Projectiles
    // Boss Arena Standoff Check: Detect Titan/Warden bosses and halt highway advance
    const activeBoss = this.enemies.find(e => e.active && e.isBoss && (e.type === 'TITAN' || e.type === 'WARDEN' || e.type === 'CAPTAIN'));
    if (activeBoss) {
      // Pre-Boss Barrier & Crate Clearance Check:
      // Ensure any buff gates and armory crates ahead of the player reach the squad line before locking standoff!
      const allPreGatesCleared = this.gates.length === 0 || this.gates.every(g => g.y >= squadY - 12);
      const allPreCratesCleared = this.crates.length === 0 || this.crates.every(c => c.y >= squadY - 12);

      if (!this.isBossArenaActive) {
        if (activeBoss.y >= this.ch * 0.18 && allPreGatesCleared && allPreCratesCleared) {
          this.isBossArenaActive = true;
          this.arenaBoss = activeBoss;
          this.plan.scrollSpeed = 0;
          sfx.playBossWarning();
          this.spawnFloatText(this.cw / 2, this.ch * 0.14, `🚨 STANDOFF LOCK: ${activeBoss.name || activeBoss.type}!`, '#ef4444', 16);
        } else if (activeBoss.y >= this.ch * 0.20) {
          // Boss arrived at standoff distance, but pre-boss gates are still scrolling down to the player:
          // Hold boss at standoff distance while highway continues scrolling gates directly to the squad!
          activeBoss.y = this.ch * 0.20;
        }
      }
    } else if (this.isBossArenaActive) {
      this.isBossArenaActive = false;
      this.arenaBoss = null;
      if (this.isEndless) {
        this.plan.scrollSpeed = Math.min(140, 75 + this.endlessThreatLevel * 2.2);
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.active) {
        this.enemies.splice(i, 1);
        this.enemiesKilled++;

        let bounty = 1;
        if (e.isBoss) {
          bounty = 25;
          this.bossDefeatedInLevel = e.type === 'TITAN' ? 'TITAN' : 'WARDEN';
          if (this.isBossArenaActive && this.arenaBoss?.id === e.id) {
            this.isBossArenaActive = false;
            this.arenaBoss = null;
            if (this.isEndless) {
              this.plan.scrollSpeed = Math.min(140, 75 + this.endlessThreatLevel * 2.2);
            }
          }
        } else if (e.type === 'BRUTE') bounty = 5;
        else if (e.type === 'SHIELD_BEARER' || e.type === 'HEALER_DRONE') bounty = 6;
        else if (e.type === 'SHOOTER') bounty = 4;
        else if (e.type === 'SPRINTER') bounty = 2;
        else if (e.type === 'MINE') bounty = 1;

        // Endless Threat Scaling Kill Bounty (Multiplies coins by threat level)
        if (this.isEndless) {
          const endlessThreatMult = Math.max(1, Math.floor(this.endlessThreatLevel * 0.75));
          bounty = bounty * endlessThreatMult;
        }

        this.sessionCoinsEarned += bounty;
        this.sessionScore += (bounty * 10) + (e.isBoss ? 1500 : 100);

        save.coins += bounty;
        save.stats.totalKills += 1;
        if (e.isBoss) save.stats.bossesDefeated += 1;
        save.stats.highScore = Math.max(save.stats.highScore || 0, this.sessionScore);

        this.spawnFloatText(e.x, e.y - 10, `+${bounty} 🪙`, '#fbbf24');
        this.notifyHUD();
        continue;
      }

      if (e.slowTimer > 0) e.slowTimer -= dt;
      const cryoMult = e.slowTimer > 0 ? 0.55 : 1.0;

      // BOSS ARENA STANDOFF COMBAT: Boss halts highway descent and duels squad laterally at standoff distance
      if (e.isBoss && this.isBossArenaActive && this.arenaBoss?.id === e.id) {
        e.y = this.ch * 0.20; // Anchored at standoff line
        const isEnraged = e.enraged || (e.hp < e.maxHp * 0.45);
        e.bossPhase += dt * (isEnraged ? 2.5 : 1.7);
        const strafeAmp = (this.cw - 110) * 0.42;
        e.x = (this.cw / 2) + Math.sin(e.bossPhase) * strafeAmp;
        e.x = Math.max(54, Math.min(this.cw - 54, e.x));

        // Aimed Mortar Volleys during Standoff
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0) {
          e.shootCooldown = isEnraged ? 1.25 : (e.type === 'TITAN' ? 1.6 : 1.9);
          const targetX = this.player.x;
          const dx = targetX - e.x;
          const dy = squadY - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          const spd = this.isEndless ? 250 : 220;
          this.enemyMortars.push({
            x: e.x,
            y: e.y + e.r,
            targetX,
            vx: (dx / dist) * spd * 0.72,
            vy: spd,
            squadLoss: isEnraged ? (e.type === 'TITAN' ? 5 : 3) : (e.type === 'TITAN' ? 4 : 2),
          });
          if (isEnraged && e.type === 'TITAN') {
            const spreadOffset = Math.random() < 0.5 ? -35 : 35;
            this.enemyMortars.push({
              x: e.x + spreadOffset,
              y: e.y + e.r,
              targetX: targetX + spreadOffset * 1.5,
              vx: ((dx + spreadOffset) / dist) * spd * 0.70,
              vy: spd * 0.95,
              squadLoss: 3,
            });
          }
        }
        continue; // Bypasses standard downward speed advance and perimeter breach check
      }

      // Boss & Unit Tactical Lateral Movement (Strictly clamped within playable highway road)
      if (e.isBoss) {
        e.bossPhase += dt * 1.6;
        e.x += Math.sin(e.bossPhase) * 38 * dt;
        e.x = Math.max(54, Math.min(this.cw - 54, e.x));
      } else if (e.type === 'RUNNER') {
        // Infantry recon units actively weave laterally while marching
        e.x += Math.sin(this.elapsed * 3.2 + (e.id % 13)) * 18 * dt;
        e.x = Math.max(50, Math.min(this.cw - 50, e.x));
      } else if (e.type === 'SPRINTER') {
        // Sprinters angle slightly toward the player's squad as they rush
        const dirToPlayer = Math.sign(this.player.x - e.x);
        e.x += dirToPlayer * 14 * dt;
        e.x = Math.max(50, Math.min(this.cw - 50, e.x));
      } else if (e.type === 'HEALER_DRONE') {
        e.x += Math.cos(this.elapsed * 2.4 + (e.id % 7)) * 22 * dt;
        e.x = Math.max(50, Math.min(this.cw - 50, e.x));
      } else {
        e.x = Math.max(50, Math.min(this.cw - 50, e.x));
      }

      // Artillery mortar shooting
      if (e.type === 'SHOOTER' || e.isBoss) {
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0 && e.y > 40 && e.y < squadY - 120) {
          e.shootCooldown = this.isEndless
            ? (e.type === 'TITAN' ? 1.4 : e.type === 'SHOOTER' ? 1.7 : 1.9)
            : (e.type === 'TITAN' ? 1.75 : e.type === 'SHOOTER' ? 2.5 : 2.1);
          const targetX = this.player.x;
          const dx = targetX - e.x;
          const dy = squadY - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          const spd = this.isEndless ? 250 : 215;
          this.enemyMortars.push({
            x: e.x,
            y: e.y + e.r,
            targetX,
            vx: (dx / dist) * spd * 0.68,
            vy: spd,
            squadLoss: this.isEndless ? (e.type === 'TITAN' ? 6 : 3) : (e.type === 'TITAN' ? 4 : 2),
          });
        }
      }

      // Brisk entry onto screen, then active tactical advance
      const entryBoost = e.y < 35 ? 1.35 : 1.0;
      e.y += e.speed * cryoMult * entryBoost * dt;
      CombatEngine.keepEnemiesBehindBarriers([e], this.gates, this.crates, squadY);

      // Defensive Perimeter Breach Check
      if (e.y + e.r >= squadY - 4) {
        if (e.isBoss) {
          if (this.isEndless) {
            const bossCost = Math.max(16, Math.ceil(this.player.count * 0.5));
            if (this.damageSquad(bossCost, `🚨 ${e.name || 'BOSS'} CLASH -${bossCost} 👥!`)) {
              this.triggerDefeat(`${e.name || e.type} breached your highway defense line!`);
              return;
            }
            // Repel / neutralize boss after heroic squad clash
            CombatEngine.createShockwave(this.player.x, squadY, '#f43f5e', this.shockwaves, 96);
            this.enemies.splice(i, 1);
            this.enemiesKilled++;
            continue;
          } else {
            this.triggerDefeat(`${e.name || e.type} breached your defensive perimeter!`);
            return;
          }
        }

        if (e.type === 'MINE') {
          if (Math.abs(e.x - this.player.x) < 78) {
            const blastLoss = Math.max(3, Math.ceil(this.player.count * 0.35));
            if (this.damageSquad(blastLoss, `💣 MINE BLAST -${blastLoss}!`)) return;
          }
          this.enemies.splice(i, 1);
          this.enemiesKilled++;
          continue;
        }

        const soldierCost = this.isEndless
          ? Math.max(3, Math.ceil(e.hp / (10 + save.upgrades.firepower * 1.5)))
          : Math.max(2, Math.ceil(e.hp / (14 + save.upgrades.firepower * 3)));
        if (this.player.count > soldierCost) {
          if (this.damageSquad(soldierCost, `BREACH CLASH -${soldierCost} 👥!`)) return;
          this.enemies.splice(i, 1);
          this.enemiesKilled++;
        } else {
          this.triggerDefeat('Perimeter overrun!');
          return;
        }
      }
    }

    // 9. Update Enemy Mortar Shells
    const hitRadius = Math.min(44, 14 + Math.sqrt(this.player.count) * 3.2);
    for (let i = this.enemyMortars.length - 1; i >= 0; i--) {
      const em = this.enemyMortars[i];
      em.x += em.vx * dt;
      em.y += em.vy * dt;

      if (Math.abs(em.y - squadY) < 16 && Math.abs(em.x - this.player.x) < hitRadius) {
        this.enemyMortars.splice(i, 1);
        CombatEngine.createShockwave(this.player.x, squadY, '#ef4444', this.shockwaves, 64);
        if (this.damageSquad(em.squadLoss, '🎯 HIT BY MORTAR!')) return;
        continue;
      }
      if (em.y > this.ch + 20) this.enemyMortars.splice(i, 1);
    }

    // 10. Win Condition (Campaign Mode only)
    if (!this.isEndless) {
      const remainingEnemies = this.plan.totalEnemies - this.enemiesKilled;
      if (remainingEnemies <= 0 && this.enemySchedule.length === 0 && this.enemies.length === 0) {
        this.mode = 'VICTORY';
        sfx.pauseBGM();
        sfx.playWin();

        const survivalBonus = Math.max(0, this.player.count * 2);
        const baseReward = this.plan.coinReward;

        // Tactical Accolade Benchmarks
        const accolades: MissionAccolade[] = [];
        if (this.soldiersLostInLevel === 0) {
          accolades.push({
            id: 'unbroken_formation',
            name: 'Unbroken Formation',
            icon: '🛡️',
            desc: 'Completed mission with 0 soldiers lost',
            coins: 50,
          });
        }
        if (this.highestSquadInLevel >= 60) {
          accolades.push({
            id: 'massive_mobilization',
            name: 'Massive Mobilization',
            icon: '👑',
            desc: 'Reached 60+ squad troops in mission',
            coins: 100,
          });
        } else if (this.highestSquadInLevel >= 30) {
          accolades.push({
            id: 'dominant_force',
            name: 'Dominant Force',
            icon: '⚡',
            desc: 'Reached 30+ squad troops in mission',
            coins: 40,
          });
        }
        if (this.ricochetKillsInLevel >= 3) {
          accolades.push({
            id: 'trickshot_master',
            name: 'Trickshot Master',
            icon: '🎯',
            desc: '3+ kills deflected off Prism / Splitter mirrors',
            coins: 45,
          });
        }
        if (this.altarUsedInLevel) {
          accolades.push({
            id: 'altar_blessing',
            name: "Altar's Blessing",
            icon: '🔮',
            desc: 'Purified and ascended weapon at Sacrifice Altar',
            coins: 50,
          });
        }
        if (this.bossDefeatedInLevel === 'TITAN') {
          accolades.push({
            id: 'titan_slayer',
            name: 'Titan Slayer',
            icon: '☠️',
            desc: 'Defeated Titan Dreadnought in Standoff Arena',
            coins: 150,
          });
        } else if (this.bossDefeatedInLevel === 'WARDEN' || this.bossDefeatedInLevel === 'CAPTAIN') {
          accolades.push({
            id: 'warden_slayer',
            name: 'Warden Slayer',
            icon: '⚔️',
            desc: 'Defeated Warden Gatekeeper in Standoff Arena',
            coins: 75,
          });
        }

        const accoladeBonus = accolades.reduce((sum, a) => sum + a.coins, 0);
        const totalReward = baseReward + survivalBonus + accoladeBonus;
        this.sessionCoinsEarned += totalReward;
        this.sessionScore += 2500 + (this.player.count * 25) + (accoladeBonus * 10);

        storage.recordWin(this.currentLevel, totalReward);
        const save = storage.getSave();
        save.stats.highScore = Math.max(save.stats.highScore || 0, this.sessionScore);
        storage.saveLocal();

        if (this.onGameOver) {
          this.onGameOver(
            true, 
            totalReward, 
            `Sector Secured! Base: +${baseReward} 🪙 | Squad Survival (${this.player.count} 👥): +${survivalBonus} 🪙`, 
            { accolades }
          );
        }
      }
    }

    // 11. Particles, Shockwaves, Enemies HitFlash & Floating Texts
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1.0, dt * 10);
      sw.alpha -= dt * sw.decay;
      if (sw.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      ft.alpha = Math.max(0, ft.life / 0.9);
      if (ft.life <= 0) this.floatTexts.splice(i, 1);
    }

    this.notifyHUD();
  }

  public render(): void {
    GameRenderer.render(
      this.ctx,
      this.cw,
      this.ch,
      this.plan.biome,
      this.elapsed,
      this.trauma,
      this.player,
      this.gates,
      this.crates,
      this.obstacles,
      this.enemies,
      this.enemyMortars,
      this.bullets,
      this.particles,
      this.shockwaves,
      this.floatTexts,
      this.dualThumbBannerTimer,
      this.isBossArenaActive,
      this.arenaBoss
    );
  }

  public start(): void {
    this.lastTS = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.04, (now - this.lastTS) / 1000);
      this.lastTS = now;
      this.update(dt);
      this.render();
      this.animFrameId = requestAnimationFrame(frame);
    };
    this.animFrameId = requestAnimationFrame(frame);
  }

  public stop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
