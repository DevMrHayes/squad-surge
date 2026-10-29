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
        ctx.translate(obs.x, obs.y);
        ctx.rotate((obs.angleDeg * Math.PI) / 180);

        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -obs.height / 2 + 6);
        ctx.lineTo(0, obs.height / 2 - 6);
        ctx.stroke();

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
        // Twin engine fiery thruster contrails
        const thrusterOffset = e.r * 0.55;
        const flameLen = 14 + Math.sin(elapsed * 24) * 6;
        ctx.fillStyle = e.enraged ? '#ef4444' : '#f97316';
        ctx.beginPath();
        ctx.moveTo(e.x - thrusterOffset - 4, e.y - e.r);
        ctx.lineTo(e.x - thrusterOffset, e.y - e.r - flameLen);
        ctx.lineTo(e.x - thrusterOffset + 4, e.y - e.r);
        ctx.moveTo(e.x + thrusterOffset - 4, e.y - e.r);
        ctx.lineTo(e.x + thrusterOffset, e.y - e.r - flameLen);
        ctx.lineTo(e.x + thrusterOffset + 4, e.y - e.r);
        ctx.fill();

        // Boss Body
        ctx.fillStyle = e.enraged ? '#7f1d1d' : '#1e1b4b';
        ctx.strokeStyle = e.enraged ? '#ef4444' : '#6366f1';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pulsing core reactor
        ctx.strokeStyle = e.enraged ? '#fca5a5' : '#818cf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 0.45, 0, Math.PI * 2);
        ctx.stroke();

        // Breakable Armor Plates
        if (e.armorPlates) {
          e.armorPlates.forEach(plate => {
            if (!plate.broken) {
              const px = e.x + plate.relX - plate.w / 2;
              const py = e.y + plate.relY - plate.h / 2;
              ctx.fillStyle = '#475569';
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2;
              ctx.fillRect(px, py, plate.w, plate.h);
              ctx.strokeRect(px, py, plate.w, plate.h);
            }
          });
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.name || (e.type === 'TITAN' ? 'TITAN' : 'WARDEN'), e.x, e.y - 2);

        // Core Boss HP Bar
        const barW = e.r * 2.4;
        const barH = 7;
        const fillW = Math.max(0, (e.hp / e.maxHp) * barW);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(e.x - barW / 2, e.y - e.r - 16, barW, barH);
        ctx.fillStyle = e.enraged ? '#ef4444' : '#38bdf8';
        ctx.fillRect(e.x - barW / 2, e.y - e.r - 16, fillW, barH);

      } else {
        // Sprinter Lightning Trail
        if (e.type === 'SPRINTER') {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - e.r);
          ctx.lineTo(e.x - 3 + Math.sin(elapsed * 25) * 3, e.y - e.r - 8);
          ctx.lineTo(e.x + 3, e.y - e.r - 14);
          ctx.lineTo(e.x - 2, e.y - e.r - 20);
          ctx.stroke();
        }

        // Armored Brute Hexagonal Lattice Outline
        if (e.armored) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let a = 0; a < 6; a++) {
            const ang = (a * Math.PI) / 3;
            const hx = e.x + Math.cos(ang) * (e.r + 2);
            const hy = e.y + Math.sin(ang) * (e.r + 2);
            if (a === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
        }

        // Standard Enemy Body
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();

        // Healer Drone Orbital Motes
        if (e.type === 'HEALER_DRONE') {
          const orbR = e.r + 7;
          for (let m = 0; m < 2; m++) {
            const orbAng = elapsed * 4.5 + m * Math.PI;
            const ox = e.x + Math.cos(orbAng) * orbR;
            const oy = e.y + Math.sin(orbAng) * orbR;
            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Artillery Shooters Rotating Crosshair Reticle
        if (e.type === 'SHOOTER') {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 5, elapsed * 2, elapsed * 2 + Math.PI * 1.5);
          ctx.stroke();
        }

        if (e.shielded) {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(Math.max(0, e.hp))}`, e.x, e.y + 4);
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
