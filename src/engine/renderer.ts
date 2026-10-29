// 60FPS High-Performance Visual Upgrade Canvas Renderer for Squad Surge
import { 
  PlayerState, 
  Gate, 
  Crate,
  FieldObstacle, 
  Enemy, 
  EnemyMortarShell,
  Bullet, 
  Particle, 
  Shockwave,
  FloatingText,
  BiomeConfig 
} from '../types/game';

export class GameRenderer {
  public static render(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    biome: BiomeConfig,
    elapsed: number,
    trauma: number,
    player: PlayerState,
    gates: Gate[],
    crates: Crate[],
    obstacles: FieldObstacle[],
    enemies: Enemy[],
    enemyMortars: EnemyMortarShell[],
    bullets: Bullet[],
    particles: Particle[],
    shockwaves: Shockwave[],
    floatTexts: FloatingText[]
  ): void {
    ctx.clearRect(0, 0, cw, ch);

    ctx.save();

    // 1. Camera Trauma Screen Shake
    if (trauma > 0) {
      const shake = trauma * trauma;
      const offsetX = (Math.random() - 0.5) * 18 * shake;
      const offsetY = (Math.random() - 0.5) * 18 * shake;
      ctx.translate(offsetX, offsetY);
    }

    // 2. Highway Road & Biome Background
    ctx.fillStyle = biome.roadColor;
    ctx.fillRect(0, 0, cw, ch);

    const roadMargin = 16;
    ctx.fillStyle = '#090e1a';
    ctx.fillRect(roadMargin, 0, cw - roadMargin * 2, ch);

    // Subtle radial atmospheric biome glow
    const glowGrad = ctx.createRadialGradient(cw / 2, ch / 2, 40, cw / 2, ch / 2, cw * 0.85);
    glowGrad.addColorStop(0, biome.bgGlow);
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(roadMargin, 0, cw - roadMargin * 2, ch);

    // Procedural Speed Streaks on Highway Shoulders (High-Velocity Momentum)
    const streakCount = 8;
    ctx.save();
    ctx.strokeStyle = biome.accentColor;
    ctx.lineWidth = 1.4;
    for (let s = 0; s < streakCount; s++) {
      const sx = (s % 2 === 0) ? (roadMargin + 3 + (s * 3) % 9) : (cw - roadMargin - 3 - (s * 3) % 9);
      const sy = ((elapsed * 340 + s * 95) % (ch + 60)) - 30;
      const streakLen = 20 + (s % 4) * 8;
      ctx.globalAlpha = 0.22 + (s % 3) * 0.14;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + streakLen);
      ctx.stroke();
    }
    ctx.restore();

    // Scrolling Lane Dashes
    ctx.strokeStyle = biome.laneLineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    ctx.lineDashOffset = -(elapsed * 55);

    const laneW = (cw - roadMargin * 2) / 2;
    ctx.beginPath();
    ctx.moveTo(roadMargin + laneW, 0);
    ctx.lineTo(roadMargin + laneW, ch);
    ctx.stroke();
    ctx.setLineDash([]);

    // Highway Edge Rails
    ctx.strokeStyle = biome.accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(roadMargin, 0); ctx.lineTo(roadMargin, ch);
    ctx.moveTo(cw - roadMargin, 0); ctx.lineTo(cw - roadMargin, ch);
    ctx.stroke();

    // 3. Render Field Obstacles (Prisms, Speed/Hazard Strips)
    obstacles.forEach(obs => {
      if (!obs.active) return;

      if (obs.type === 'SPEED_STRIP' || obs.type === 'HAZARD_STRIP') {
        const isSpeed = obs.type === 'SPEED_STRIP';
        ctx.fillStyle = isSpeed ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        ctx.strokeStyle = isSpeed ? '#0284c7' : '#b91c1c';
        ctx.lineWidth = 1.5;
        const rx = obs.x - obs.width / 2;
        const ry = obs.y - obs.height / 2;
        ctx.fillRect(rx, ry, obs.width, obs.height);
        ctx.strokeRect(rx, ry, obs.width, obs.height);

        ctx.fillStyle = isSpeed ? '#38bdf8' : '#ef4444';
        ctx.font = '900 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isSpeed ? '⚡ OVERCLOCK +50%' : '⚠️ HAZARD SLOW', obs.x, obs.y + 4);
      } else if (obs.type === 'PRISM_MIRROR') {
        ctx.save();
        const isLeft = obs.lane === 'LEFT' || obs.angleDeg > 0;
        const wallX = isLeft ? roadMargin : cw - roadMargin;
        const jut = 68 * (isLeft ? 1 : -1);
        const halfH = 38;

        // Flush Wall-Mounted Triangular Energy Bumper (spans into firing lane)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wallX, obs.y - halfH);
        ctx.lineTo(wallX + jut, obs.y);
        ctx.lineTo(wallX, obs.y + halfH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing Reflective Mirror Bevel Face (Bottom angled edge facing player shots)
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(wallX, obs.y + halfH);
        ctx.lineTo(wallX + jut, obs.y);
        ctx.stroke();

        // Dotted Ricochet Trajectory Guide
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(wallX + jut * 0.55, obs.y + halfH * 0.45);
        ctx.lineTo(wallX + jut * 1.85, obs.y - halfH * 0.55);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#fde047';
        ctx.font = '800 8px "JetBrains Mono", monospace';
        ctx.textAlign = isLeft ? 'left' : 'right';
        ctx.fillText('RICOCHET +35%', wallX + (isLeft ? 4 : -4), obs.y - halfH - 4);

        ctx.restore();
      }
    });

    // 4. Render Gates with Elastic Spring Hit Feedback
    gates.forEach(g => {
      ctx.save();
      const spring = g.hitScale || 0;
      const w = g.w * (1.0 + spring * 0.08);
      const h = g.h * (1.0 + spring * 0.08);
      const rx = g.x - w / 2;
      const ry = g.y - h / 2;

      if (g.kind === 'ALTAR') {
        // Sacrifice Altar
        ctx.fillStyle = 'rgba(88, 28, 135, 0.90)';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e9d5ff';
        ctx.font = '800 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SACRIFICE ALTAR', g.x, ry + 18);

        ctx.fillStyle = '#f43f5e';
        ctx.font = '900 13px "JetBrains Mono", monospace';
        ctx.fillText(`-${g.altarSacrificeCost || 15} SQUAD`, g.x, ry + 36);

        ctx.fillStyle = '#fbbf24';
        ctx.font = '700 9px Inter, sans-serif';
        ctx.fillText(g.altarWeaponReward === 'laserWeapon' ? 'REWARD: PIERCING LASER' : 'REWARD: HOMING MISSILES', g.x, ry + 48);
      } else if (g.kind === 'LOCKED_MULT' || g.kind === 'BUFF_GATE') {
        // Locked Mult or Buff Gate
        ctx.fillStyle = g.unlocked ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = g.unlocked ? '#10b981' : (g.color || '#fde047');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = g.unlocked ? '#34d399' : '#ffffff';
        ctx.font = '900 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(g.unlocked ? 'CLAIMABLE BOOST' : (g.label || 'LOCKED BOOST'), g.x, ry + 22);

        if (!g.unlocked) {
          const barW = w - 28;
          const barH = 5;
          const progress = Math.max(0, 1 - g.lockHitsRemaining / g.lockHitsMax);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(g.x - barW / 2, ry + 32, barW, barH);
          ctx.fillStyle = g.color || '#fde047';
          ctx.fillRect(g.x - barW / 2, ry + 32, barW * progress, barH);
        } else {
          ctx.fillStyle = '#34d399';
          ctx.font = '900 14px "JetBrains Mono", monospace';
          ctx.fillText('UNLOCKED', g.x, ry + 38);
        }
      } else {
        // Standard Charge Add / Hazard / Quantum Gate
        const isPositive = g.val >= 0;
        const isMaxed = g.maxVal > 0 && g.val >= g.maxVal;
        ctx.fillStyle = isMaxed 
          ? 'rgba(16, 185, 129, 0.28)' 
          : (isPositive ? 'rgba(14, 165, 233, 0.22)' : 'rgba(244, 63, 94, 0.22)');
        ctx.strokeStyle = isMaxed 
          ? '#10b981' 
          : (isPositive ? '#38bdf8' : '#f43f5e');
        ctx.lineWidth = isMaxed ? 2.5 : 2;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 10);
        ctx.fill();
        ctx.stroke();

        // Holographic Cyber Scanline & Corner Brackets
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 10);
        ctx.clip();
        const scanY = ry + ((elapsed * 45) % h);
        ctx.strokeStyle = isMaxed ? 'rgba(16, 185, 129, 0.40)' : 'rgba(255, 255, 255, 0.20)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx, scanY);
        ctx.lineTo(rx + w, scanY);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 20px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${g.val > 0 ? '+' : ''}${Math.round(g.val)}`, g.x, ry + 26);

        // Charge Progress Bar
        if (g.maxVal > 0) {
          const barW = w - 24;
          const barH = 5;
          // Calculate true continuous progress towards maxVal
          const chargeRatio = isMaxed 
            ? 1.0 
            : Math.max(0, Math.min(1.0, (Math.max(0, g.val) + (g.chargeHits / g.hitsPerStep)) / g.maxVal));
          const fillW = Math.max(0, Math.min(barW, barW * chargeRatio));

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(g.x - barW / 2, ry + 34, barW, barH);

          if (isMaxed) {
            ctx.fillStyle = '#10b981';
            ctx.fillRect(g.x - barW / 2, ry + 34, barW, barH);

            ctx.fillStyle = '#34d399';
            ctx.font = '800 8.5px Inter, sans-serif';
            ctx.fillText(`⚡ MAX REACHED (+${g.maxVal})`, g.x, ry + 46);
          } else {
            ctx.fillStyle = isPositive ? '#38bdf8' : '#f43f5e';
            ctx.fillRect(g.x - barW / 2, ry + 34, fillW, barH);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '700 8px Inter, sans-serif';
            ctx.fillText(`MAX +${g.maxVal}`, g.x, ry + 46);
          }
        }
      }

      ctx.restore();
    });

    // 5. Render Armory Crates
    crates.forEach(c => {
      ctx.save();
      const spring = c.hitScale || 0;
      const w = c.w * (1.0 + spring * 0.1);
      const h = c.h * (1.0 + spring * 0.1);
      const rx = c.x - w / 2;
      const ry = c.y - h / 2;

      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rx, ry, w, h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.label, c.x, ry + 22);

      const barW = w - 20;
      const barH = 4;
      const progress = Math.max(0, c.hp / c.maxHp);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(c.x - barW / 2, ry + 32, barW, barH);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x - barW / 2, ry + 32, barW * progress, barH);

      ctx.restore();
    });

    // 6. Render Shield Links
    enemies.forEach(e => {
      if (e.active && e.shielded && e.shieldSourceId) {
        const source = enemies.find(s => s.id === e.shieldSourceId && s.active);
        if (source) {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    // 7. Render Enemies & Bosses
    enemies.forEach(e => {
      if (!e.active) return;
      ctx.save();

      if (e.slowTimer > 0) {
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 12;
      }

      if (e.isBoss) {
        // Multi-Phase Boss Dreadnought Visuals
        const isTitan = e.type === 'TITAN';
        const pulse = Math.sin(elapsed * 8) * 0.5 + 0.5;

        // Triple plasma thrust plumes
        const thrusterY = e.y - e.r * 0.85;
        const flameLen = (isTitan ? 22 : 16) + Math.sin(elapsed * 28) * 6;
        const thrusterOffsets = isTitan ? [-e.r * 0.6, 0, e.r * 0.6] : [-e.r * 0.45, e.r * 0.45];
        ctx.fillStyle = e.enraged ? '#ef4444' : '#06b6d4';
        thrusterOffsets.forEach(ox => {
          ctx.beginPath();
          ctx.moveTo(e.x + ox - 4, thrusterY);
          ctx.lineTo(e.x + ox, thrusterY - flameLen);
          ctx.lineTo(e.x + ox + 4, thrusterY);
          ctx.fill();
        });

        // Layered Heavy Dreadnought Hull
        ctx.fillStyle = e.enraged ? '#450a0a' : '#090d1a';
        ctx.strokeStyle = e.enraged ? '#ef4444' : (isTitan ? '#f59e0b' : '#38bdf8');
        ctx.lineWidth = isTitan ? 4 : 3;

        ctx.beginPath();
        // Angular commanding prow
        ctx.moveTo(e.x, e.y + e.r * 1.15);
        ctx.lineTo(e.x + e.r * 0.95, e.y + e.r * 0.4);
        ctx.lineTo(e.x + e.r * 0.85, e.y - e.r * 0.7);
        ctx.lineTo(e.x + e.r * 0.4, e.y - e.r * 0.95);
        ctx.lineTo(e.x - e.r * 0.4, e.y - e.r * 0.95);
        ctx.lineTo(e.x - e.r * 0.85, e.y - e.r * 0.7);
        ctx.lineTo(e.x - e.r * 0.95, e.y + e.r * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner Armored Superstructure
        ctx.fillStyle = e.enraged ? '#7f1d1d' : '#1e293b';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.r * 0.6);
        ctx.lineTo(e.x + e.r * 0.5, e.y - e.r * 0.3);
        ctx.lineTo(e.x - e.r * 0.5, e.y - e.r * 0.3);
        ctx.closePath();
        ctx.fill();

        // Pulsing Core Reactor
        ctx.fillStyle = e.enraged ? '#dc2626' : (isTitan ? '#d97706' : '#0284c7');
        ctx.beginPath();
        ctx.arc(e.x, e.y - e.r * 0.05, e.r * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // Rotating turbine spokes inside reactor
        ctx.strokeStyle = e.enraged ? '#fecaca' : '#bae6fd';
        ctx.lineWidth = 1.8;
        for (let sp = 0; sp < 4; sp++) {
          const ang = elapsed * (e.enraged ? 9 : 5) + (sp * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - e.r * 0.05);
          ctx.lineTo(e.x + Math.cos(ang) * (e.r * 0.28), (e.y - e.r * 0.05) + Math.sin(ang) * (e.r * 0.28));
          ctx.stroke();
        }

        // Breakable Armored Pauldrons
        if (e.armorPlates) {
          e.armorPlates.forEach(plate => {
            if (!plate.broken) {
              const px = e.x + plate.relX - plate.w / 2;
              const py = e.y + plate.relY - plate.h / 2;
              ctx.fillStyle = '#334155';
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2;
              ctx.fillRect(px, py, plate.w, plate.h);
              ctx.strokeRect(px, py, plate.w, plate.h);

              // Plate rivet dots
              ctx.fillStyle = '#f59e0b';
              ctx.fillRect(px + 2, py + 2, 2, 2);
              ctx.fillRect(px + plate.w - 4, py + 2, 2, 2);
              ctx.fillRect(px + 2, py + plate.h - 4, 2, 2);
              ctx.fillRect(px + plate.w - 4, py + plate.h - 4, 2, 2);
            }
          });
        }

        // Boss Classification Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.name || (isTitan ? 'TITAN DREADNOUGHT' : 'WARDEN ASSAULT'), e.x, e.y + e.r * 0.95);

        // Core Boss HP Bar with Shielding Border
        const barW = e.r * 2.4;
        const barH = 7;
        const fillW = Math.max(0, (e.hp / e.maxHp) * barW);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(e.x - barW / 2, e.y - e.r - 18, barW, barH);
        ctx.fillStyle = e.enraged ? '#ef4444' : '#38bdf8';
        ctx.fillRect(e.x - barW / 2, e.y - e.r - 18, fillW, barH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(e.x - barW / 2, e.y - e.r - 18, barW, barH);

      } else {
        // PROCEDURAL VECTOR MECHANICAL SILHOUETTES
        const r = e.r;
        const flicker = 0.75 + Math.sin(elapsed * 26) * 0.25;

        // 1. Dual Rear Jet Propulsion Thrusters
        const thrusterY = e.y - r * 0.8;
        const jetColor = e.type === 'SPRINTER' ? '#38bdf8' : (e.type === 'HEALER_DRONE' ? '#34d399' : '#f97316');
        ctx.fillStyle = jetColor;
        [-r * 0.42, r * 0.42].forEach(ox => {
          ctx.beginPath();
          ctx.moveTo(e.x + ox - 2.5, thrusterY);
          ctx.lineTo(e.x + ox, thrusterY - 7 * flicker);
          ctx.lineTo(e.x + ox + 2.5, thrusterY);
          ctx.fill();
        });

        // 2. Unit Silhouette by Type
        if (e.type === 'SPRINTER') {
          // Volt Interceptor (Swept Dart + Cyan Chevrons)
          ctx.fillStyle = '#854d0e';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y + r * 1.25);
          ctx.lineTo(e.x + r * 1.05, e.y - r * 0.7);
          ctx.lineTo(e.x + r * 0.35, e.y - r * 0.3);
          ctx.lineTo(e.x, e.y - r * 0.85);
          ctx.lineTo(e.x - r * 0.35, e.y - r * 0.3);
          ctx.lineTo(e.x - r * 1.05, e.y - r * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Luminous Speed Chevron
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(e.x - r * 0.35, e.y - r * 0.1);
          ctx.lineTo(e.x, e.y + r * 0.45);
          ctx.lineTo(e.x + r * 0.35, e.y - r * 0.1);
          ctx.stroke();

        } else if (e.type === 'SHOOTER') {
          // Mobile Artillery (Diamond Chassis + Extended Heavy Cannon)
          ctx.fillStyle = '#1c1917';
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y + r * 0.75);
          ctx.lineTo(e.x + r * 0.95, e.y);
          ctx.lineTo(e.x, e.y - r * 0.9);
          ctx.lineTo(e.x - r * 0.95, e.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Cannon Barrel pointing toward player
          ctx.fillStyle = '#e11d48';
          ctx.fillRect(e.x - 2.5, e.y + r * 0.1, 5, r * 0.85);

          // Targeting laser reticle
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(e.x, e.y, r + 5, elapsed * 3, elapsed * 3 + Math.PI * 1.4);
          ctx.stroke();

        } else if (e.type === 'HEALER_DRONE') {
          // Medical Drone (4 Rotor Pods + Emerald Cross)
          ctx.fillStyle = '#064e3b';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.8;

          // 4 diagonal rotor arms
          const armDist = r * 0.85;
          const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
          angles.forEach(ang => {
            const rx = e.x + Math.cos(ang) * armDist;
            const ry = e.y + Math.sin(ang) * armDist;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(rx, ry);
            ctx.stroke();

            // Spinning Rotor Disc
            ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
            ctx.beginPath();
            ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
            ctx.fill();
          });

          // Center pod
          ctx.fillStyle = '#022c22';
          ctx.beginPath();
          ctx.arc(e.x, e.y, r * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Green Medical Cross
          ctx.fillStyle = '#34d399';
          ctx.fillRect(e.x - 2, e.y - 5.5, 4, 11);
          ctx.fillRect(e.x - 5.5, e.y - 2, 11, 4);

          // Orbiting Repair Motes
          const orbR = r + 7;
          for (let m = 0; m < 2; m++) {
            const orbAng = elapsed * 4.5 + m * Math.PI;
            const ox = e.x + Math.cos(orbAng) * orbR;
            const oy = e.y + Math.sin(orbAng) * orbR;
            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

        } else if (e.type === 'SHIELD_BEARER') {
          // Shield Bulwark (Flared Projector Chassis + Frontal Energy Arc)
          ctx.fillStyle = '#3b0764';
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(e.x - r * 1.0, e.y - r * 0.5);
          ctx.lineTo(e.x + r * 1.0, e.y - r * 0.5);
          ctx.lineTo(e.x + r * 0.7, e.y + r * 0.8);
          ctx.lineTo(e.x - r * 0.7, e.y + r * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Barrier projector emitter bar
          ctx.fillStyle = '#a855f7';
          ctx.fillRect(e.x - r * 0.5, e.y - r * 0.1, r, 4);

          // Forcefield Arc
          ctx.strokeStyle = 'rgba(192, 132, 252, 0.75)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y + 2, r + 6, Math.PI * 0.1, Math.PI * 0.9);
          ctx.stroke();

        } else if (e.armored) {
          // Armored Brute (Chamfered Heavy Octagon + Hazard Pauldrons)
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.5;
          const k = 0.42;
          ctx.beginPath();
          ctx.moveTo(e.x + r * k, e.y + r);
          ctx.lineTo(e.x + r, e.y + r * k);
          ctx.lineTo(e.x + r, e.y - r * k);
          ctx.lineTo(e.x + r * k, e.y - r);
          ctx.lineTo(e.x - r * k, e.y - r);
          ctx.lineTo(e.x - r, e.y - r * k);
          ctx.lineTo(e.x - r, e.y + r * k);
          ctx.lineTo(e.x - r * k, e.y + r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Inner reinforced armor plate
          ctx.fillStyle = '#334155';
          ctx.fillRect(e.x - r * 0.4, e.y - r * 0.4, r * 0.8, r * 0.8);
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(e.x - r * 0.4, e.y - r * 0.4, r * 0.8, r * 0.8);

        } else {
          // Grunt: Crimson Recon Drone (Angular Wedge Chassis + Sensor Visor)
          ctx.fillStyle = '#7f1d1d';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y + r * 1.05);
          ctx.lineTo(e.x + r * 0.85, e.y - r * 0.4);
          ctx.lineTo(e.x + r * 0.45, e.y - r * 0.85);
          ctx.lineTo(e.x - r * 0.45, e.y - r * 0.85);
          ctx.lineTo(e.x - r * 0.85, e.y - r * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Sensor Visor Eye
          ctx.fillStyle = '#1c1917';
          ctx.fillRect(e.x - r * 0.35, e.y - r * 0.15, r * 0.7, r * 0.3);
          ctx.fillStyle = '#f87171';
          ctx.fillRect(e.x - r * 0.2, e.y - r * 0.05, r * 0.4, r * 0.15);
        }

        // Active Linked Shield Effect
        if (e.shielded) {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, r + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // High-Contrast Crisp HP Text Badge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        const hpStr = `${Math.ceil(Math.max(0, e.hp))}`;
        const textW = ctx.measureText ? Math.max(16, ctx.measureText(hpStr).width + 6) : 18;
        ctx.fillRect(e.x - textW / 2, e.y - 7, textW, 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(hpStr, e.x, e.y + 3.5);
      }

      // Ballistic Hit Flash Overlay
      if (e.hitFlash > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = Math.min(0.85, e.hitFlash * 0.9);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      ctx.restore();
    });

    // 8. Render Enemy Artillery Reticles & Mortar Shells
    enemyMortars.forEach(m => {
      // Red Warning Reticle on Defense Line
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.targetX, ch * 0.78 + 18, 16 + Math.sin(elapsed * 12) * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Descending Shell
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 9. Render Player Bullets with Luminous Trails
    bullets.forEach(b => {
      if (!b.active) return;
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Motion Trail
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.radius * 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
      ctx.restore();
    });

    // 10. Elevated Defense Line & Thumb Control Track
    const squadY = ch * 0.78;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(roadMargin, squadY + 18);
    ctx.lineTo(cw - roadMargin, squadY + 18);
    ctx.stroke();

    const trackTop = squadY + 46;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.fillRect(roadMargin, trackTop, cw - roadMargin * 2, ch - trackTop);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.20)';
    ctx.strokeRect(roadMargin, trackTop, cw - roadMargin * 2, ch - trackTop);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.font = '800 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ SLIDE THUMB HERE TO NAVIGATE ⚡', cw / 2, trackTop + 24);

    // Soft Directional Ground Glow beneath Squad
    const squadSpan = Math.min(84, 24 + Math.sqrt(player.count) * 6);
    const squadGrad = ctx.createRadialGradient(player.x, squadY + 6, 4, player.x, squadY + 6, squadSpan);
    squadGrad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
    squadGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = squadGrad;
    ctx.beginPath();
    ctx.ellipse(player.x, squadY + 6, squadSpan, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 11. Render Dynamic Squad Cluster & Specialists (Phase 3)
    player.members.forEach(m => {
      const mx = player.x + m.relX;
      const my = player.y + m.relY;

      ctx.save();
      ctx.fillStyle = m.color;

      if (m.type === 'SNIPER') {
        // Cyan Diamond
        ctx.beginPath();
        ctx.moveTo(mx, my - 5);
        ctx.lineTo(mx + 4, my);
        ctx.lineTo(mx, my + 5);
        ctx.lineTo(mx - 4, my);
        ctx.closePath();
        ctx.fill();

        // Forward laser sighting tick
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, my - 5);
        ctx.lineTo(mx, my - 13);
        ctx.stroke();
      } else if (m.type === 'VANGUARD') {
        // Orange Chevron
        ctx.beginPath();
        ctx.moveTo(mx - 4, my + 4);
        ctx.lineTo(mx, my - 4);
        ctx.lineTo(mx + 4, my + 4);
        ctx.closePath();
        ctx.fill();

        // Dual micro-flame nozzles
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(mx - 2, my - 4); ctx.lineTo(mx - 2, my - 8);
        ctx.moveTo(mx + 2, my - 4); ctx.lineTo(mx + 2, my - 8);
        ctx.stroke();
      } else if (m.type === 'MORTAR') {
        // Yellow Ring Orb
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Yellow Targeting Beacon
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, my - 4);
        ctx.lineTo(mx, my - 9);
        ctx.stroke();
      } else {
        // Standard Soldier
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Squad Shield Aura
    if (player.shields > 0) {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 28, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Floating Squad Count Badge
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    const badgeW = 48;
    const badgeH = 20;
    ctx.beginPath();
    ctx.roundRect(player.x - badgeW / 2, player.y - 28, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${player.count}`, player.x, player.y - 14);

    // 12. Velocity-Stretched Impact Sparks
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.isSpark) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.radius * p.alpha;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 13. Expanding Additive Shockwaves
    shockwaves.forEach(sw => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.lineWidth * sw.alpha;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 14. Floating Combat Texts
    floatTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = `900 ${ft.fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();
  }
}
