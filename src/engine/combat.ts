// Squad Surge: Combat, Ballistics, Synergy & Collision Physics Engine
import { 
  PlayerState, 
  SquadMember, 
  SpecialistType, 
  Bullet, 
  Gate, 
  Crate,
  FieldObstacle, 
  Enemy, 
  EnemyMortarShell,
  Particle, 
  Shockwave,
  FloatingText,
  BossArmorPlate 
} from '../types/game';
import { sfx } from '../services/audio';

export class CombatEngine {
  public static updateSquadFormation(player: PlayerState): void {
    const total = Math.max(1, player.count);
    const members: SquadMember[] = [];

    const cols = Math.min(10, Math.ceil(Math.sqrt(total * 1.5)));
    const spacingX = 9;
    const spacingY = 10;

    const snipers = player.specialists.sniper || 0;
    const vanguards = player.specialists.vanguard || 0;
    const mortars = player.specialists.mortar || 0;

    let assignedSnipers = 0;
    let assignedVanguards = 0;
    let assignedMortars = 0;

    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rowCols = Math.min(cols, total - row * cols);
      const startX = -((rowCols - 1) * spacingX) / 2;

      let type: SpecialistType = 'STANDARD';
      let color = '#38bdf8'; // Standard Sky Blue

      if (assignedSnipers < snipers && (i % 3 === 0)) {
        type = 'SNIPER';
        color = '#06b6d4'; // Cyan
        assignedSnipers++;
      } else if (assignedVanguards < vanguards && (i % 2 === 0)) {
        type = 'VANGUARD';
        color = '#f97316'; // Orange
        assignedVanguards++;
      } else if (assignedMortars < mortars) {
        type = 'MORTAR';
        color = '#eab308'; // Yellow
        assignedMortars++;
      }

      members.push({
        id: i,
        relX: startX + col * spacingX,
        relY: row * spacingY,
        type,
        color,
      });
    }

    player.members = members;
  }

  public static firePlayerVolleys(
    player: PlayerState, 
    dt: number, 
    bullets: Bullet[], 
    firepowerLvl: number,
    fireRateLvl: number,
    armorPierceLvl: number,
    enemies: Enemy[]
  ): void {
    const permFireRate = 1 + (fireRateLvl - 1) * 0.10;
    const tempFireRate = player.buffs.rapidTimer > 0 ? 1.35 : 1.0;
    const interval = 0.20 / (permFireRate * tempFireRate * player.fireRateMultiplier);

    player.fireTimer += dt;
    player.sniperTimer -= dt;
    player.vanguardTimer -= dt;
    player.mortarTimer -= dt;

    if (player.fireTimer >= interval) {
      player.fireTimer = 0;

      // Sub-linear squad power formula
      const streamCount = Math.min(10, Math.max(1, Math.ceil(Math.sqrt(player.count * 1.1))));
      const upgPower = 1 + (firepowerLvl - 1) * 0.18;
      const effectiveSquadPower = Math.pow(player.count, 0.78) * 3.1 * upgPower;
      const dmgPerBullet = Math.max(1.5, effectiveSquadPower / streamCount);
      const gateChargePerBullet = 1.35 / streamCount;

      const spread = 8.5;
      const startX = -((streamCount - 1) * spread) / 2;

      for (let b = 0; b < streamCount; b++) {
        const bx = player.x + startX + b * spread;
        bullets.push({
          id: Math.random(),
          x: bx,
          y: player.y - 12,
          vx: 0,
          vy: -680,
          damage: dmgPerBullet,
          gateCharge: gateChargePerBullet,
          radius: 3.5,
          color: player.buffs.cryoTimer > 0 ? '#67e8f9' : player.buffs.apTimer > 0 ? '#fde047' : '#38bdf8',
          isCryo: player.buffs.cryoTimer > 0,
          isBlast: player.buffs.blastTimer > 0,
          isPierce: player.buffs.apTimer > 0,
          isFromPlayer: true,
          ricochetsLeft: 2,
          active: true,
        });
      }

      // Evolved Laser Weapon (from Sacrifice Altar)
      if (player.buffs.laserWeapon) {
        bullets.push({
          id: Math.random(),
          x: player.x,
          y: player.y - 14,
          vx: 0,
          vy: -920,
          damage: dmgPerBullet * 2.8,
          gateCharge: gateChargePerBullet * 1.5,
          radius: 6,
          color: '#c084fc',
          isPierce: true,
          isLaser: true,
          isFromPlayer: true,
          ricochetsLeft: 2,
          active: true,
        });
      }

      // Evolved Homing Micro-Missiles
      if (player.buffs.homingMissiles && enemies.length > 0) {
        const target = enemies.find(e => e.active && e.y >= 25 && e.y < player.y - 40);
        if (target) {
          bullets.push({
            id: Math.random(),
            x: player.x + (Math.random() < 0.5 ? -18 : 18),
            y: player.y - 8,
            vx: (Math.random() - 0.5) * 80,
            vy: -520,
            damage: dmgPerBullet * 2.2,
            gateCharge: gateChargePerBullet * 1.2,
            radius: 4,
            color: '#f43f5e',
            isHoming: true,
            targetEnemyId: target.id,
            isFromPlayer: true,
            active: true,
          });
        }
      }

      sfx.playLaser(player.buffs.rapidTimer > 0 ? 760 : 580);
    }

    // Cyan Sniper Specialist Railgun (Passes through gates/crates)
    if (player.specialists.sniper > 0 && player.sniperTimer <= 0) {
      player.sniperTimer = 1.4;
      const count = Math.min(5, player.specialists.sniper);
      for (let s = 0; s < count; s++) {
        bullets.push({
          id: Math.random(),
          x: player.x + (s - (count - 1) / 2) * 14,
          y: player.y - 16,
          vx: 0,
          vy: -950,
          damage: (15 + firepowerLvl * 5) * 3.5,
          gateCharge: 2.0,
          radius: 4.5,
          color: '#06b6d4',
          isPierce: true,
          isFromPlayer: true,
          ricochetsLeft: 2,
          active: true,
        });
      }
      sfx.playSniperRail();
    }

    // Orange Vanguard Point-Blank Shotgun
    if (player.specialists.vanguard > 0 && player.vanguardTimer <= 0) {
      player.vanguardTimer = 0.95;
      const spreadAngles = [-0.22, -0.11, 0, 0.11, 0.22];
      spreadAngles.forEach(ang => {
        bullets.push({
          id: Math.random(),
          x: player.x,
          y: player.y - 10,
          vx: Math.sin(ang) * 540,
          vy: -Math.cos(ang) * 540,
          damage: (12 + firepowerLvl * 3) * 1.6,
          gateCharge: 1.2,
          radius: 5,
          color: '#f97316',
          isBlast: true,
          isFromPlayer: true,
          ricochetsLeft: 2,
          active: true,
        });
      });
      sfx.playShotgun();
    }

    // Yellow EMP Mortar (Arcs over gates directly onto backline drones/artillery)
    if (player.specialists.mortar > 0 && player.mortarTimer <= 0) {
      player.mortarTimer = 2.4;
      const target = enemies.find(e => e.active && e.y >= 25 && (e.type === 'HEALER_DRONE' || e.type === 'SHOOTER' || e.isBoss));
      const targetX = target ? target.x : player.x + (Math.random() - 0.5) * 140;
      const targetY = target ? target.y : player.y - 280;

      bullets.push({
        id: Math.random(),
        x: player.x,
        y: player.y - 12,
        vx: 0,
        vy: 0,
        damage: (14 + firepowerLvl * 4) * 3.4,
        gateCharge: 2.5,
        radius: 6.5,
        color: '#eab308',
        isMortar: true,
        isBlast: true,
        isFromPlayer: true,
        mortarArc: {
          startX: player.x,
          startY: player.y - 12,
          targetX,
          targetY,
          progress: 0,
          duration: 0.85,
        },
        active: true,
      });
    }
  }

  public static updateBullets(
    bullets: Bullet[], 
    dt: number, 
    enemies: Enemy[], 
    particles: Particle[],
    addTrauma: (amt: number) => void,
    shockwaves?: Shockwave[]
  ): void {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.active) {
        bullets.splice(i, 1);
        continue;
      }

      if (b.isMortar && b.mortarArc) {
        b.mortarArc.progress += dt / b.mortarArc.duration;
        const p = b.mortarArc.progress;
        if (p >= 1.0) {
          b.active = false;
          b.x = b.mortarArc.targetX;
          b.y = b.mortarArc.targetY;
          this.createExplosionParticles(b.x, b.y, b.color, particles, 18, true);
          if (shockwaves) this.createShockwave(b.x, b.y, b.color, shockwaves, 52);
          addTrauma(0.18);
          sfx.playExplosion(false);
          enemies.forEach(e => {
            if (e.active && Math.hypot(e.x - b.x, e.y - b.y) <= 68) {
              e.hp -= b.damage;
              e.hitFlash = 1;
            }
          });
          continue;
        }
        b.x = b.mortarArc.startX + (b.mortarArc.targetX - b.mortarArc.startX) * p;
        const linearY = b.mortarArc.startY + (b.mortarArc.targetY - b.mortarArc.startY) * p;
        const arcHeight = Math.sin(p * Math.PI) * 75;
        b.y = linearY - arcHeight;
        continue;
      }

      if (b.isHoming && b.targetEnemyId) {
        const target = enemies.find(e => e.id === b.targetEnemyId && e.active);
        if (target) {
          const dx = target.x - b.x;
          const dy = target.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 5) {
            b.vx += (dx / dist) * 720 * dt;
            b.vy += (dy / dist) * 720 * dt;
            const spd = Math.hypot(b.vx, b.vy);
            b.vx = (b.vx / spd) * 540;
            b.vy = (b.vy / spd) * 540;
          }
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Secondary wall-rail bank for ricocheting bullets
      if (Math.abs(b.vx) > 100 && (b.ricochetsLeft ?? 0) > 0) {
        if (b.x <= 18 && b.vx < 0) {
          b.x = 20;
          b.vx = Math.abs(b.vx);
          b.ricochetsLeft = (b.ricochetsLeft || 1) - 1;
          this.createExplosionParticles(b.x, b.y, '#fde047', particles, 4, true);
        } else if (b.x >= 362 && b.vx > 0) {
          b.x = 360;
          b.vx = -Math.abs(b.vx);
          b.ricochetsLeft = (b.ricochetsLeft || 1) - 1;
          this.createExplosionParticles(b.x, b.y, '#fde047', particles, 4, true);
        }
      }

      // Bullets deactivate upon reaching visible highway border (no off-screen travel)
      if (b.y < 20 || b.y > 900 || b.x < -20 || b.x > 450) {
        b.active = false;
      }
    }
  }

  public static handleObstacleInteractions(
    player: PlayerState, 
    obstacles: FieldObstacle[], 
    bullets: Bullet[],
    dt: number,
    particles?: Particle[]
  ): void {
    player.fireRateMultiplier = 1.0;
    player.dragSpeedMultiplier = 1.0;

    obstacles.forEach(obs => {
      if (!obs.active) return;

      if (obs.type === 'SPEED_STRIP' || obs.type === 'HAZARD_STRIP') {
        const inZone = 
          player.x >= obs.x - obs.width / 2 && 
          player.x <= obs.x + obs.width / 2 && 
          player.y >= obs.y - obs.height / 2 && 
          player.y <= obs.y + obs.height / 2;

        if (inZone) {
          if (obs.type === 'SPEED_STRIP') {
            player.fireRateMultiplier = obs.overclockRate || 1.5;
          } else if (obs.type === 'HAZARD_STRIP') {
            player.dragSpeedMultiplier = obs.dragFactor || 0.65;
          }
        }
      }

      if (obs.type === 'PRISM_MIRROR') {
        const bounceDirection = (obs.lane === 'LEFT' || obs.angleDeg > 0) ? 1 : -1;
        bullets.forEach(b => {
          if (!b.active || !b.isFromPlayer || (b.ricochetsLeft ?? 2) <= 0) return;
          // Prevent double-colliding if bullet was already deflected in this direction
          if (Math.sign(b.vx) === bounceDirection && Math.abs(b.vx) > 200) return;

          const collides = 
            b.x >= obs.x - obs.width / 2 && 
            b.x <= obs.x + obs.width / 2 && 
            b.y >= obs.y - obs.height / 2 && 
            b.y <= obs.y + obs.height / 2;

          if (collides) {
            b.ricochetsLeft = (b.ricochetsLeft ?? 2) - 1;
            b.vx = bounceDirection * 440;
            b.vy = -500;
            b.damage *= 1.35; // Ricochet Overcharge (+35% damage)
            b.radius = Math.max(4.5, b.radius);
            b.color = '#fde047';
            b.isPierce = true; // Ricocheted shots slice cleanly across into opposite lane enemies
            if (particles) {
              this.createExplosionParticles(b.x, b.y, '#fde047', particles, 5, true);
            }
            sfx.playRicochet();
          }
        });
      }
    });
  }

  public static handleGateAndCrateHits(
    gates: Gate[],
    crates: Crate[],
    bullets: Bullet[],
    particles: Particle[],
    floatTexts: FloatingText[],
    unlockBoost: (boostType: string, x: number, y: number, color: string) => void,
    shockwaves?: Shockwave[]
  ): void {
    bullets.forEach(b => {
      if (!b.active || !b.isFromPlayer) return;

      // 1. Check Gate Hits
      for (const g of gates) {
        // Maxed, Unlocked, or Neutralized Gates: 100% Pass-Through (Bullets fly through to hit enemies behind)
        const isMaxed = 
          (g.kind === 'HAZARD' && g.val >= 0) ||
          ((g.kind === 'CHARGE_ADD' || g.kind === 'QUANTUM') && g.val >= g.maxVal) ||
          ((g.kind === 'LOCKED_MULT' || g.kind === 'BUFF_GATE') && g.unlocked) ||
          (g.kind === 'ALTAR' && (g.altarSacrificeCost ?? 0) <= 0);

        if (isMaxed) continue;

        if (
          b.y <= g.y + g.h / 2 &&
          b.y >= g.y - g.h / 2 &&
          Math.abs(b.x - g.x) <= g.w / 2
        ) {
          const isRailgunOrLaser = b.isLaser || (b.isPierce && b.color === '#06b6d4');
          if (isRailgunOrLaser && b.lastHitGateId === g.id) continue;
          if (isRailgunOrLaser) {
            b.lastHitGateId = g.id;
          } else {
            b.active = false; // Barriers absorb incoming bullets until unlocked/maxed
          }

          g.hitScale = 1.0;
          this.createExplosionParticles(b.x, b.y, g.color || '#38bdf8', particles, 4, true);

          // AP rounds deal 2.2x barrier charge
          const chargeMult = (b.isPierce && b.color === '#fde047') ? 2.2 : 1.15;
          const chargeAmt = (b.gateCharge || 1.0) * chargeMult;

          if (g.kind === 'LOCKED_MULT' || g.kind === 'BUFF_GATE') {
            if (!g.unlocked) {
              g.lockHitsRemaining = Math.max(0, g.lockHitsRemaining - chargeAmt);
              if (g.lockHitsRemaining <= 0) {
                g.unlocked = true;
                sfx.playGateCharge();
                this.createExplosionParticles(g.x, g.y, '#34d399', particles, 14);
                if (shockwaves) this.createShockwave(g.x, g.y, '#34d399', shockwaves, 64);
                floatTexts.push({
                  id: Math.random(),
                  text: g.kind === 'LOCKED_MULT' ? `🔓 x${g.val} SQUAD UNLOCKED!` : '🔓 UNLOCKED!',
                  x: g.x,
                  y: g.y - 18,
                  vy: -35,
                  color: '#34d399',
                  fontSize: 14,
                  alpha: 1.0,
                  life: 0.8,
                });
              }
            }
          } else if (g.kind === 'ALTAR') {
            // Shooting the Altar purifies it and reduces the troop sacrifice cost down to zero
            g.chargeHits += chargeAmt;
            const hitsPerReduction = g.hitsPerStep || 4;
            while (g.chargeHits >= hitsPerReduction && (g.altarSacrificeCost ?? 0) > 0) {
              g.chargeHits -= hitsPerReduction;
              g.altarSacrificeCost = Math.max(0, (g.altarSacrificeCost ?? 1) - 1);
              sfx.playGateCharge();
              if (g.altarSacrificeCost === 0) {
                g.unlocked = true;
                this.createExplosionParticles(g.x, g.y, '#c084fc', particles, 16);
                if (shockwaves) this.createShockwave(g.x, g.y, '#c084fc', shockwaves, 64);
                floatTexts.push({
                  id: Math.random(),
                  text: '⚡ FREE ASCENSION (0 SQUAD)!',
                  x: g.x,
                  y: g.y - 18,
                  vy: -35,
                  color: '#c084fc',
                  fontSize: 14,
                  alpha: 1.0,
                  life: 1.0,
                });
              }
            }
          } else if (g.kind === 'HAZARD') {
            // Shooting a Hazard neutralizes it toward 0 (Safe)
            g.chargeHits += chargeAmt;
            const stepHits = Math.min(6, g.hitsPerStep || 5);
            while (g.chargeHits >= stepHits && g.val < 0) {
              g.chargeHits -= stepHits;
              g.val += 1;
              sfx.playGateCharge();
              if (g.val >= 0) {
                g.val = 0;
                if (shockwaves) this.createShockwave(g.x, g.y, '#10b981', shockwaves, 52);
                floatTexts.push({
                  id: Math.random(),
                  text: '⚡ HAZARD NEUTRALIZED (0)!',
                  x: g.x,
                  y: g.y - 18,
                  vy: -35,
                  color: '#34d399',
                  fontSize: 14,
                  alpha: 1.0,
                  life: 1.0,
                });
              }
            }
          } else if (g.kind === 'CHARGE_ADD' || g.kind === 'QUANTUM') {
            if (g.val < g.maxVal) {
              g.chargeHits += chargeAmt;
              while (g.chargeHits >= g.hitsPerStep && g.val < g.maxVal) {
                g.chargeHits -= g.hitsPerStep;
                g.val += 1;
                sfx.playGateCharge();
                if (g.val >= g.maxVal) {
                  g.chargeHits = g.hitsPerStep;
                  if (shockwaves) {
                    this.createShockwave(g.x, g.y, '#10b981', shockwaves, 52);
                  }
                  floatTexts.push({
                    id: Math.random(),
                    text: `⚡ MAXED (+${g.maxVal})!`,
                    x: g.x,
                    y: g.y - 18,
                    vy: -35,
                    color: '#34d399',
                    fontSize: 14,
                    alpha: 1.0,
                    life: 0.8,
                  });
                }
              }
            } else {
              g.chargeHits = g.hitsPerStep;
            }
          }

          return;
        }
      }

      // 2. Check Armory Crate Hits (Barriers absorb bullets until destroyed)
      for (let j = crates.length - 1; j >= 0; j--) {
        const c = crates[j];
        if (
          b.y <= c.y + c.h / 2 &&
          b.y >= c.y - c.h / 2 &&
          Math.abs(b.x - c.x) <= c.w / 2
        ) {
          const isRailgunOrLaser = b.isLaser || (b.isPierce && b.color === '#06b6d4');
          if (isRailgunOrLaser && b.lastHitCrateId === c.id) continue;
          if (isRailgunOrLaser) {
            b.lastHitCrateId = c.id;
          } else {
            b.active = false;
          }

          const crateDmg = b.damage * ((b.isPierce && b.color === '#fde047') ? 2.2 : 1.0);
          c.hp -= crateDmg;
          c.hitScale = 1.0;
          this.createExplosionParticles(b.x, b.y, c.color, particles, 4, true);

          if (c.hp <= 0) {
            unlockBoost(c.boostType, c.x, c.y, c.color);
            sfx.playExplosion(false);
            if (shockwaves) this.createShockwave(c.x, c.y, c.color, shockwaves, 54);
            crates.splice(j, 1);
          }
          return;
        }
      }
    });
  }

  public static handleEnemyInteractions(
    player: PlayerState, 
    enemies: Enemy[], 
    bullets: Bullet[], 
    particles: Particle[], 
    floatTexts: FloatingText[],
    dt: number,
    armorPierceLvl: number,
    addTrauma: (amt: number) => void,
    statsTracker: { totalKills: number; bossesDefeated: number; ricochetKills: number },
    shockwaves?: Shockwave[]
  ): void {
    // 1. Synergy: Shield Bearer links adjacent allies
    const shieldBearers = enemies.filter(e => e.active && e.type === 'SHIELD_BEARER');
    enemies.forEach(e => {
      if (e.type !== 'SHIELD_BEARER') {
        const nearBearer = shieldBearers.find(b => Math.hypot(b.x - e.x, b.y - e.y) <= 120);
        e.shielded = !!nearBearer;
        e.shieldSourceId = nearBearer?.id;
      }
    });

    // 2. Synergy: Healer Drones pulse heals
    enemies.forEach(e => {
      if (e.active && e.type === 'HEALER_DRONE') {
        e.healTimer = (e.healTimer || 1.8) - dt;
        if (e.healTimer <= 0) {
          e.healTimer = 1.8;
          enemies.forEach(target => {
            if (target.active && target.id !== e.id && target.hp < target.maxHp && Math.hypot(target.x - e.x, target.y - e.y) <= 140) {
              target.hp = Math.min(target.maxHp, target.hp + Math.round(target.maxHp * 0.18));
              this.createExplosionParticles(target.x, target.y, '#10b981', particles, 5);
            }
          });
        }
      }
    });

    // 3. Bullet vs Enemy Damage
    bullets.forEach(b => {
      if (!b.active || !b.isFromPlayer) return;

      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        // Enforce visible highway bounds: Enemies off-screen (y < 25) cannot be damaged or targeted
        if (!e.active || e.y < 25) continue;

        // Check Boss Armor Plates first
        if (e.isBoss && e.armorPlates) {
          for (const plate of e.armorPlates) {
            if (!plate.broken) {
              const px = e.x + plate.relX;
              const py = e.y + plate.relY;
              if (Math.abs(b.x - px) <= plate.w / 2 && Math.abs(b.y - py) <= plate.h / 2) {
                b.active = false;
                plate.hp -= b.damage;
                this.createExplosionParticles(b.x, b.y, '#f59e0b', particles, 4, true);
                if (plate.hp <= 0) {
                  plate.broken = true;
                  addTrauma(0.24);
                  sfx.playExplosion(true);
                  this.createExplosionParticles(px, py, '#f97316', particles, 18);
                  if (shockwaves) this.createShockwave(px, py, '#f97316', shockwaves, 48);
                }
                return;
              }
            }
          }
        }

        // Hitbox collision
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy <= (e.r + 5) * (e.r + 5)) {
          if (!b.isPierce) b.active = false;

          // Shield immunity
          if (e.shielded && !b.isBlast && !b.isLaser) {
            this.createExplosionParticles(b.x, b.y, '#a855f7', particles, 4);
            return;
          }

          // Armored Brute calculation
          let dmgMult = 1.0;
          if (e.armored) {
            const permPierceBonus = (armorPierceLvl - 1) * 0.12;
            dmgMult = player.buffs.apTimer > 0 ? (2.5 + permPierceBonus) : Math.min(1.0, 0.40 + permPierceBonus);
          }

          e.hp -= b.damage * dmgMult;
          e.hitFlash = 1;

          if (b.isCryo) {
            e.slowTimer = 2.6;
          }

          this.createExplosionParticles(b.x, b.y, b.color, particles, 4, true);

          // Splash Blast AoE
          if (player.buffs.blastTimer > 0 || b.isBlast) {
            for (let k = 0; k < enemies.length; k++) {
              const other = enemies[k];
              if (other.active && other !== e && Math.hypot(other.x - e.x, other.y - e.y) < 56) {
                other.hp -= b.damage * 0.45;
                other.hitFlash = 0.6;
              }
            }
          }

          // Enemy Death
          if (e.hp <= 0) {
            e.active = false;
            statsTracker.totalKills++;
            if ((b.ricochetsLeft ?? 2) < 2) statsTracker.ricochetKills++;
            if (e.isBoss) statsTracker.bossesDefeated++;

            this.createExplosionParticles(e.x, e.y, e.isBoss ? '#ef4444' : e.color, particles, e.isBoss ? 28 : 12);
            if (shockwaves && e.isBoss) this.createShockwave(e.x, e.y, '#ef4444', shockwaves, 100, 5.0);
            sfx.playExplosion(e.isBoss);

            // Explosive Mine detonation AoE
            if (e.type === 'MINE') {
              addTrauma(0.25);
              sfx.playExplosion(true);
              this.createExplosionParticles(e.x, e.y, '#fb923c', particles, 24);
              if (shockwaves) this.createShockwave(e.x, e.y, '#fb923c', shockwaves, 85, 4.5);
              floatTexts.push({
                id: Math.random(),
                text: '💥 MINE DETONATED!',
                x: e.x,
                y: e.y,
                vy: -35,
                color: '#fb923c',
                fontSize: 14,
                alpha: 1.0,
                life: 0.8,
              });
              for (let k = 0; k < enemies.length; k++) {
                const other = enemies[k];
                if (other.active && other !== e && Math.hypot(other.x - e.x, other.y - e.y) < 95) {
                  other.hp -= e.maxHp * 2.4;
                  other.hitFlash = 1;
                }
              }
            }
          }
          return;
        }
      }
    });

    // 4. Boss Phase 2 Transition & Enrage
    enemies.forEach(e => {
      if (e.active && e.isBoss && !e.enraged && e.hp <= e.maxHp * 0.5) {
        e.enraged = true;
        e.bossPhase = 2;
        e.speed *= 1.45;
        addTrauma(0.35);
        sfx.playBossEnrage();
        floatTexts.push({
          id: Math.random(),
          text: `⚠️ TITAN ENRAGED!`,
          x: e.x,
          y: e.y - 45,
          vy: -30,
          color: '#ef4444',
          fontSize: 18,
          alpha: 1.0,
          life: 1.4,
        });

        if (!e.enrageDeployed) {
          e.enrageDeployed = true;
          enemies.push({
            id: Math.random(),
            type: 'MINE',
            x: e.x - 55,
            y: e.y + 60,
            r: 16,
            hp: Math.round(e.maxHp * 0.12),
            maxHp: Math.round(e.maxHp * 0.12),
            speed: 40,
            scoreVal: 15,
            color: '#eab308',
            armored: false,
            isBoss: false,
            slowTimer: 0,
            shootCooldown: 0,
            hitFlash: 0,
            bossPhase: 0,
            active: true,
          });
          enemies.push({
            id: Math.random(),
            type: 'MINE',
            x: e.x + 55,
            y: e.y + 60,
            r: 16,
            hp: Math.round(e.maxHp * 0.12),
            maxHp: Math.round(e.maxHp * 0.12),
            speed: 40,
            scoreVal: 15,
            color: '#eab308',
            armored: false,
            isBoss: false,
            slowTimer: 0,
            shootCooldown: 0,
            hitFlash: 0,
            bossPhase: 0,
            active: true,
          });
        }
      }
    });
  }

  public static createExplosionParticles(
    x: number, 
    y: number, 
    color: string, 
    particles: Particle[], 
    count: number = 8,
    isSpark: boolean = false
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = isSpark ? (120 + Math.random() * 240) : (40 + Math.random() * 120);
      const life = isSpark ? (0.2 + Math.random() * 0.25) : 0.6;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: isSpark ? 2.5 : (2 + Math.random() * 2.5),
        color,
        alpha: 1.0,
        decay: 1.0 / life,
        life,
        maxLife: life,
        isSpark,
      });
    }
  }

  public static createShockwave(
    x: number, 
    y: number, 
    color: string, 
    shockwaves: Shockwave[], 
    maxRadius: number = 48,
    lineWidth: number = 3.5
  ): void {
    shockwaves.push({
      x,
      y,
      radius: 6,
      maxRadius,
      color,
      lineWidth,
      alpha: 1.0,
      decay: 2.2,
    });
  }
}
