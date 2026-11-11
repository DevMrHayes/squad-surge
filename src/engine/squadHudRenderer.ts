// Modular Squad Rail HUD, Mortar Telegraphs & Gear Rank Visual Trim Helpers
import { EnemyMortarShell, PlayerState } from '../types/game';

export interface SoldierGearTrim {
  rimColor: string;
  glowColor: string;
  rankTier: number;
}

export function getSoldierGearTrim(player: PlayerState, isOverdrive: boolean): SoldierGearTrim {
  if (isOverdrive) {
    return {
      rimColor: '#fef08a',
      glowColor: 'rgba(250, 204, 21, 0.35)',
      rankTier: 5,
    };
  }
  const rank = player.gearRank || 1;
  if (rank >= 20) {
    return { rimColor: '#fbbf24', glowColor: 'rgba(251, 191, 36, 0.28)', rankTier: 4 };
  }
  if (rank >= 10) {
    return { rimColor: '#c084fc', glowColor: 'rgba(192, 132, 252, 0.25)', rankTier: 3 };
  }
  if (rank >= 5) {
    return { rimColor: '#22d3ee', glowColor: 'rgba(34, 211, 238, 0.22)', rankTier: 2 };
  }
  return { rimColor: '#60a5fa', glowColor: 'rgba(56, 189, 248, 0.18)', rankTier: 1 };
}

export function renderMortarTelegraphs(
  ctx: CanvasRenderingContext2D,
  enemyMortars: EnemyMortarShell[],
  squadY: number,
  elapsed: number
): void {
  enemyMortars.forEach(m => {
    ctx.save();
    const outerR = 18 + Math.sin(elapsed * 14) * 2;
    const progress = Math.min(1.0, Math.max(0.12, m.y / Math.max(120, squadY)));

    // Red Warning Outer Ring centered accurately on Defense Line (squadY)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.targetX, squadY, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // Expanding Inner Proximity Fill showing imminent impact timing
    ctx.fillStyle = `rgba(239, 68, 68, ${0.18 + progress * 0.28})`;
    ctx.beginPath();
    ctx.arc(m.targetX, squadY, outerR * progress, 0, Math.PI * 2);
    ctx.fill();

    // Crisp Crosshair Ticks
    ctx.strokeStyle = 'rgba(254, 202, 202, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(m.targetX - outerR - 3, squadY);
    ctx.lineTo(m.targetX - outerR + 4, squadY);
    ctx.moveTo(m.targetX + outerR - 4, squadY);
    ctx.lineTo(m.targetX + outerR + 3, squadY);
    ctx.stroke();

    // Descending Shell Projectile
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  });
}

export function renderSquadRailHud(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  cw: number,
  roadMargin: number,
  squadY: number,
  trackTop: number
): void {
  ctx.save();

  const barW = cw - roadMargin * 2 - 12;
  const barX = roadMargin + 6;
  const barY = squadY + 20;
  const barH = 4;

  const isOverdrive = (player.overdriveTimer || 0) > 0;
  const ratio = isOverdrive
    ? Math.max(0, Math.min(1, (player.overdriveTimer || 0) / 4.0))
    : Math.max(0, Math.min(1, (player.overdriveCharge || 0) / 100));

  // Sleek Surge Overdrive Rail Progress Bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 2);
  ctx.fill();

  if (ratio > 0.01) {
    ctx.fillStyle = isOverdrive ? '#fbbf24' : '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * ratio, barH, 2);
    ctx.fill();
  }

  // Compact Active Buff Micro-Pills cleanly anchored just above the Thumb Track
  const activePills: { label: string; color: string; bg: string }[] = [];
  if (isOverdrive) {
    activePills.push({
      label: `⚡SURGE ${(player.overdriveTimer || 0).toFixed(1)}s`,
      color: '#fef08a',
      bg: 'rgba(161, 98, 7, 0.88)',
    });
  }
  if (player.buffs.apTimer > 0) {
    activePills.push({
      label: `⚡AP ${player.buffs.apTimer.toFixed(1)}s`,
      color: '#fde047',
      bg: 'rgba(30, 41, 59, 0.90)',
    });
  }
  if (player.buffs.cryoTimer > 0) {
    activePills.push({
      label: `❄️ ${player.buffs.cryoTimer.toFixed(1)}s`,
      color: '#67e8f9',
      bg: 'rgba(22, 78, 99, 0.85)',
    });
  }
  if (player.buffs.rapidTimer > 0) {
    activePills.push({
      label: `🔥 ${player.buffs.rapidTimer.toFixed(1)}s`,
      color: '#fb923c',
      bg: 'rgba(67, 20, 7, 0.85)',
    });
  }
  if (player.buffs.blastTimer > 0) {
    activePills.push({
      label: `💥 ${player.buffs.blastTimer.toFixed(1)}s`,
      color: '#f43f5e',
      bg: 'rgba(76, 5, 25, 0.85)',
    });
  }

  if (activePills.length > 0) {
    ctx.font = '800 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const pillPadX = 6;
    const pillGap = 5;
    const pillWidths = activePills.map(p => ctx.measureText(p.label).width + pillPadX * 2);
    const totalW = pillWidths.reduce((s, w) => s + w, 0) + pillGap * (activePills.length - 1);
    let cursorX = cw / 2 - totalW / 2;
    const pillY = trackTop - 15;

    activePills.forEach((p, idx) => {
      const pw = pillWidths[idx];
      ctx.fillStyle = p.bg;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cursorX, pillY, pw, 13, 6.5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.fillText(p.label, cursorX + pw / 2, pillY + 9.5);
      cursorX += pw + pillGap;
    });
  }

  ctx.restore();
}
