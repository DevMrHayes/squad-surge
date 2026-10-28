// Squad Surge: Combat, Ballistics, Synergy & Collision Physics Engine
import { 
  PlayerState, 
  SquadMember, 
  SpecialistType, 
  Bullet, 
  Gate, 
  FieldObstacle, 
  Enemy, 
  Particle, 
  FloatingText,
  BossArmorPlate 
} from '../types/game';
import { sfx } from '../services/audio';

export class CombatEngine {
  public static updateSquadFormation(player: PlayerState): void {
    const total = Math.max(1, player.count);
    const members: SquadMember[] = [];

    // Columns and rows arranged in an aerodynamic cluster
    const cols = Math.min(10, Math.ceil(Math.sqrt(total * 1.5)));
    const spacingX = 9;
    const spacingY = 10;

    // Distribute specialists
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
    enemies: Enemy[]
  ): void {
    player.fireTimer -= dt * player.fireRateMultiplier;
    player.sniperTimer -= dt;
    player.vanguardTimer -= dt;
    player.mortarTimer -= dt;

    const baseDmg = 12 + firepowerLvl * 4;
    const excessMultiplier = player.count > 14 ? 1 + (player.count - 14) * 0.05 : 1.0;
    const dmg = Math.round(baseDmg * excessMultiplier * (player.buffs.apTimer > 0 ? 1.6 : 1.0));

    // 1. Standard / Rapid Fire Volley
    const interval = player.buffs.rapidTimer > 0 ? 0.08 : 0.16;
    if (player.fireTimer <= 0) {
      player.fireTimer = interval;
      const barrelCount = Math.min(14, Math.max(1, Math.min(player.count, 12)));
      const spread = 8;
      const startX = -((barrelCount - 1) * spread) / 2;

      for (let b = 0; b < barrelCount; b++) {
        const bx = player.x + startX + b * spread;
        bullets.push({
          id: Math.random(),
          x: bx,
          y: player.y - 12,
          vx: 0,
          vy: -620,
          damage: dmg,
          radius: 3.5,
          color: player.buffs.cryoTimer > 0 ? '#67e8f9' : player.buffs.apTimer > 0 ? '#fb923c' : '#38bdf8',
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
          vy: -880,
          damage: Math.round(dmg * 2.2),
          radius: 6,
          color: '#c084fc',
          isPierce: true,
          isLaser: true,
          isFromPlayer: true,
          active: true,
        });
      }

      // Evolved Homing Micro-Missiles
      if (player.buffs.homingMissiles && enemies.length > 0) {
        const target = enemies.find(e => e.active && e.y < player.y - 40);
        if (target) {
          bullets.push({
            id: Math.random(),
            x: player.x + (Math.random() < 0.5 ? -18 : 18),
            y: player.y - 8,
            vx: (Math.random() - 0.5) * 80,
            vy: -480,
            damage: Math.round(dmg * 1.8),
            radius: 4,
            color: '#f43f5e',
            isHoming: true,
            targetEnemyId: target.id,
            isFromPlayer: true,
            active: true,
          });
        }
      }

      sfx.playLaser(player.buffs.rapidTimer > 0 ? 1040 : 840);
    }

    // 2. Cyan Sniper Specialist Railgun (Passes through gates/crates)
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
          damage: Math.round(dmg * 3.5),
          radius: 4.5,
          color: '#06b6d4',
          isPierce: true, // Pierces through gates & enemies!
          isFromPlayer: true,
          active: true,
        });
      }
      sfx.playSniperRail();
    }

    // 3. Orange Vanguard Point-Blank Shotgun
    if (player.specialists.vanguard > 0 && player.vanguardTimer <= 0) {
      player.vanguardTimer = 0.95;
      const spreadAngles = [-0.22, -0.11, 0, 0.11, 0.22];
      spreadAngles.forEach(ang => {
        bullets.push({
          id: Math.random(),
          x: player.x,
          y: player.y - 10,
          vx: Math.sin(ang) * 520,
          vy: -Math.cos(ang) * 520,
          damage: Math.round(dmg * 1.5),
          radius: 5,
          color: '#f97316',
          isBlast: true,
          isFromPlayer: true,
          active: true,
        });
      });
      sfx.playShotgun();
    }

    // 4. Yellow EMP Mortar (Arcs over gates directly onto backline drones/artillery)
    if (player.specialists.mortar > 0 && player.mortarTimer <= 0) {
      player.mortarTimer = 2.4;
      const target = enemies.find(e => e.active && (e.type === 'HEALER_DRONE' || e.type === 'ARTILLERY' || e.isBoss));
      const targetX = target ? target.x : player.x + (Math.random() - 0.5) * 140;
      const targetY = target ? target.y : player.y - 280;

      bullets.push({
        id: Math.random(),
        x: player.x,
        y: player.y - 12,
        vx: 0,
        vy: 0,
        damage: Math.round(dmg * 3.2),
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
    particles: Particle[]
  ): void {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.active) {
        bullets.splice(i, 1);
        continue;
      }

      // Mortar projectile curve
      if (b.isMortar && b.mortarArc) {
        b.mortarArc.progress += dt / b.mortarArc.duration;
        const p = b.mortarArc.progress;
        if (p >= 1.0) {
          // Detonate at target
          b.active = false;
          b.x = b.mortarArc.targetX;
          b.y = b.mortarArc.targetY;
          this.createExplosionParticles(b.x, b.y, b.color, particles, 18);
          sfx.playExplosion(false);
          // AoE damage
          enemies.forEach(e => {
            if (e.active && Math.hypot(e.x - b.x, e.y - b.y) <= 65) {
              e.hp -= b.damage;
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

      // Homing guidance
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
            b.vx = (b.vx / spd) * 520;
            b.vy = (b.vy / spd) * 520;
          }
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Screen boundary removal
      if (b.y < -50 || b.y > 900 || b.x < -20 || b.x > 450) {
        b.active = false;
      }
    }
  }

  public static handleObstacleInteractions(
    player: PlayerState, 
    obstacles: FieldObstacle[], 
    bullets: Bullet[],
    dt: number
  ): void {
    player.fireRateMultiplier = 1.0;
    player.dragSpeedMultiplier = 1.0;

    obstacles.forEach(obs => {
      if (!obs.active) return;

      // Speed / Hazard Strips zone detection
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

      // Prism Mirror Ricochet Physics (Phase 1)
      if (obs.type === 'PRISM_MIRROR') {
        bullets.forEach(b => {
          if (!b.active || !b.isFromPlayer || (b.ricochetsLeft ?? 0) <= 0) return;

          const collides = 
            b.x >= obs.x - obs.width / 2 && 
            b.x <= obs.x + obs.width / 2 && 
            b.y >= obs.y - obs.height / 2 && 
            b.y <= obs.y + obs.height / 2;

          if (collides) {
            b.ricochetsLeft = (b.ricochetsLeft || 2) - 1;
            // Bounce across highway: reverse and angle vx
            const bounceDirection = obs.angleDeg > 0 ? 1 : -1;
            b.vx = bounceDirection * 340;
            b.vy = -450;
            b.color = '#f59e0b'; // Amber energize
            sfx.playRicochet();
          }
        });
      }
    });
  }

  public static handleGateInteractions(
    player: PlayerState, 
    gates: Gate[], 
    bullets: Bullet[], 
    floatTexts: FloatingText[], 
    particles: Particle[],
    statsTracker: { gatesCharged: number; altarsUsed: number }
  ): void {
    gates.forEach(g => {
      if (!g.isUnlocked || g.isConsumed) return;

      // Bullet absorption & gate charging
      bullets.forEach(b => {
        if (!b.active || !b.isFromPlayer || b.isPierce) return;

        const collides = 
          b.x >= g.x - g.width / 2 && 
          b.x <= g.x + g.width / 2 && 
          b.y >= g.y - g.height / 2 && 
          b.y <= g.y + g.height / 2;

        if (collides) {
          b.active = false;
          // Locked gate shield
          if (g.lockHp > 0) {
            g.lockHp -= b.damage;
            if (g.lockHp <= 0) {
              g.lockHp = 0;
              sfx.playExplosion(false);
            }
            return;
          }

          // Math charge increment
          if (g.type === 'MATH' || g.type === 'QUANTUM') {
            g.chargeHits++;
            if (g.chargeHits >= g.hitsPerStep) {
              g.chargeHits = 0;
              if (g.val < g.maxVal) {
                g.val++;
                statsTracker.gatesCharged++;
                sfx.playGateCharge();
                floatTexts.push({
                  id: Math.random(),
                  text: `+1 GATE`,
                  x: g.x,
                  y: g.y - 16,
                  vy: -35,
                  color: '#38bdf8',
                  fontSize: 14,
                  alpha: 1.0,
                  life: 0.6,
                });
              }
            }
          }
        }
      });

      // Squad traversal through gate
      const squadCollides = 
        Math.abs(player.x - g.x) < g.width / 2 + 18 && 
        Math.abs(player.y - g.y) < g.height / 2 + 14;

      if (squadCollides) {
        g.isConsumed = true;
        this.createExplosionParticles(g.x, g.y, '#38bdf8', particles, 14);

        if (g.type === 'ALTAR') {
          // Sacrifice / Conversion Altar (Phase 1)
          const cost = g.altarSacrificeCost || 15;
          const actualDeduct = Math.min(player.count - 1, cost);
          player.count = Math.max(1, player.count - actualDeduct);
          statsTracker.altarsUsed++;

          if (g.altarWeaponReward === 'laserWeapon') {
            player.buffs.laserWeapon = true;
            floatTexts.push({
              id: Math.random(),
              text: `⚡ LASER EVOLVED!`,
              x: player.x,
              y: player.y - 30,
              vy: -45,
              color: '#c084fc',
              fontSize: 16,
              alpha: 1.0,
              life: 1.2,
            });
          } else {
            player.buffs.homingMissiles = true;
            floatTexts.push({
              id: Math.random(),
              text: `🚀 HOMING MISSILES!`,
              x: player.x,
              y: player.y - 30,
              vy: -45,
              color: '#f43f5e',
              fontSize: 16,
              alpha: 1.0,
              life: 1.2,
            });
          }
          sfx.playAltarSacrifice();
          this.updateSquadFormation(player);
          return;
        }

        // Armory Crate Specialist Morphs (Phase 3)
        if (g.type === 'CRATE' && g.boostKey) {
          if (g.boostKey === 'sniper') player.specialists.sniper += 2;
          else if (g.boostKey === 'vanguard') player.specialists.vanguard += 2;
          else if (g.boostKey === 'mortar') player.specialists.mortar += 1;
          sfx.playWin();
          this.updateSquadFormation(player);
          return;
        }

        // Standard Math Gate multiplier
        const gained = g.op === '+' ? g.val : Math.round(player.count * (g.val - 1));
        player.count = Math.min(250, player.count + gained);
        this.updateSquadFormation(player);
        sfx.playGateCharge();
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
    statsTracker: { totalKills: number; bossesDefeated: number; ricochetKills: number }
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

      enemies.forEach(e => {
        if (!e.active) return;

        // Check Boss Armor Plates first (Phase 2)
        if (e.isBoss && e.armorPlates) {
          for (const plate of e.armorPlates) {
            if (!plate.broken) {
              const px = e.x + plate.relX;
              const py = e.y + plate.relY;
              if (Math.abs(b.x - px) <= plate.w / 2 && Math.abs(b.y - py) <= plate.h / 2) {
                b.active = false;
                plate.hp -= b.damage;
                this.createExplosionParticles(b.x, b.y, '#f59e0b', particles, 4);
                if (plate.hp <= 0) {
                  plate.broken = true;
                  sfx.playExplosion(true);
                  this.createExplosionParticles(px, py, '#f97316', particles, 16);
                }
                return;
              }
            }
          }
        }

        // Hitbox collision
        const hit = Math.abs(b.x - e.x) <= e.width / 2 && Math.abs(b.y - e.y) <= e.height / 2;
        if (hit) {
          if (!b.isPierce) b.active = false;

          // Shield immunity check (unless splash or pierce)
          if (e.shielded && !b.isBlast && !b.isLaser) {
            this.createExplosionParticles(b.x, b.y, '#a855f7', particles, 4);
            return;
          }

          // Damage application
          e.hp -= b.damage;
          if (b.isCryo) {
            e.isSlowed = true;
            e.slowTimer = 2.0;
          }

          this.createExplosionParticles(b.x, b.y, b.color, particles, 3);

          // Enemy Death
          if (e.hp <= 0) {
            e.active = false;
            statsTracker.totalKills++;
            if ((b.ricochetsLeft ?? 2) < 2) statsTracker.ricochetKills++;
            if (e.isBoss) statsTracker.bossesDefeated++;

            this.createExplosionParticles(e.x, e.y, e.isBoss ? '#ef4444' : '#38bdf8', particles, e.isBoss ? 28 : 12);
            sfx.playExplosion(e.isBoss);

            // Mine detonation AoE damage back to nearby enemies (or Boss!)
            if (e.type === 'EXPLOSIVE_MINE') {
              enemies.forEach(nearby => {
                if (nearby.active && nearby.id !== e.id && Math.hypot(nearby.x - e.x, nearby.y - e.y) <= 110) {
                  nearby.hp -= 220;
                }
              });
            }
          }
        }
      });
    });

    // 4. Boss Phase 2 Transition & Enrage (Phase 2)
    enemies.forEach(e => {
      if (e.active && e.isBoss && !e.enraged && e.hp <= e.maxHp * 0.5) {
        e.enraged = true;
        e.bossPhase = 2;
        e.speed *= 1.45;
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

        // Spawn explosive mines that player can trigger against the boss
        if (!e.enrageDeployed) {
          e.enrageDeployed = true;
          enemies.push({
            id: Math.random(),
            type: 'EXPLOSIVE_MINE',
            x: e.x - 55,
            y: e.y + 70,
            width: 24,
            height: 24,
            hp: 30,
            maxHp: 30,
            speed: 30,
            scoreVal: 15,
            isBoss: false,
            active: true,
          });
          enemies.push({
            id: Math.random(),
            type: 'EXPLOSIVE_MINE',
            x: e.x + 55,
            y: e.y + 70,
            width: 24,
            height: 24,
            hp: 30,
            maxHp: 30,
            speed: 30,
            scoreVal: 15,
            isBoss: false,
            active: true,
          });
        }
      }
    });

    // 5. Squad vs Enemy Defense Line Breaches
    enemies.forEach(e => {
      if (!e.active) return;
      if (e.y >= player.y - 16) {
        // Breached defense line: troop casualty
        const troopsLost = Math.min(player.count, Math.max(1, Math.ceil(e.hp / 30)));
        player.count -= troopsLost;
        e.active = false;
        this.createExplosionParticles(e.x, e.y, '#ef4444', particles, 14);
        sfx.playLose();
        this.updateSquadFormation(player);
      }
    });
  }

  private static createExplosionParticles(
    x: number, 
    y: number, 
    color: string, 
    particles: Particle[], 
    count: number = 8
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: 2 + Math.random() * 2.5,
        color,
        alpha: 1.0,
        decay: 1.6 + Math.random() * 1.2,
        life: 0.6,
      });
    }
  }
}
