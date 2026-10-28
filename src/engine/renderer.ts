// 60FPS High-Performance HTML5 2D Canvas Renderer for Squad Surge
import { 
  PlayerState, 
  Gate, 
  FieldObstacle, 
  Enemy, 
  Bullet, 
  Particle, 
  FloatingText,
  BiomeConfig 
} from '../types/game';

export class GameRenderer {
  public static render(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    biome: BiomeConfig,
    scrollOffset: number,
    player: PlayerState,
    gates: Gate[],
    obstacles: FieldObstacle[],
    enemies: Enemy[],
    bullets: Bullet[],
    particles: Particle[],
    floatTexts: FloatingText[]
  ): void {
    ctx.clearRect(0, 0, cw, ch);

    // 1. Background Highway & Biome Ambience
    ctx.fillStyle = biome.roadColor;
    ctx.fillRect(0, 0, cw, ch);

    // Subtle background radial gradient glow
    const glowGrad = ctx.createRadialGradient(cw / 2, ch / 2, 40, cw / 2, ch / 2, cw * 0.9);
    glowGrad.addColorStop(0, biome.bgGlow);
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, cw, ch);

    // Highway Lane Dividers (Parallax Scrolling)
    ctx.strokeStyle = biome.laneLineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 24]);
    ctx.lineDashOffset = -scrollOffset % 44;

    ctx.beginPath();
    ctx.moveTo(cw / 2, 0);
    ctx.lineTo(cw / 2, ch);
    ctx.stroke();

    ctx.setLineDash([]);
    // Edge highway curbs
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 0, cw - 4, ch);

    // 2. Render Field Obstacles (Phase 1)
    obstacles.forEach(obs => {
      if (!obs.active) return;

      if (obs.type === 'SPEED_STRIP' || obs.type === 'HAZARD_STRIP') {
        const isSpeed = obs.type === 'SPEED_STRIP';
        ctx.fillStyle = isSpeed ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)';
        ctx.strokeStyle = isSpeed ? '#0284c7' : '#b91c1c';
        ctx.lineWidth = 1.5;
        const rx = obs.x - obs.width / 2;
        const ry = obs.y - obs.height / 2;
        ctx.fillRect(rx, ry, obs.width, obs.height);
        ctx.strokeRect(rx, ry, obs.width, obs.height);

        // Strip chevron arrows
        ctx.fillStyle = isSpeed ? '#38bdf8' : '#ef4444';
        ctx.font = '900 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isSpeed ? '⚡ OVERCLOCK +50%' : '⚠️ HAZARD SLOW', obs.x, obs.y + 4);
      } else if (obs.type === 'PRISM_MIRROR') {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate((obs.angleDeg * Math.PI) / 180);

        // Angled metallic bumper
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#f59e0b'; // Amber neon
        ctx.lineWidth = 3;
        ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);

        // Center mirror prism line
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -obs.height / 2 + 6);
        ctx.lineTo(0, obs.height / 2 - 6);
        ctx.stroke();

        ctx.restore();
      }
    });

    // 3. Render Gates (Math, Altar, Quantum)
    gates.forEach(g => {
      if (!g.isUnlocked || g.isConsumed) return;

      const rx = g.x - g.width / 2;
      const ry = g.y - g.height / 2;

      ctx.save();

      if (g.type === 'ALTAR') {
        // Sacrifice / Conversion Altar (Phase 1)
        ctx.fillStyle = 'rgba(88, 28, 135, 0.85)';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(rx, ry, g.width, g.height, 12);
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
        ctx.fillText(g.altarWeaponReward === 'laserWeapon' ? 'REWARD: PIERCING LASER' : 'REWARD: HOMING MISSILES', g.x, ry + 50);

      } else {
        // Math / Quantum Gate
        const isQuantum = g.type === 'QUANTUM';
        const isPositive = g.op === '+' ? g.val >= 0 : g.val >= 1;
        const gateColor = isPositive ? 'rgba(14, 165, 233, 0.2)' : 'rgba(244, 63, 94, 0.2)';
        const borderColor = isPositive ? '#38bdf8' : '#f43f5e';

        ctx.fillStyle = gateColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(rx, ry, g.width, g.height, 10);
        ctx.fill();
        ctx.stroke();

        // Main gate text
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const opStr = g.op === '+' ? `+${g.val}` : `x${g.val}`;
        ctx.fillText(opStr, g.x, ry + 26);

        // Multi-hit charge bar
        if (g.maxVal > 0) {
          const barW = g.width - 24;
          const barH = 5;
          const fillW = Math.max(0, Math.min(barW, (g.chargeHits / g.hitsPerStep) * barW));
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(g.x - barW / 2, ry + 34, barW, barH);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(g.x - barW / 2, ry + 34, fillW, barH);

          // Cap label
          ctx.fillStyle = '#94a3b8';
          ctx.font = '700 8px Inter, sans-serif';
          ctx.fillText(`MAX +${g.maxVal}`, g.x, ry + 46);
        }

        // Locked Gate Shield Plate
        if (g.lockHp > 0) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fillRect(rx, ry, g.width, g.height);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.strokeRect(rx, ry, g.width, g.height);

          ctx.fillStyle = '#e2e8f0';
          ctx.font = '800 11px Inter, sans-serif';
          ctx.fillText(`🛡️ SHIELD: ${g.lockHp}`, g.x, ry + 30);
        }
      }

      ctx.restore();
    });

    // 4. Render Shield Links from Shield Bearers (Phase 2 Synergy)
    enemies.forEach(e => {
      if (e.active && e.shielded && e.shieldSourceId) {
        const source = enemies.find(s => s.id === e.shieldSourceId && s.active);
        if (source) {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.65)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    // 5. Render Enemies & Bosses (Phase 2)
    enemies.forEach(e => {
      if (!e.active) return;

      const rx = e.x - e.width / 2;
      const ry = e.y - e.height / 2;

      ctx.save();

      // Slowed cryo effect
      if (e.isSlowed) {
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 10;
      }

      if (e.isBoss) {
        // Multi-Phase Boss (Warden or Titan)
        ctx.fillStyle = e.enraged ? '#7f1d1d' : '#1e1b4b';
        ctx.strokeStyle = e.enraged ? '#ef4444' : '#6366f1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(rx, ry, e.width, e.height, 14);
        ctx.fill();
        ctx.stroke();

        // Left & Right Breakable Armor Plates
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

              // Plate mini HP bar
              const pRatio = Math.max(0, plate.hp / plate.maxHp);
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(px, py - 4, plate.w * pRatio, 3);
            }
          });
        }

        // Boss Label & Icon
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.type === 'TITAN_BOSS' ? 'TITAN' : 'WARDEN', e.x, e.y - 2);

        // Core Boss HP Bar
        const barW = e.width * 1.2;
        const barH = 7;
        const fillW = Math.max(0, (e.hp / e.maxHp) * barW);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(e.x - barW / 2, ry - 14, barW, barH);
        ctx.fillStyle = e.enraged ? '#ef4444' : '#38bdf8';
        ctx.fillRect(e.x - barW / 2, ry - 14, fillW, barH);

      } else {
        // Standard Enemy Types
        let enemyColor = '#ef4444';
        let enemyIcon = '👾';

        if (e.type === 'SPRINTER') {
          enemyColor = '#f59e0b';
          enemyIcon = '⚡';
        } else if (e.type === 'ARMORED_BRUTE') {
          enemyColor = '#64748b';
          enemyIcon = '🛡️';
        } else if (e.type === 'SHIELD_BEARER') {
          enemyColor = '#a855f7';
          enemyIcon = '🔗';
        } else if (e.type === 'HEALER_DRONE') {
          enemyColor = '#10b981';
          enemyIcon = '🛸';
        } else if (e.type === 'ARTILLERY') {
          enemyColor = '#ec4899';
          enemyIcon = '🎯';
        } else if (e.type === 'EXPLOSIVE_MINE') {
          enemyColor = '#dc2626';
          enemyIcon = '💣';
        }

        ctx.fillStyle = enemyColor;
        ctx.beginPath();
        ctx.roundRect(rx, ry, e.width, e.height, 6);
        ctx.fill();

        if (e.shielded) {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 3;
          ctx.strokeRect(rx - 2, ry - 2, e.width + 4, e.height + 4);
        }

        // Icon
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(enemyIcon, e.x, e.y + 4);

        // HP number
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.fillText(`${e.hp}`, e.x, ry - 4);
      }

      ctx.restore();
    });

    // 6. Render Bullets & Projectiles
    bullets.forEach(b => {
      if (!b.active) return;

      ctx.save();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Laser or Railgun trail
      if (b.isLaser || b.isPierce) {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.radius * 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x, b.y + 24);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 7. Raised Defense Line (H - 108) & Thumb Control Track
    const defenseY = ch - 108;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, defenseY);
    ctx.lineTo(cw, defenseY);
    ctx.stroke();

    // Thumb Track Area Indicator underneath defense line
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.fillRect(0, defenseY, cw, 108);

    // 8. Render Dynamic Squad Formation & Specialist Units (Phase 3)
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
      } else if (m.type === 'VANGUARD') {
        // Orange Chevron
        ctx.beginPath();
        ctx.moveTo(mx - 4, my + 4);
        ctx.lineTo(mx, my - 4);
        ctx.lineTo(mx + 4, my + 4);
        ctx.closePath();
        ctx.fill();
      } else if (m.type === 'MORTAR') {
        // Yellow Ring Orb
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // Standard Soldier (Sky Blue circle)
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

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

    // 9. Particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 10. Floating Combat Texts
    floatTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = `900 ${ft.fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }
}
