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
    floatTexts: FloatingText[],
    dualThumbBannerTimer: number = 0,
    isBossArenaActive: boolean = false,
    arenaBoss: Enemy | null = null
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

    // Highway Edge Rails (with glowing red hazard strobes during boss standoff arena)
    if (isBossArenaActive) {
      const strobePulse = 0.55 + 0.45 * Math.sin(elapsed * 12);
      ctx.strokeStyle = `rgba(239, 68, 68, ${strobePulse})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(roadMargin, 0); ctx.lineTo(roadMargin, ch);
      ctx.moveTo(cw - roadMargin, 0); ctx.lineTo(cw - roadMargin, ch);
      ctx.stroke();
    } else {
      ctx.strokeStyle = biome.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(roadMargin, 0); ctx.lineTo(roadMargin, ch);
      ctx.moveTo(cw - roadMargin, 0); ctx.lineTo(cw - roadMargin, ch);
      ctx.stroke();
    }

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
      } else if (obs.type === 'BEAM_SPLITTER') {
        ctx.save();
        const hw = (obs.width || 42) / 2;
        const hh = (obs.height || 42) / 2;

        // Clean diamond bumper (matches wall prism styling, zero visual overload)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - hh);
        ctx.lineTo(obs.x + hw, obs.y);
        ctx.lineTo(obs.x, obs.y + hh);
        ctx.lineTo(obs.x - hw, obs.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Bottom reflective mirror bevel face (facing player fire)
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(obs.x - hw, obs.y);
        ctx.lineTo(obs.x, obs.y + hh);
        ctx.lineTo(obs.x + hw, obs.y);
        ctx.stroke();

        // Center split line
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - hh);
        ctx.lineTo(obs.x, obs.y + hh);
        ctx.stroke();

        // Crisp compact label
        ctx.fillStyle = '#38bdf8';
        ctx.font = '800 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('RICOCHET', obs.x, obs.y - hh - 4);

        ctx.restore();
      }
    });

    // 4. Render Gates with Elastic Spring Hit Feedback & Auto-Fitted Text
    gates.forEach(g => {
      ctx.save();
      const spring = g.hitScale || 0;
      const w = g.w * (1.0 + spring * 0.08);
      const h = g.h * (1.0 + spring * 0.08);
      const rx = g.x - w / 2;
      const ry = g.y - h / 2;

      // Dynamic text fitting & auto-clamping routine ensuring no text ever spills outside gate boxes
      const drawFittedText = (
        text: string,
        centerX: number,
        centerY: number,
        maxWidth: number,
        baseSize: number,
        minSize: number = 7.5,
        weight: string | number = 900,
        fontFamily: string = 'Inter, sans-serif'
      ) => {
        let size = baseSize;
        ctx.font = `${weight} ${size}px ${fontFamily}`;
        let measured = ctx.measureText(text).width;
        if (measured > maxWidth) {
          size = Math.max(minSize, Math.floor(baseSize * (maxWidth / measured)));
          ctx.font = `${weight} ${size}px ${fontFamily}`;
          measured = ctx.measureText(text).width;
        }
        let finalText = text;
        if (measured > maxWidth) {
          while (finalText.length > 2 && ctx.measureText(`${finalText}…`).width > maxWidth) {
            finalText = finalText.slice(0, -1);
          }
          finalText = `${finalText}…`;
        }
        ctx.fillText(finalText, centerX, centerY);
      };

      if (g.kind === 'ALTAR') {
        // Sacrifice Altar (Can be shot to purify and reduce troop cost down to 0)
        const isFree = (g.altarSacrificeCost ?? 0) <= 0;
        ctx.fillStyle = isFree ? 'rgba(16, 185, 129, 0.28)' : 'rgba(88, 28, 135, 0.90)';
        ctx.strokeStyle = isFree ? '#10b981' : '#c084fc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isFree ? '#34d399' : '#e9d5ff';
        ctx.textAlign = 'center';
        drawFittedText(isFree ? '⚡ PURIFIED SHRINE' : '🔮 SACRIFICE ALTAR', g.x, ry + 18, w - 16, 11, 8, 800);

        ctx.fillStyle = isFree ? '#34d399' : '#f43f5e';
        drawFittedText(isFree ? '0 SQUAD (FREE)' : `-${g.altarSacrificeCost} SQUAD`, g.x, ry + 34, w - 16, 13, 9, 900, '"JetBrains Mono", monospace');

        ctx.fillStyle = '#fbbf24';
        const rewardStr = g.altarWeaponReward === 'laserWeapon' ? 'REWARD: LASER' : 'REWARD: MISSILES';
        drawFittedText(rewardStr, g.x, ry + 46, w - 16, 8.5, 7, 700);
      } else if (g.kind === 'LOCKED_MULT' || g.kind === 'BUFF_GATE') {
        // Locked Mult or Buff Gate (Cryo, AP, Blast, Fire Rate, Dual Squad)
        ctx.fillStyle = g.unlocked ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = g.unlocked ? '#10b981' : (g.color || '#fde047');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 10);
        ctx.fill();
        ctx.stroke();

        const hitsLeft = Math.max(0, Math.ceil(g.lockHitsRemaining));
        const rewardName = g.kind === 'LOCKED_MULT'
          ? `x${g.val} SQUAD`
          : (g.label || (g.boostType ? `${g.boostType} BOOST` : 'BOOST'));

        const gateTitle = g.unlocked 
          ? `🔓 ${rewardName}` 
          : `🔒 ${rewardName} (${hitsLeft})`;

        ctx.fillStyle = g.unlocked ? '#34d399' : '#ffffff';
        ctx.textAlign = 'center';
        drawFittedText(gateTitle, g.x, ry + 19, w - 16, 11, 7.5, 900);

        if (!g.unlocked) {
          const barW = w - 24;
          const barH = 5;
          const progress = Math.max(0, 1 - g.lockHitsRemaining / Math.max(1, g.lockHitsMax));
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(g.x - barW / 2, ry + 28, barW, barH);
          ctx.fillStyle = g.color || '#fde047';
          ctx.fillRect(g.x - barW / 2, ry + 28, barW * progress, barH);

          ctx.fillStyle = '#94a3b8';
          drawFittedText(`SHOOT TO CHARGE (${hitsLeft})`, g.x, ry + 42, w - 16, 8.5, 7, 800, '"JetBrains Mono", monospace');
        } else {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(g.x - (w - 24) / 2, ry + 27, w - 24, 4);

          ctx.fillStyle = '#34d399';
          drawFittedText('⚡ PASS TO CLAIM', g.x, ry + 41, w - 16, 10.5, 8, 900, '"JetBrains Mono", monospace');
        }
      } else {
        // Standard Charge Add / Hazard / Quantum Gate
        const isHazard = g.kind === 'HAZARD';
        const isMaxed = isHazard ? g.val >= 0 : (g.maxVal > 0 && g.val >= g.maxVal);
        const isPositive = g.val >= 0;

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

        // Holographic Cyber Scanline
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

        // Center Value Text with auto-clamp
        ctx.fillStyle = isMaxed ? '#34d399' : '#ffffff';
        ctx.textAlign = 'center';
        if (isHazard) {
          drawFittedText(isMaxed ? '0 SAFE' : `${Math.round(g.val)} HAZARD`, g.x, ry + 22, w - 16, 18, 11, 900, '"JetBrains Mono", monospace');
        } else {
          drawFittedText(isMaxed ? `🔓 +${Math.round(g.val)} CLAIMABLE` : `${g.val > 0 ? '+' : ''}${Math.round(g.val)}`, g.x, ry + 22, w - 16, 18, 11, 900, '"JetBrains Mono", monospace');
        }

        // Charge Progress Bar (Smoothly handles negative starts and hazards)
        const barW = w - 24;
        const barH = 5;
        const minVal = g.minVal !== undefined ? g.minVal : (g.val < 0 ? g.val : 0);
        const targetVal = isHazard ? 0 : g.maxVal;
        const span = Math.max(1, targetVal - minVal);
        let chargeRatio = 0;
        if (isMaxed) {
          chargeRatio = 1.0;
        } else if (span > 0) {
          const current = (g.val - minVal) + (g.chargeHits / Math.max(1, g.hitsPerStep));
          chargeRatio = Math.max(0, Math.min(1.0, current / span));
        }

        const fillW = Math.max(0, Math.min(barW, barW * chargeRatio));

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(g.x - barW / 2, ry + 31, barW, barH);

        if (isMaxed) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(g.x - barW / 2, ry + 31, barW, barH);

          ctx.fillStyle = '#34d399';
          ctx.font = '800 8.5px Inter, sans-serif';
          ctx.fillText(isHazard ? '⚡ HAZARD NEUTRALIZED (SAFE)' : `⚡ CLAIM +${g.maxVal} TROOPS (READY)`, g.x, ry + 43);
        } else {
          ctx.fillStyle = isPositive ? '#38bdf8' : '#f43f5e';
          ctx.fillRect(g.x - barW / 2, ry + 31, fillW, barH);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '700 8px Inter, sans-serif';
          ctx.fillText(isHazard ? `SHOOT TO NEUTRALIZE (${Math.round(g.val)} -> 0)` : `SHOOT TO MAX (+${g.maxVal})`, g.x, ry + 43);
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

        // Render Boss Tactical Guard Barriers / Deflector Mini-Walls
        if (e.guardShields) {
          e.guardShields.forEach(shield => {
            if (!shield.broken) {
              const sx = e.x + shield.relX;
              const sy = e.y + shield.relY;
              const rx = sx - shield.w / 2;
              const ry = sy - shield.h / 2;

              ctx.save();
              ctx.shadowColor = '#06b6d4';
              ctx.shadowBlur = 8;
              ctx.fillStyle = 'rgba(6, 182, 212, 0.28)';
              ctx.strokeStyle = '#22d3ee';
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.roundRect(rx, ry, shield.w, shield.h, 4);
              ctx.fill();
              ctx.stroke();

              // Hex energy deflector chevron
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(rx + 4, sy);
              ctx.lineTo(sx, ry + 2);
              ctx.lineTo(rx + shield.w - 4, sy);
              ctx.stroke();

              // Shield mini health bar
              const shpRatio = Math.max(0, shield.hp / shield.maxHp);
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(rx, ry - 4, shield.w, 3);
              ctx.fillStyle = '#38bdf8';
              ctx.fillRect(rx, ry - 4, shield.w * shpRatio, 3);

              ctx.restore();
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

    const trackTop = squadY + 36;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.90)';
    ctx.fillRect(roadMargin, trackTop, cw - roadMargin * 2, ch - trackTop);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.strokeRect(roadMargin, trackTop, cw - roadMargin * 2, ch - trackTop);

    const isSplit = (player.buffs.splitSquadTimer ?? 0) > 0;
    const leftX = player.leftWingX ?? (player.x - 60);
    const rightX = player.rightWingX ?? (player.x + 60);

    if (isSplit) {
      // Dual-Thumb Navigation Track
      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👈 LEFT THUMB', cw * 0.25, trackTop + 24);
      ctx.fillText('RIGHT THUMB 👉', cw * 0.75, trackTop + 24);

      // Electric Energy Tether connecting Dual Wings
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(leftX, squadY);
      ctx.lineTo(rightX, squadY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dynamic animated electrical arc
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const midX = (leftX + rightX) / 2;
      const arcOffset = Math.sin(Date.now() * 0.012) * 7;
      ctx.moveTo(leftX, squadY);
      ctx.quadraticCurveTo(midX, squadY + arcOffset, rightX, squadY);
      ctx.stroke();

      // Soft directional glow under both wings
      [leftX, rightX].forEach(wx => {
        const wingGrad = ctx.createRadialGradient(wx, squadY + 6, 2, wx, squadY + 6, 42);
        wingGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
        wingGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = wingGrad;
        ctx.beginPath();
        ctx.ellipse(wx, squadY + 6, 42, 13, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render members partitioned between Left and Right wings
      const halfCount = Math.ceil(player.members.length / 2);
      player.members.forEach((m, idx) => {
        const atLeft = idx < halfCount;
        const wx = atLeft ? leftX : rightX;
        const mx = wx + m.relX * 0.75;
        const my = player.y + m.relY * 0.75;

        ctx.fillStyle = m.color;
        if (m.type === 'SNIPER') {
          ctx.beginPath();
          ctx.moveTo(mx, my - 5);
          ctx.lineTo(mx + 4, my);
          ctx.lineTo(mx, my + 5);
          ctx.lineTo(mx - 4, my);
          ctx.closePath();
          ctx.fill();
        } else if (m.type === 'VANGUARD') {
          ctx.beginPath();
          ctx.moveTo(mx - 4, my + 4);
          ctx.lineTo(mx, my - 4);
          ctx.lineTo(mx + 4, my + 4);
          ctx.closePath();
          ctx.fill();
        } else if (m.type === 'MORTAR') {
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(mx, my, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Wing Count Badges
      const leftTroopCount = Math.ceil(player.count / 2);
      const rightTroopCount = Math.max(1, Math.floor(player.count / 2));
      [
        { x: leftX, count: leftTroopCount, label: 'L' },
        { x: rightX, count: rightTroopCount, label: 'R' }
      ].forEach(w => {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(w.x - 22, player.y - 28, 44, 18, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '900 10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${w.label}:${w.count}`, w.x, player.y - 15);
      });

      // Top Center Dual-Thumb Countdown Badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      const timerW = 160;
      ctx.beginPath();
      ctx.roundRect(cw / 2 - timerW / 2, player.y - 58, timerW, 22, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`⚡ DUAL-THUMB: ${player.buffs.splitSquadTimer.toFixed(1)}s`, cw / 2, player.y - 43);

      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.font = '900 10.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👇 SLIDE THUMB HERE (CREW VISIBLE ABOVE) 👇', cw / 2, trackTop + 24);

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

      // Floating Squad Count Badge (Elevated safely above thumb touch range)
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      const badgeW = 52;
      const badgeH = 22;
      ctx.beginPath();
      ctx.roundRect(player.x - badgeW / 2, player.y - 44, badgeW, badgeH, 6);
      ctx.fill();
      ctx.stroke();

      // Downward pointer to squad leader
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(player.x - 5, player.y - 22);
      ctx.lineTo(player.x, player.y - 16);
      ctx.lineTo(player.x + 5, player.y - 22);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 12.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${player.count}`, player.x, player.y - 28);
    }

    // Squad Shield Aura
    if (player.shields > 0) {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 28, 0, Math.PI * 2);
      ctx.stroke();
    }

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

    // 15. In-Combat Head-Up Squad Counter Chip (Never covered by hands/thumbs)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    const hudW = player.shields > 0 ? 128 : 94;
    ctx.beginPath();
    ctx.roundRect(14, 14, hudW, 26, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 11.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`👥 ${player.count}`, 22, 31);
    if (player.shields > 0) {
      ctx.fillStyle = '#c084fc';
      ctx.fillText(`🛡️ ${player.shields}`, 80, 31);
    }
    ctx.restore();

    // 16. Dual-Thumb Activation Banner
    if (dualThumbBannerTimer > 0) {
      ctx.save();
      const bannerAlpha = Math.min(1.0, dualThumbBannerTimer * 2.5);
      ctx.globalAlpha = bannerAlpha;

      const bannerW = Math.min(340, cw - 32);
      const bannerH = 54;
      const bannerY = ch * 0.20;
      const bannerX = cw / 2 - bannerW / 2;

      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(8, 14, 28, 0.96)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ DUAL THUMB HAS SPLIT! ⚡', cw / 2, bannerY + 22);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '700 10.5px Inter, sans-serif';
      ctx.fillText('Use Left & Right thumbs together to steer both wings', cw / 2, bannerY + 40);

      ctx.restore();
    }

    // 17. Boss Arena Standoff Header HUD
    if (isBossArenaActive && arenaBoss && arenaBoss.active) {
      ctx.save();
      const isEnraged = arenaBoss.enraged || (arenaBoss.hp < arenaBoss.maxHp * 0.45);
      const isTitan = arenaBoss.type === 'TITAN';
      const headerW = Math.min(340, cw - 36);
      const headerH = 46;
      const headerY = 16;
      const headerX = cw / 2 - headerW / 2;

      ctx.shadowColor = isEnraged ? '#ef4444' : '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(10, 15, 30, 0.94)';
      ctx.strokeStyle = isEnraged ? '#ef4444' : (isTitan ? '#f59e0b' : '#38bdf8');
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(headerX, headerY, headerW, headerH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = isEnraged ? '#ef4444' : '#f8fafc';
      ctx.font = '900 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      const bossTitle = isEnraged 
        ? `🔥 PHASE 2: ${arenaBoss.name || 'TITAN'} [ENRAGED]` 
        : `☠️ STANDOFF: ${arenaBoss.name || (isTitan ? 'TITAN DREADNOUGHT' : 'WARDEN')}`;
      ctx.fillText(bossTitle, cw / 2, headerY + 16);

      // Boss Health Bar
      const barW = headerW - 24;
      const barH = 7;
      const barX = cw / 2 - barW / 2;
      const barY = headerY + 24;
      const fillW = Math.max(0, Math.min(barW, (arenaBoss.hp / arenaBoss.maxHp) * barW));

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(barX, barY, barW, barH);

      ctx.fillStyle = isEnraged ? '#ef4444' : (isTitan ? '#f59e0b' : '#38bdf8');
      ctx.fillRect(barX, barY, fillW, barH);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      // Health text
      ctx.fillStyle = '#94a3b8';
      ctx.font = '800 8.5px "JetBrains Mono", monospace';
      const pct = Math.round((arenaBoss.hp / arenaBoss.maxHp) * 100);
      ctx.fillText(`${Math.ceil(arenaBoss.hp)} / ${arenaBoss.maxHp} HP (${pct}%)`, cw / 2, barY + 16);

      ctx.restore();
    }

    ctx.restore();
  }
}
