// Squad Surge: Core 60FPS Game Loop & State Manager
import { 
  PlayerState, 
  LevelPlan, 
  Gate, 
  FieldObstacle, 
  Enemy, 
  Bullet, 
  Particle, 
  FloatingText,
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
  private cw: number = 380;
  private ch: number = 740;

  public mode: GameMode = 'READY';
  public currentLevel: number = 1;
  public plan: LevelPlan;

  public player: PlayerState;
  public gates: Gate[] = [];
  public obstacles: FieldObstacle[] = [];
  public enemies: Enemy[] = [];
  public bullets: Bullet[] = [];
  public particles: Particle[] = [];
  public floatTexts: FloatingText[] = [];

  public enemiesLeft: number = 0;
  public totalEnemiesInLevel: number = 0;
  public scrollOffset: number = 0;
  public scrollSpeed: number = 52;
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
    const startCount = 1 + (save.upgrades.startSquad - 1) * 2;
    return {
      x: this.cw / 2,
      y: this.ch - 108,
      count: startCount,
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
        shieldHp: 0,
        laserWeapon: false,
        homingMissiles: false,
      },
      dragSpeedMultiplier: 1.0,
      fireRateMultiplier: 1.0,
    };
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || { width: 380, height: 740 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = rect.width;
    this.ch = rect.height;

    this.canvas.width = Math.floor(this.cw * dpr);
    this.canvas.height = Math.floor(this.ch * dpr);
    this.ctx.scale(dpr, dpr);

    if (this.player) {
      this.player.y = this.ch - 108;
    }
  }

  public initLevel(lvl: number): void {
    this.currentLevel = Math.max(1, Math.min(100, lvl));
    this.plan = WaveGenerator.generate(this.currentLevel, this.cw);
    this.scrollSpeed = 50 + Math.min(30, this.currentLevel * 0.28);
    this.scrollOffset = 0;

    this.player = this.createDefaultPlayer();
    this.targetX = this.cw / 2;
    this.player.x = this.cw / 2;

    this.gates = [];
    this.obstacles = [];
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.floatTexts = [];

    // Instantiate all wave gates, obstacles, and enemies
    this.plan.waves.forEach(w => {
      if (w.gates) {
        w.gates.forEach(g => this.gates.push({ ...g } as Gate));
      }
      if (w.obstacles) {
        w.obstacles.forEach(o => this.obstacles.push({ ...o } as FieldObstacle));
      }
      if (w.enemies) {
        w.enemies.forEach(eg => {
          for (let i = 0; i < eg.count; i++) {
            const laneX = eg.lane === 'LEFT' ? this.cw * 0.25 : eg.lane === 'RIGHT' ? this.cw * 0.75 : this.cw * 0.5;
            const ey = w.spawnYOffset - i * (eg.spacingY || 45);
            this.enemies.push(WaveGenerator.spawnEnemyInstance(eg.type, laneX, ey, this.currentLevel, this.cw));
          }
        });
      }
    });

    this.totalEnemiesInLevel = this.enemies.length;
    this.enemiesLeft = this.enemies.length;
    CombatEngine.updateSquadFormation(this.player);

    this.mode = 'READY';
    this.notifyHUD();
  }

  public startCombat(): void {
    if (this.mode === 'READY') {
      this.mode = 'PLAYING';
    }
  }

  public pause(): void {
    if (this.mode === 'PLAYING') {
      this.mode = 'PAUSED';
    }
  }

  public resume(): void {
    if (this.mode === 'PAUSED') {
      this.mode = 'PLAYING';
    }
  }

  private setupTouchControls(): void {
    const handleMove = (clientX: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const rawX = clientX - rect.left;
      this.targetX = Math.max(30, Math.min(this.cw - 30, rawX));
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

  private notifyHUD(): void {
    if (this.onHUDUpdate) {
      const save = storage.getSave();
      this.onHUDUpdate(this.currentLevel, this.enemiesLeft, this.totalEnemiesInLevel, save.coins);
    }
  }

  public update(dt: number): void {
    if (this.mode !== 'PLAYING') return;

    // 1. Smooth squad lateral sliding
    const dragSpeed = 16 * this.player.dragSpeedMultiplier;
    this.player.x += (this.targetX - this.player.x) * Math.min(1.0, dragSpeed * dt);

    // 2. Highway road scrolling & element advancement
    this.scrollOffset += this.scrollSpeed * dt;

    this.gates.forEach(g => {
      g.y += this.scrollSpeed * dt;
      // Sliding gate behavior (Sector 2+)
      if (g.sliding) {
        g.x += (g.slideSpeed || 40) * (g.slideDir || 1) * dt;
        if (g.x < 70) {
          g.x = 70;
          g.slideDir = 1;
        } else if (g.x > this.cw - 70) {
          g.x = this.cw - 70;
          g.slideDir = -1;
        }
      }
      // Flip-Polarity Gates (Sector 5)
      if (g.flipPolarity) {
        g.polarityTimer = (g.polarityTimer || 3.0) - dt;
        if (g.polarityTimer <= 0) {
          g.polarityTimer = 3.0;
          g.val = -g.val;
          sfx.playGateCharge();
        }
      }
    });

    this.obstacles.forEach(o => {
      o.y += this.scrollSpeed * dt;
    });

    this.enemies.forEach(e => {
      if (!e.active) return;
      const effectiveSpeed = e.isSlowed ? e.speed * 0.45 : e.speed;
      e.y += (this.scrollSpeed * 0.4 + effectiveSpeed) * dt;

      if (e.isSlowed) {
        e.slowTimer = (e.slowTimer || 2.0) - dt;
        if (e.slowTimer <= 0) e.isSlowed = false;
      }
    });

    // 3. Firing & Combat Engine Execution
    const save = storage.getSave();
    CombatEngine.firePlayerVolleys(this.player, dt, this.bullets, save.upgrades.firepower, this.enemies);
    CombatEngine.updateBullets(this.bullets, dt, this.enemies, this.particles);
    CombatEngine.handleObstacleInteractions(this.player, this.obstacles, this.bullets, dt);
    
    CombatEngine.handleGateInteractions(
      this.player, 
      this.gates, 
      this.bullets, 
      this.floatTexts, 
      this.particles, 
      save.stats
    );

    CombatEngine.handleEnemyInteractions(
      this.player, 
      this.enemies, 
      this.bullets, 
      this.particles, 
      this.floatTexts, 
      dt, 
      save.stats
    );

    // 4. Update Particles & Floating Text
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 1.4;
      if (ft.alpha <= 0) this.floatTexts.splice(i, 1);
    }

    // 5. Update Remaining Enemies
    const activeRemaining = this.enemies.filter(e => e.active).length;
    this.enemiesLeft = activeRemaining;
    this.notifyHUD();

    // 6. Win / Defeat Conditions
    if (this.player.count <= 0) {
      this.mode = 'DEFEAT';
      sfx.playLose();
      const consolation = Math.round(this.plan.coinReward * 0.25);
      storage.recordLoss(consolation);
      if (this.onGameOver) this.onGameOver(false, consolation, 'Squad wiped out! Dodge artillery and link units.');
    } else if (activeRemaining === 0) {
      this.mode = 'VICTORY';
      sfx.playWin();
      storage.recordWin(this.currentLevel, this.plan.coinReward);
      if (this.onGameOver) this.onGameOver(true, this.plan.coinReward);
    }
  }

  public render(): void {
    GameRenderer.render(
      this.ctx,
      this.cw,
      this.ch,
      this.plan.biome,
      this.scrollOffset,
      this.player,
      this.gates,
      this.obstacles,
      this.enemies,
      this.bullets,
      this.particles,
      this.floatTexts
    );
  }

  public start(): void {
    this.lastTS = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastTS) / 1000);
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
