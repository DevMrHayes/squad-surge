// Squad Surge: Zero-Clutter UI Controller & Modal Management
import { GameLoop } from '../engine/gameLoop';
import { storage } from '../services/storage';
import { ACHIEVEMENTS_CATALOG } from '../constants/biomes';
import { loginWithGoogle, getCurrentUser } from '../config/firebase';
import { sfx } from '../services/audio';

export class UIController {
  private game: GameLoop;

  // HUD Elements
  private uiLevelNum = document.getElementById('uiLevelNum')!;
  private uiEnemiesLeft = document.getElementById('uiEnemiesLeft')!;
  private uiProgressFill = document.getElementById('uiProgressFill')!;
  private uiCoins = document.getElementById('uiCoins')!;
  private btnOpenMap = document.getElementById('btnOpenMap')!;
  private btnPause = document.getElementById('btnPause')!;

  // Modals
  private startOverlay = document.getElementById('startOverlay')!;
  private mapModal = document.getElementById('mapModal')!;
  private pauseModal = document.getElementById('pauseModal')!;
  private resultModal = document.getElementById('resultModal')!;
  private profileModal = document.getElementById('profileModal')!;

  constructor(game: GameLoop) {
    this.game = game;
    this.setupListeners();
    this.updateHUD(game.currentLevel, 0, 0, storage.getSave().coins);
  }

  public updateHUD(level: number, left: number, total: number, coins: number): void {
    if (this.uiLevelNum) this.uiLevelNum.textContent = `${level}`;
    if (this.uiEnemiesLeft) this.uiEnemiesLeft.textContent = `${left}`;
    if (this.uiCoins) this.uiCoins.textContent = `${coins}`;

    if (this.uiProgressFill && total > 0) {
      const pct = Math.max(0, Math.min(100, Math.round(((total - left) / total) * 100)));
      this.uiProgressFill.style.width = `${pct}%`;
    }
  }

  public showStartBriefing(): void {
    const save = storage.getSave();
    const plan = this.game.plan;

    document.getElementById('startBadge')!.textContent = plan.biome.name;
    document.getElementById('startTitle')!.textContent = plan.isTitanLevel ? 'TITAN SHOWDOWN' : plan.isBossLevel ? 'WARDEN ASSAULT' : `MISSION ${plan.level}`;
    document.getElementById('startRuleTitle')!.textContent = plan.biome.ruleTitle;
    document.getElementById('startRuleDesc')!.textContent = plan.biome.ruleDesc;
    document.getElementById('startReward')!.textContent = `+${plan.coinReward} 🪙`;

    // Render pre-level upgrade buttons
    this.renderUpgradeButtons();

    this.startOverlay.classList.remove('hidden');
  }

  private renderUpgradeButtons(): void {
    const save = storage.getSave();
    const upgContainer = document.getElementById('startUpgrades')!;
    upgContainer.innerHTML = '';

    const upgs: { key: keyof typeof save.upgrades; label: string; icon: string }[] = [
      { key: 'startSquad', label: 'Squad Size', icon: '👥' },
      { key: 'firepower', label: 'Firepower', icon: '💥' },
      { key: 'fireRate', label: 'Fire Rate', icon: '⚡' },
      { key: 'armorPierce', label: 'AP Rounds', icon: '🛡️' },
    ];

    upgs.forEach(u => {
      const lvl = save.upgrades[u.key] || 1;
      const cost = storage.getUpgradeCost(u.key);
      const canAfford = save.coins >= cost;

      const btn = document.createElement('button');
      btn.className = `btn-tap flex items-center justify-between p-2.5 rounded-xl border ${
        canAfford ? 'bg-slate-900 border-slate-700/80 hover:border-sky-400' : 'bg-slate-900/50 border-slate-800 text-slate-500'
      }`;
      btn.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-base">${u.icon}</span>
          <div class="text-left">
            <div class="text-xs font-bold text-white">${u.label}</div>
            <div class="text-[10px] text-slate-400">Lv. <span class="font-mono-num text-sky-400">${lvl}</span></div>
          </div>
        </div>
        <div class="px-2 py-1 rounded-md bg-slate-950 font-mono-num text-xs font-bold text-amber-300">
          ${cost} 🪙
        </div>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (storage.buyUpgrade(u.key)) {
          sfx.playGateCharge();
          this.game.player.count = 1 + (storage.getSave().upgrades.startSquad - 1) * 2;
          this.game.initLevel(this.game.currentLevel);
          this.renderUpgradeButtons();
          this.updateHUD(this.game.currentLevel, this.game.enemiesLeft, this.game.totalEnemiesInLevel, storage.getSave().coins);
        } else {
          sfx.playLose();
        }
      });

      upgContainer.appendChild(btn);
    });
  }

  public showResult(won: boolean, coins: number, reason?: string): void {
    const resIcon = document.getElementById('resIcon')!;
    const resTitle = document.getElementById('resTitle')!;
    const resDesc = document.getElementById('resDesc')!;
    const resCoins = document.getElementById('resCoins')!;
    const btnNext = document.getElementById('btnNext')!;

    if (won) {
      resIcon.textContent = '🏆';
      resTitle.textContent = 'SECTOR SECURED';
      resDesc.textContent = `Excellent tactical command! Enemy phalanx neutralised.`;
      resCoins.textContent = `+${coins} 🪙`;
      btnNext.classList.remove('hidden');
    } else {
      resIcon.textContent = '💥';
      resTitle.textContent = 'MISSION FAILED';
      resDesc.textContent = reason || 'Watch both lanes and prioritize Shield Bearers!';
      resCoins.textContent = `+${coins} 🪙`;
      btnNext.classList.add('hidden');
    }

    this.resultModal.classList.remove('hidden');
  }

  private setupListeners(): void {
    // Tap to start combat
    document.getElementById('btnTapToStart')?.addEventListener('click', () => {
      this.startOverlay.classList.add('hidden');
      this.game.startCombat();
    });

    // Pause button
    this.btnPause?.addEventListener('click', () => {
      if (this.game.mode === 'PLAYING') {
        this.game.pause();
        this.pauseModal.classList.remove('hidden');
      }
    });

    document.getElementById('btnResume')?.addEventListener('click', () => {
      this.pauseModal.classList.add('hidden');
      this.game.resume();
    });

    document.getElementById('btnRestartPause')?.addEventListener('click', () => {
      this.pauseModal.classList.add('hidden');
      this.game.initLevel(this.game.currentLevel);
      this.showStartBriefing();
    });

    // Sound toggle
    document.getElementById('btnToggleSound')?.addEventListener('click', (e) => {
      sfx.enabled = !sfx.enabled;
      (e.currentTarget as HTMLElement).textContent = sfx.enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    });

    // Result buttons
    document.getElementById('btnRetry')?.addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      this.game.initLevel(this.game.currentLevel);
      this.showStartBriefing();
    });

    document.getElementById('btnNext')?.addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      this.game.initLevel(Math.min(100, this.game.currentLevel + 1));
      this.showStartBriefing();
    });

    // 1-100 Map Modal
    this.btnOpenMap?.addEventListener('click', () => {
      if (this.game.mode === 'PLAYING') this.game.pause();
      this.renderLevelMap();
      this.mapModal.classList.remove('hidden');
    });

    document.getElementById('btnCloseMap')?.addEventListener('click', () => {
      this.mapModal.classList.add('hidden');
      if (this.startOverlay.classList.contains('hidden')) {
        this.game.resume();
      }
    });

    // Cloud Profile Modal
    document.getElementById('btnProfile')?.addEventListener('click', () => {
      this.renderProfile();
      this.profileModal.classList.remove('hidden');
    });

    document.getElementById('btnCloseProfile')?.addEventListener('click', () => {
      this.profileModal.classList.add('hidden');
    });

    document.getElementById('btnGoogleLogin')?.addEventListener('click', async () => {
      try {
        const user = await loginWithGoogle();
        if (user) {
          await storage.syncWithCloud();
          this.renderProfile();
          this.updateHUD(this.game.currentLevel, this.game.enemiesLeft, this.game.totalEnemiesInLevel, storage.getSave().coins);
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  private renderLevelMap(): void {
    const save = storage.getSave();
    const grid = document.getElementById('levelGrid')!;
    grid.innerHTML = '';

    for (let i = 1; i <= 100; i++) {
      const unlocked = i <= save.maxLevel;
      const isTitan = i % 10 === 0;
      const isWarden = !isTitan && i % 5 === 0;

      const btn = document.createElement('button');
      btn.className = `btn-tap h-11 rounded-xl font-mono-num text-xs font-black border flex flex-col items-center justify-center ${
        !unlocked
          ? 'bg-slate-900/40 border-slate-800/60 text-slate-600 cursor-not-allowed'
          : i === this.game.currentLevel
          ? 'bg-sky-400 text-slate-950 border-sky-300'
          : isTitan
          ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
          : isWarden
          ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
          : 'bg-slate-900 border-slate-800 text-slate-200'
      }`;
      btn.innerHTML = `<span>${i}</span>${isTitan ? '<span class="text-[8px]">☠️</span>' : isWarden ? '<span class="text-[8px]">👑</span>' : ''}`;

      if (unlocked) {
        btn.addEventListener('click', () => {
          this.mapModal.classList.add('hidden');
          this.game.initLevel(i);
          this.showStartBriefing();
        });
      }
      grid.appendChild(btn);
    }
  }

  private renderProfile(): void {
    const save = storage.getSave();
    const user = getCurrentUser();

    document.getElementById('profileName')!.textContent = user?.displayName || 'Commander (Guest)';
    document.getElementById('cloudStatus')!.textContent = user ? '🟢 Synced with Google Cloud Firestore' : '🟡 Offline Guest Mode';
    document.getElementById('statKills')!.textContent = `${save.stats.totalKills}`;
    document.getElementById('statBosses')!.textContent = `${save.stats.bossesDefeated}`;
    document.getElementById('statAltars')!.textContent = `${save.stats.altarsUsed}`;
    document.getElementById('statRicochet')!.textContent = `${save.stats.ricochetKills}`;

    const achContainer = document.getElementById('achievementsList')!;
    achContainer.innerHTML = '';

    ACHIEVEMENTS_CATALOG.forEach(ach => {
      const isUnlocked = !!save.achievements[ach.id];
      const div = document.createElement('div');
      div.className = `flex items-center justify-between p-2.5 rounded-xl border ${
        isUnlocked ? 'bg-slate-900 border-sky-500/30' : 'bg-slate-900/40 border-slate-800/50 opacity-60'
      }`;
      div.innerHTML = `
        <div class="flex items-center gap-2.5">
          <span class="text-xl">${ach.icon}</span>
          <div>
            <div class="text-xs font-bold text-white">${ach.title}</div>
            <div class="text-[10px] text-slate-400">${ach.desc}</div>
          </div>
        </div>
        <div class="text-xs font-mono-num font-bold ${isUnlocked ? 'text-emerald-400' : 'text-slate-500'}">
          ${isUnlocked ? 'CLAIMED' : `+${ach.rewardCoins} 🪙`}
        </div>
      `;
      achContainer.appendChild(div);
    });
  }
}
