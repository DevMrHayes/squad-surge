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
  SaveData 
} from '../types/game';
import { WaveGenerator } from './waveGenerator';
import { CombatEngine } from './combat';
import { GameRenderer } from './renderer';
import { storage } from '../services/storage';
import { sfx } from '../services/audio';

export type GameMode = 'READY' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';

export class GameLoop {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public cw: number = 380;
  public ch: number = 640;

  public mode: GameMode = 'READY';
  public currentLevel: number = 1;
  public plan: LevelPlan;
  public elapsed: number = 0;
  public trauma: number = 0;

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

  private lastTS: number = 0;
  private animFrameId: number | null = null;

  private onHUDUpdate?: (level: number, left: number, total: number, coins: number) => void;
  private onGameOver?: (won: boolean, coinsEarned: number, reason?: string) => void;

  constructor(
    canvas: HTMLCanvasElement, 
    callbacks: {
      onHUDUpdate: (level: number, left: number, total: number, coins: number) => void;
      onGameOver: (won: boolean, coinsEarned: number, reason?: string) => void;
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
      },
      dragSpeedMultiplier: 1.0,
      fireRateMultiplier: 1.0,
    };
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || { width: 380, height: 640 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = rect.width;
    this.ch = rect.height;

    this.canvas.width = Math.floor(this.cw * dpr);
    this.canvas.height = Math.floor(this.ch * dpr);
    this.ctx.scale(dpr, dpr);

    if (this.player) {
      this.player.y = this.ch * 0.78;
    }
  }

  public initLevel(lvl: number): void {
    this.currentLevel = Math.max(1, Math.min(100, lvl));
    this.plan = WaveGenerator.generate(this.currentLevel, this.cw);
    this.elapsed = 0;
    this.trauma = 0;
    this.enemiesKilled = 0;
    this.sessionCoinsEarned = 0;
    this.sessionScore = 0;

    this.player = this.createDefaultPlayer();
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
      sfx.pauseBGM();
    }
  }

  public resume(): void {
    if (this.mode === 'PAUSED') {
      this.mode = 'PLAYING';
      sfx.resumeBGM();
    }
  }

  private setupTouchControls(): void {
    const handleMove = (clientX: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const rawX = clientX - rect.left;
      this.targetX = Math.max(32, Math.min(this.cw - 32, rawX));
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      handleMove(e.clientX);
      if (this.mode === 'READY') this.startCombat();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      handleMove(e.clientX);
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
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
      val: gDef.val || 0,
      maxVal: gDef.maxVal || 10,
      hitsPerStep: gDef.hitsPerStep || 10,
      chargeHits: 0,
      lockHitsRemaining: gDef.lockHitsRemaining || 0,
      lockHitsMax: gDef.lockHitsMax || 10,
      unlocked: gDef.kind === 'CHARGE_ADD' || gDef.kind === 'HAZARD',
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
      w: Math.min(104, laneW - 8),
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
    const laneX = oDef.lane === 'LEFT' ? 24 : this.cw - 24;
    this.obstacles.push({
      id: Math.random(),
      type: oDef.type,
      x: oDef.type === 'PRISM_MIRROR' ? laneX : this.cw / 2,
      y: -50,
      width: oDef.type === 'PRISM_MIRROR' ? 32 : 110,
      height: oDef.type === 'PRISM_MIRROR' ? 80 : 120,
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
    if (boostType === 'AP') {
      this.player.buffs.apTimer = 7.5;
      this.spawnFloatText(x, y - 24, '⚡ AP ROUNDS (2.5x vs 🛡️)!', color);
    } else if (boostType === 'CRYO') {
      this.player.buffs.cryoTimer = 8.0;
      this.spawnFloatText(x, y - 24, '❄️ CRYO SLOW ACTIVE!', color);
    } else if (boostType === 'BLAST') {
      this.player.buffs.blastTimer = 7.5;
      this.spawnFloatText(x, y - 24, '💥 BLAST SPLASH AoE!', color);
    } else if (boostType === 'FIRERATE') {
      this.player.buffs.rapidTimer = 8.0;
      this.spawnFloatText(x, y - 24, '🔥 FIRE RATE +35%!', color);
    } else if (boostType === 'SHIELD') {
      this.player.shields += 2;
      this.spawnFloatText(x, y - 24, '🛡️ +2 SQUAD SHIELDS!', color);
    } else if (boostType === 'SNIPER') {
      this.player.specialists.sniper += 2;
      this.spawnFloatText(x, y - 24, '💎 +2 SNIPER SPECS!', '#06b6d4');
      CombatEngine.updateSquadFormation(this.player);
    } else if (boostType === 'VANGUARD') {
      this.player.specialists.vanguard += 2;
      this.spawnFloatText(x, y - 24, '⚡ +2 VANGUARD SPECS!', '#f97316');
      CombatEngine.updateSquadFormation(this.player);
    } else if (boostType === 'MORTAR') {
      this.player.specialists.mortar += 1;
      this.spawnFloatText(x, y - 24, '🟡 +1 EMP MORTAR SPEC!', '#eab308');
      CombatEngine.updateSquadFormation(this.player);
    }
  }

  public spawnFloatText(x: number, y: number, text: string, color: string): void {
    this.floatTexts.push({
      id: Math.random(),
      text,
      x,
      y,
      vy: -35,
      color,
      fontSize: 14,
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
    this.player.count = Math.max(0, this.player.count - lossCount);
    sfx.playLose();
    this.trauma = Math.min(1.0, this.trauma + 0.30);
    CombatEngine.createExplosionParticles(this.player.x, squadY, '#f43f5e', this.particles, 14);
    CombatEngine.createShockwave(this.player.x, squadY, '#f43f5e', this.shockwaves, 52);
    this.spawnFloatText(this.player.x, squadY - 28, label, '#f87171');
    CombatEngine.updateSquadFormation(this.player);

    if (this.player.count <= 0) {
      this.mode = 'DEFEAT';
      sfx.pauseBGM();
      const consolation = Math.round(this.plan.coinReward * 0.25);
      storage.recordLoss(consolation);
      if (this.onGameOver) this.onGameOver(false, consolation, 'All soldiers in your squad were eliminated!');
      return true;
    }
    return false;
  }

  private notifyHUD(): void {
    if (this.onHUDUpdate) {
      const save = storage.getSave();
      const remaining = Math.max(0, this.plan.totalEnemies - this.enemiesKilled);
      this.onHUDUpdate(this.currentLevel, remaining, this.plan.totalEnemies, save.coins);
    }
  }

  public update(dt: number): void {
    if (this.mode !== 'PLAYING') return;

    this.elapsed += dt;

    // Camera trauma decay
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
    }

    // Active buffs timer decay
    if (this.player.buffs.apTimer > 0) this.player.buffs.apTimer -= dt;
    if (this.player.buffs.cryoTimer > 0) this.player.buffs.cryoTimer -= dt;
    if (this.player.buffs.rapidTimer > 0) this.player.buffs.rapidTimer -= dt;
    if (this.player.buffs.blastTimer > 0) this.player.buffs.blastTimer -= dt;

    const squadY = this.ch * 0.78;
    this.player.y = squadY;

    // 1. Smooth squad movement toward targetX
    const dragSpeed = 20 * this.player.dragSpeedMultiplier;
    this.player.x += (this.targetX - this.player.x) * Math.min(1.0, dragSpeed * dt);
    this.player.x = Math.max(34, Math.min(this.cw - 34, this.player.x));

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
    }, this.shockwaves);

    CombatEngine.handleObstacleInteractions(this.player, this.obstacles, this.bullets, dt);

    CombatEngine.handleGateAndCrateHits(
      this.gates, 
      this.crates, 
      this.bullets, 
      this.particles, 
      this.floatTexts,
      (type, x, y, col) => this.unlockTacticalBoost(type, x, y, col),
      this.shockwaves
    );

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

    // 5. Update Descending Gates
    const collectHalfW = Math.min(48, 16 + Math.sqrt(this.player.count) * 3.5);
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.y += this.plan.scrollSpeed * dt;
      if (g.hitScale > 0) g.hitScale = Math.max(0, g.hitScale - dt * 6);

      // Sliding gate horizontal oscillation
      if (g.sliding) {
        g.x += (g.slideSpeed || 48) * (g.slideDir || 1) * dt;
        const minX = 28 + g.w / 2;
        const maxX = this.cw - 28 - g.w / 2;
        if (g.x <= minX) { g.x = minX; g.slideDir = 1; }
        if (g.x >= maxX) { g.x = maxX; g.slideDir = -1; }
      }

      // Quantum polarity flipping (Sector 5)
      if (g.flipPolarity && g.val < g.maxVal) {
        g.polarityTimer = (g.polarityTimer ?? 3.0) - dt;
        if (g.polarityTimer <= 0) {
          g.polarityTimer = 3.0;
          g.val = -g.val || -3;
        }
      }

      // Traversal through gate
      if (Math.abs(g.y - squadY) <= 22 && Math.abs(g.x - this.player.x) <= g.w / 2 + collectHalfW * 0.4) {
        // MUTUAL EXCLUSION: If gate is paired, shatter the sibling gate in this dilemma row
        if (g.pairId) {
          for (let s = this.gates.length - 1; s >= 0; s--) {
            const sib = this.gates[s];
            if (sib.id !== g.id && sib.pairId === g.pairId) {
              CombatEngine.createExplosionParticles(sib.x, sib.y, '#94a3b8', this.particles, 10, true);
              this.spawnFloatText(sib.x, squadY - 24, '🚫 LOCKED OUT', '#94a3b8');
              this.gates.splice(s, 1);
              if (s < i) i--;
            }
          }
        }
        if ((g.kind === 'LOCKED_MULT' || g.kind === 'BUFF_GATE') && !g.unlocked) {
          this.spawnFloatText(this.player.x, squadY - 28, '🔒 LOCKED GATE (NO EFFECT)', '#94a3b8');
        } else if (g.kind === 'LOCKED_MULT') {
          const added = Math.min(40, Math.round(this.player.count * (g.val - 1)));
          this.player.count = Math.min(220, this.player.count + added);
          sfx.playGateCharge();
          CombatEngine.updateSquadFormation(this.player);
          this.spawnFloatText(this.player.x, squadY - 28, `x${g.val} SQUAD!`, '#34d399');
        } else if (g.kind === 'BUFF_GATE') {
          if (g.boostType) this.unlockTacticalBoost(g.boostType, g.x, g.y, g.color || '#fde047');
        } else if (g.kind === 'ALTAR') {
          const cost = g.altarSacrificeCost || 15;
          const actualDeduct = Math.min(this.player.count - 1, cost);
          this.player.count = Math.max(1, this.player.count - actualDeduct);
          save.stats.altarsUsed++;
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
            this.player.count = Math.min(220, this.player.count + delta);
            sfx.playGateCharge();
            this.spawnFloatText(this.player.x, squadY - 28, `+${delta} SQUAD`, '#38bdf8');
          } else if (delta < 0) {
            if (this.damageSquad(Math.abs(delta), `HAZARD ${delta}!`)) return;
          }
          CombatEngine.updateSquadFormation(this.player);
        }

        this.gates.splice(i, 1);
        continue;
      }

      if (g.y > this.ch + 45) this.gates.splice(i, 1);
    }

    // 6. Update Descending Crates
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.y += this.plan.scrollSpeed * 0.9 * dt;
      if (c.hitScale > 0) c.hitScale = Math.max(0, c.hitScale - dt * 6);

      if (Math.abs(c.y - squadY) <= 20 && Math.abs(c.x - this.player.x) <= c.w / 2 + 12) {
        this.crates.splice(i, 1);
        if (this.damageSquad(2, 'CRATE COLLISION -2!')) return;
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
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.active) {
        this.enemies.splice(i, 1);
        this.enemiesKilled++;

        let bounty = 1;
        if (e.isBoss) bounty = 25;
        else if (e.type === 'BRUTE') bounty = 5;
        else if (e.type === 'SHIELD_BEARER' || e.type === 'HEALER_DRONE') bounty = 6;
        else if (e.type === 'SHOOTER') bounty = 4;
        else if (e.type === 'SPRINTER') bounty = 2;
        else if (e.type === 'MINE') bounty = 1;

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

      // Boss & Unit Tactical Lateral Movement (Never static)
      if (e.isBoss) {
        e.bossPhase += dt * 1.6;
        e.x += Math.sin(e.bossPhase) * 38 * dt;
        e.x = Math.max(48, Math.min(this.cw - 48, e.x));
      } else if (e.type === 'RUNNER') {
        // Infantry recon units actively weave laterally while marching
        e.x += Math.sin(this.elapsed * 3.2 + (e.id % 13)) * 18 * dt;
        e.x = Math.max(30, Math.min(this.cw - 30, e.x));
      } else if (e.type === 'SPRINTER') {
        // Sprinters angle slightly toward the player's squad as they rush
        const dirToPlayer = Math.sign(this.player.x - e.x);
        e.x += dirToPlayer * 14 * dt;
        e.x = Math.max(28, Math.min(this.cw - 28, e.x));
      } else if (e.type === 'HEALER_DRONE') {
        e.x += Math.cos(this.elapsed * 2.4 + (e.id % 7)) * 22 * dt;
        e.x = Math.max(36, Math.min(this.cw - 36, e.x));
      }

      // Artillery mortar shooting
      if (e.type === 'SHOOTER' || e.isBoss) {
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0 && e.y > 40 && e.y < squadY - 120) {
          e.shootCooldown = e.type === 'TITAN' ? 1.75 : e.type === 'SHOOTER' ? 2.5 : 2.1;
          const targetX = this.player.x;
          const dx = targetX - e.x;
          const dy = squadY - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          const spd = 215;
          this.enemyMortars.push({
            x: e.x,
            y: e.y + e.r,
            targetX,
            vx: (dx / dist) * spd * 0.68,
            vy: spd,
            squadLoss: e.type === 'TITAN' ? 4 : 2,
          });
        }
      }

      // Brisk entry onto screen, then active tactical advance
      const entryBoost = e.y < 35 ? 1.35 : 1.0;
      e.y += e.speed * cryoMult * entryBoost * dt;

      // Defensive Perimeter Breach Check
      if (e.y + e.r >= squadY - 4) {
        if (e.isBoss) {
          this.mode = 'DEFEAT';
          sfx.pauseBGM();
          sfx.playLose();
          const consolation = Math.round(this.plan.coinReward * 0.25);
          storage.recordLoss(consolation);
          if (this.onGameOver) this.onGameOver(false, consolation, `${e.name || e.type} breached your defensive perimeter!`);
          return;
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

        const soldierCost = Math.max(2, Math.ceil(e.hp / (14 + save.upgrades.firepower * 3)));
        if (this.player.count > soldierCost) {
          if (this.damageSquad(soldierCost, `BREACH CLASH -${soldierCost} 👥!`)) return;
          this.enemies.splice(i, 1);
          this.enemiesKilled++;
        } else {
          this.mode = 'DEFEAT';
          sfx.pauseBGM();
          sfx.playLose();
          const consolation = Math.round(this.plan.coinReward * 0.25);
          storage.recordLoss(consolation);
          if (this.onGameOver) this.onGameOver(false, consolation, 'Perimeter overrun!');
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

    // 10. Win Condition
    const remainingEnemies = this.plan.totalEnemies - this.enemiesKilled;
    if (remainingEnemies <= 0 && this.enemySchedule.length === 0 && this.enemies.length === 0) {
      this.mode = 'VICTORY';
      sfx.pauseBGM();
      sfx.playWin();

      const survivalBonus = Math.max(0, this.player.count * 2);
      const totalReward = this.plan.coinReward + survivalBonus;
      this.sessionCoinsEarned += totalReward;
      this.sessionScore += 2500 + (this.player.count * 25);

      storage.recordWin(this.currentLevel, totalReward);
      const save = storage.getSave();
      save.stats.highScore = Math.max(save.stats.highScore || 0, this.sessionScore);
      storage.saveLocal();

      if (this.onGameOver) {
        this.onGameOver(true, totalReward, `Sector Secured! Base: +${this.plan.coinReward} 🪙 | Squad Survival (${this.player.count} 👥): +${survivalBonus} 🪙`);
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
      this.floatTexts
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
