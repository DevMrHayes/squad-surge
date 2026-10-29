// Squad Surge: Zero-Clutter UI Controller & Player Account Whitelist Management
import { GameLoop } from '../engine/gameLoop';
import { storage } from '../services/storage';
import { ACHIEVEMENTS_CATALOG } from '../constants/biomes';
import { 
  loginWithGoogle, 
  loginWithEmail, 
  logoutUser, 
  getCurrentUser, 
  getCurrentProfile, 
  isCurrentAdmin, 
  getAllUsers, 
  updateUserApproval,
  PRIMARY_ADMIN_EMAIL
} from '../config/firebase';
import { UserAccountProfile } from '../types/game';
import { sfx } from '../services/audio';

export class UIController {
  private game: GameLoop;
  private isSignUpMode: boolean = false;

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
  private authModal = document.getElementById('authModal')!;
  private pendingModal = document.getElementById('pendingModal')!;
  private adminModal = document.getElementById('adminModal')!;

  constructor(game: GameLoop) {
    this.game = game;
    this.setupListeners();
    this.updateHUD(game.currentLevel, 0, 0, storage.getSave().coins);
    this.handleAuthStateChange(getCurrentProfile());
  }

  public formatSurvivalTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor(((seconds % 1) * 10) + 0.001);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  }

  public updateHUD(
    level: number, 
    left: number, 
    total: number, 
    coins: number,
    isEndless?: boolean,
    endlessTime?: number,
    endlessThreat?: number
  ): void {
    if (isEndless) {
      if (this.uiLevelNum) this.uiLevelNum.textContent = '∞';
      const enemiesLabel = this.uiEnemiesLeft.parentElement?.querySelector('span:first-child');
      if (enemiesLabel) enemiesLabel.textContent = '⏱️ SURVIVAL TIME';
      if (this.uiEnemiesLeft) this.uiEnemiesLeft.textContent = this.formatSurvivalTime(endlessTime || 0);
      if (this.uiCoins) this.uiCoins.textContent = `${coins}`;

      if (this.uiProgressFill) {
        const pct = Math.round((((endlessTime || 0) % 20) / 20) * 100);
        this.uiProgressFill.style.width = `${pct}%`;
      }
    } else {
      if (this.uiLevelNum) this.uiLevelNum.textContent = `${level}`;
      const enemiesLabel = this.uiEnemiesLeft.parentElement?.querySelector('span:first-child');
      if (enemiesLabel) enemiesLabel.textContent = 'Enemies Left';
      if (this.uiEnemiesLeft) this.uiEnemiesLeft.textContent = `${left}`;
      if (this.uiCoins) this.uiCoins.textContent = `${coins}`;

      if (this.uiProgressFill && total > 0) {
        const pct = Math.max(0, Math.min(100, Math.round(((total - left) / total) * 100)));
        this.uiProgressFill.style.width = `${pct}%`;
      }
    }
  }

  public showStartBriefing(): void {
    const profile = getCurrentProfile();
    // If user account is pending approval, do not show deployment overlay; show pending modal instead
    if (profile && profile.status === 'PENDING') {
      this.showPendingModal(profile);
      return;
    }

    const save = storage.getSave();
    const isEndless = this.game.isEndless;
    const plan = this.game.plan;

    // Synchronize HUD immediately upon opening briefing so header displays Level ∞ or Level X cleanly
    this.updateHUD(
      this.game.currentLevel,
      isEndless ? 0 : plan.totalEnemies,
      isEndless ? 0 : plan.totalEnemies,
      save.coins,
      isEndless,
      isEndless ? this.game.endlessTimeSurvived : 0,
      isEndless ? this.game.endlessThreatLevel : 1
    );

    // Update Mode Tabs Visual State to M3 Segmented Control
    const tabCampaign = document.getElementById('tabModeCampaign');
    const tabEndless = document.getElementById('tabModeEndless');
    if (tabCampaign && tabEndless) {
      if (isEndless) {
        tabCampaign.className = 'flex-1 h-11 px-3 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-1.5';
        tabEndless.className = 'flex-1 h-11 px-3 rounded-full text-xs font-black tracking-wider uppercase transition-all duration-200 bg-gradient-to-r from-sky-400 to-sky-500 text-slate-950 shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5';
      } else {
        tabCampaign.className = 'flex-1 h-11 px-3 rounded-full text-xs font-black tracking-wider uppercase transition-all duration-200 bg-gradient-to-r from-sky-400 to-sky-500 text-slate-950 shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5';
        tabEndless.className = 'flex-1 h-11 px-3 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-1.5';
      }
    }

    const badgeEl = document.getElementById('startBadge')!;
    const rewardEl = document.getElementById('startReward')!;
    const titleEl = document.getElementById('startTitle')!;
    const ruleTitleEl = document.getElementById('startRuleTitle')!;
    const ruleDescEl = document.getElementById('startRuleDesc')!;
    const deployBtn = document.getElementById('btnTapToStart');

    if (isEndless) {
      badgeEl.textContent = '♾️ ENDLESS HIGHWAY';
      badgeEl.style.borderColor = '#38bdf860';
      badgeEl.style.color = '#38bdf8';

      const bestTime = this.formatSurvivalTime(save.stats.endlessBestTime || 0);
      const bestLevel = save.stats.endlessBestLevel || 1;
      rewardEl.textContent = `BEST: ${bestTime} ⏱️`;
      titleEl.textContent = 'INFINITE HIGHWAY SURVIVAL';
      ruleTitleEl.textContent = `Dynamic Threat Escalation • Best: ${bestTime} (Threat ${bestLevel})`;
      ruleDescEl.textContent = 'Enemies, Brutes, and Bosses scale continuously every 10 seconds. Survive as long as you can to set the high score!';
      if (deployBtn) deployBtn.innerHTML = '<span>🚀 DEPLOY SURVIVAL SQUAD</span>';
    } else {
      badgeEl.textContent = `${plan.biome.name} • ${plan.archetype.badge}`;
      badgeEl.style.borderColor = `${plan.archetype.badgeColor}60`;
      badgeEl.style.color = plan.archetype.badgeColor;

      rewardEl.textContent = `+${plan.coinReward} 🪙`;
      titleEl.textContent = plan.isTitanLevel
        ? 'TITAN SHOWDOWN'
        : plan.isBossLevel
          ? 'WARDEN ASSAULT'
          : `${plan.archetype.title} (LV. ${plan.level})`;
      ruleTitleEl.textContent = `${plan.biome.ruleTitle} | ${plan.archetype.title}`;
      ruleDescEl.textContent = `${plan.archetype.advisory} (FEATURED: ${plan.archetype.featuredBuff})`;
      if (deployBtn) deployBtn.innerHTML = '<span>🚀 DEPLOY SQUAD</span>';
    }

    // Render prominent commander status card
    this.updateBriefingProfileCard(profile);

    // Render pre-level upgrade buttons & power check
    this.renderUpgradeButtons();
    this.updatePowerReadiness();

    // Ensure pause button is hidden during briefing (strictly zero active combat clutter)
    this.btnPause?.classList.add('hidden');

    this.startOverlay.classList.remove('hidden');
  }

  private getPlayerCombatPower(): number {
    const u = storage.getSave().upgrades;
    return (u.startSquad || 1) + (u.firepower || 1) + (u.fireRate || 1) + (u.armorPierce || 1);
  }

  private updatePowerReadiness(): void {
    const powerText = document.getElementById('startPowerText');
    const powerStatus = document.getElementById('startPowerStatus');
    const powerBox = document.getElementById('startPowerCheck');
    const meterBar = document.getElementById('startPowerMeterBar');
    if (!powerText || !powerStatus || !powerBox) return;

    const playerPower = this.getPlayerCombatPower();
    const reqPower = this.game.plan.recommendedPower || 4;
    powerText.textContent = `SQUAD POWER: ⚡ ${playerPower} / REQ: 🛡️ ${reqPower}`;

    // Ratio for linear progress meter (capped at 100%)
    const pct = Math.min(100, Math.round((playerPower / reqPower) * 100));
    if (meterBar) {
      meterBar.style.width = `${pct}%`;
    }

    if (playerPower >= reqPower) {
      powerStatus.textContent = '✓ COMBAT READY';
      powerStatus.className = 'text-emerald-400 uppercase tracking-wider text-[10px] font-black';
      powerBox.className = 'flex flex-col gap-1.5 px-3 py-2.5 rounded-2xl bg-emerald-950/25 border border-emerald-500/30';
      if (meterBar) meterBar.className = 'h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300';
    } else if (playerPower === reqPower - 1) {
      powerStatus.textContent = '⚠️ UPGRADE ADVISED';
      powerStatus.className = 'text-amber-400 uppercase tracking-wider text-[10px] font-black';
      powerBox.className = 'flex flex-col gap-1.5 px-3 py-2.5 rounded-2xl bg-amber-950/25 border border-amber-500/30';
      if (meterBar) meterBar.className = 'h-full rounded-full bg-gradient-to-r from-sky-400 to-amber-400 transition-all duration-300';
    } else {
      powerStatus.textContent = '💀 FARM PREV. LEVELS';
      powerStatus.className = 'text-rose-400 uppercase tracking-wider text-[10px] font-black';
      powerBox.className = 'flex flex-col gap-1.5 px-3 py-2.5 rounded-2xl bg-rose-950/30 border border-rose-500/35';
      if (meterBar) meterBar.className = 'h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all duration-300';
    }
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
      btn.className = `btn-tap m3-upgrade-card flex items-center justify-between p-2.5 rounded-2xl border min-h-[64px] ${
        canAfford 
          ? 'bg-[#121c30] border-white/10 shadow-sm' 
          : 'bg-[#0a0f1d]/60 border-white/5 opacity-55'
      }`;

      btn.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-sky-400/10 border border-sky-400/25 flex items-center justify-center text-sm shrink-0 shadow-inner">
            <span>${u.icon}</span>
          </div>
          <div class="text-left min-w-0">
            <div class="text-xs font-black text-white truncate">${u.label}</div>
            <div class="text-[10px] text-slate-400 font-bold">
              Lv. <span class="font-mono-num text-sky-400 font-black">${lvl}</span>
            </div>
          </div>
        </div>
        <div class="px-2.5 py-1.5 rounded-xl bg-[#060913] border border-amber-400/20 font-mono-num text-xs font-black text-amber-300 shadow-inner shrink-0">
          ${cost} 🪙
        </div>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (storage.buyUpgrade(u.key)) {
          sfx.playGateCharge();
          this.game.player.count = 5 + (storage.getSave().upgrades.startSquad - 1) * 2;
          this.game.initLevel(this.game.currentLevel);
          this.renderUpgradeButtons();
          this.updatePowerReadiness();
          this.updateHUD(this.game.currentLevel, this.game.enemiesLeft, this.game.totalEnemiesInLevel, storage.getSave().coins);
        } else {
          sfx.playLose();
        }
      });

      upgContainer.appendChild(btn);
    });
  }

  public showResult(won: boolean, coins: number, reason?: string, details?: any): void {
    const resIcon = document.getElementById('resIcon')!;
    const resTitle = document.getElementById('resTitle')!;
    const resDesc = document.getElementById('resDesc')!;
    const resCoins = document.getElementById('resCoins')!;
    const resBaseReward = document.getElementById('resBaseReward');
    const resSurvivalBonus = document.getElementById('resSurvivalBonus');
    const btnNext = document.getElementById('btnNext')!;
    const btnRetry = document.getElementById('btnRetry')!;

    if (details?.isEndless) {
      resIcon.textContent = details.isNewRecord ? '🎖️' : '☠️';
      resTitle.textContent = details.isNewRecord ? 'NEW PERSONAL BEST!' : 'HIGHWAY DEFENSE BREACHED';
      const timeStr = this.formatSurvivalTime(details.timeSurvived || 0);
      const cause = reason || 'Defensive perimeter overrun';
      resDesc.textContent = details.isNewRecord 
        ? `🎉 Sensational new record: ${timeStr}! Cause of defeat: ${cause}.` 
        : `Defeat cause: ${cause} | Final Time: ${timeStr}.`;

      const baseLabel = resBaseReward?.parentElement?.querySelector('span:first-child');
      const bonusLabel = resSurvivalBonus?.parentElement?.querySelector('span:first-child');
      if (baseLabel) baseLabel.textContent = 'Survival Duration:';
      if (bonusLabel) bonusLabel.textContent = 'Threat Level Reached:';

      if (resBaseReward) resBaseReward.textContent = `${timeStr} ⏱️`;
      if (resSurvivalBonus) resSurvivalBonus.textContent = `Threat LV. ${details.threatLevel || 1} ⚡`;
      resCoins.textContent = `+${coins} 🪙`;

      btnRetry.textContent = 'Retry Survival';
      btnNext.textContent = 'Campaign Mode ▸';
      btnNext.classList.remove('hidden');
    } else if (won) {
      resIcon.textContent = '🏆';
      resTitle.textContent = 'SECTOR SECURED';
      resDesc.textContent = reason || 'Excellent tactical command! Enemy phalanx neutralised.';

      const baseLabel = resBaseReward?.parentElement?.querySelector('span:first-child');
      const bonusLabel = resSurvivalBonus?.parentElement?.querySelector('span:first-child');
      if (baseLabel) baseLabel.textContent = 'Base Clearance:';
      if (bonusLabel) bonusLabel.textContent = 'Squad Survival Bonus:';

      const survivalBonus = Math.max(0, this.game.player.count * 2);
      const baseReward = Math.max(0, coins - survivalBonus);
      if (resBaseReward) resBaseReward.textContent = `+${baseReward} 🪙`;
      if (resSurvivalBonus) resSurvivalBonus.textContent = `+${survivalBonus} 🪙 (+${this.game.player.count} 👥)`;
      resCoins.textContent = `+${coins} 🪙`;
      btnRetry.textContent = 'Retry';
      btnNext.textContent = 'Next Level ▸';
      btnNext.classList.remove('hidden');
    } else {
      resIcon.textContent = '💥';
      resTitle.textContent = 'MISSION FAILED';
      const playerPower = this.getPlayerCombatPower();
      const reqPower = this.game.plan.recommendedPower || 4;
      if (playerPower < reqPower) {
        resDesc.textContent = `Gear Check! Your Squad Power (${playerPower}) is below the recommended level (${reqPower}). Buy upgrades or tap "Level ▾" to replay earlier missions for gold!`;
      } else {
        resDesc.textContent = reason || 'Perimeter overrun! Prioritise high-threat flankers and unlock barriers early.';
      }

      const baseLabel = resBaseReward?.parentElement?.querySelector('span:first-child');
      const bonusLabel = resSurvivalBonus?.parentElement?.querySelector('span:first-child');
      if (baseLabel) baseLabel.textContent = 'Base Clearance:';
      if (bonusLabel) bonusLabel.textContent = 'Squad Survival Bonus:';

      if (resBaseReward) resBaseReward.textContent = `+0 🪙`;
      if (resSurvivalBonus) resSurvivalBonus.textContent = `+0 🪙 (0 👥)`;
      resCoins.textContent = `+${coins} 🪙`;
      btnRetry.textContent = 'Retry';
      btnNext.classList.add('hidden');
    }

    this.btnPause?.classList.add('hidden');
    this.resultModal.classList.remove('hidden');
  }

  private updateAccountHUD(profile: UserAccountProfile | null): void {
    const iconEl = document.getElementById('headerAccountIcon');
    const labelEl = document.getElementById('headerAccountLabel');
    if (!profile) {
      if (iconEl) iconEl.textContent = '👤';
      if (labelEl) labelEl.textContent = 'Sign In';
      return;
    }
    const isAdmin = isCurrentAdmin();
    if (iconEl) iconEl.textContent = isAdmin ? '👑' : '🎖️';
    if (labelEl) labelEl.textContent = isAdmin ? 'Admin' : (profile.displayName ? profile.displayName.split(' ')[0] : 'Profile');
  }

  private updateBriefingProfileCard(profile: UserAccountProfile | null): void {
    const avatar = document.getElementById('briefingAvatar');
    const name = document.getElementById('briefingCommanderName');
    const pill = document.getElementById('briefingStatusPill');
    const email = document.getElementById('briefingCommanderEmail');
    const btnContainer = document.getElementById('briefingBtnContainer');

    if (!profile) {
      if (avatar) avatar.textContent = '👤';
      if (name) name.textContent = 'Guest Commander';
      if (pill) {
        pill.textContent = 'Offline';
        pill.className = 'px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-slate-800 text-slate-400 border border-slate-700';
      }
      if (email) email.textContent = '⚠️ Progress saved locally only';
      if (btnContainer) {
        btnContainer.innerHTML = `
          <button id="btnBriefingAction" class="btn-tap px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-sky-500 text-slate-950 font-black text-[11px] uppercase shadow-sm">
            Sign In
          </button>
        `;
        document.getElementById('btnBriefingAction')?.addEventListener('click', () => {
          this.authModal.classList.remove('hidden');
        });
      }
      return;
    }

    const isAdmin = isCurrentAdmin();
    if (avatar) avatar.textContent = isAdmin ? '👑' : '🎖️';
    if (name) name.textContent = profile.displayName || (isAdmin ? 'Chief Commander Hayes' : 'Commander');
    if (pill) {
      pill.textContent = isAdmin ? '👑 Chief Admin' : profile.status === 'APPROVED' ? '✓ Approved' : '⏳ Pending';
      pill.className = isAdmin || profile.status === 'APPROVED'
        ? 'px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
        : 'px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-400/30';
    }
    if (email) email.textContent = `${profile.email} • Cloud Active`;

    if (btnContainer) {
      if (isAdmin) {
        btnContainer.innerHTML = `
          <button id="btnBriefingAdmin" class="btn-tap px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px] uppercase shadow-sm">
            👑 Approvals
          </button>
          <button id="btnBriefingProfile" class="btn-tap px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold text-[10px]">
            Profile
          </button>
        `;
        document.getElementById('btnBriefingAdmin')?.addEventListener('click', () => {
          this.openAdminPanel();
        });
        document.getElementById('btnBriefingProfile')?.addEventListener('click', () => {
          this.renderProfile();
          this.profileModal.classList.remove('hidden');
        });
      } else {
        btnContainer.innerHTML = `
          <button id="btnBriefingProfile" class="btn-tap px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sky-400 font-bold text-[11px]">
            Profile
          </button>
        `;
        document.getElementById('btnBriefingProfile')?.addEventListener('click', () => {
          this.renderProfile();
          this.profileModal.classList.remove('hidden');
        });
      }
    }
  }

  private async openAdminPanel(): Promise<void> {
    this.profileModal.classList.add('hidden');
    this.adminModal.classList.remove('hidden');
    await this.loadAdminApprovalQueue();
  }

  public handleAuthStateChange(profile: UserAccountProfile | null): void {
    const accountLabel = document.getElementById('userAccountLabel');
    const emailLabel = document.getElementById('userEmailLabel');
    const statusBadge = document.getElementById('userStatusBadge');
    const btnOpenAuth = document.getElementById('btnOpenAuth');
    const btnLogout = document.getElementById('btnLogout');
    const btnOpenAdmin = document.getElementById('btnOpenAdmin');

    this.updateAccountHUD(profile);
    this.updateBriefingProfileCard(profile);

    if (!profile) {
      if (accountLabel) accountLabel.textContent = 'Commander (Guest)';
      if (emailLabel) emailLabel.textContent = 'Offline Local Mode';
      if (statusBadge) {
        statusBadge.textContent = 'Guest';
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700';
      }
      btnOpenAuth?.classList.remove('hidden');
      btnLogout?.classList.add('hidden');
      btnOpenAdmin?.classList.add('hidden');
      this.pendingModal.classList.add('hidden');
      return;
    }

    if (accountLabel) accountLabel.textContent = profile.displayName || 'Commander';
    if (emailLabel) emailLabel.textContent = profile.email;
    btnOpenAuth?.classList.add('hidden');
    btnLogout?.classList.remove('hidden');

    const isAdmin = isCurrentAdmin();
    if (btnOpenAdmin) {
      if (isAdmin) btnOpenAdmin.classList.remove('hidden');
      else btnOpenAdmin.classList.add('hidden');
    }

    if (statusBadge) {
      if (profile.status === 'APPROVED') {
        statusBadge.textContent = isAdmin ? '👑 Chief Admin' : '✓ Active Commander';
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
      } else if (profile.status === 'PENDING') {
        statusBadge.textContent = '⏳ Pending Approval';
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30';
      } else {
        statusBadge.textContent = '🚫 Access Denied';
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30';
      }
    }

    if (profile.status === 'PENDING') {
      this.showPendingModal(profile);
    } else {
      this.pendingModal.classList.add('hidden');
      this.authModal.classList.add('hidden');
      this.updateHUD(this.game.currentLevel, this.game.enemiesLeft, this.game.totalEnemiesInLevel, storage.getSave().coins);
      this.showStartBriefing();
    }
  }

  private showPendingModal(profile: UserAccountProfile): void {
    const emailEl = document.getElementById('pendingUserEmail');
    if (emailEl) emailEl.textContent = profile.email;
    this.startOverlay.classList.add('hidden');
    this.pendingModal.classList.remove('hidden');
  }

  private setupListeners(): void {
    // Tap to start combat
    document.getElementById('btnTapToStart')?.addEventListener('click', () => {
      const profile = getCurrentProfile();
      if (profile && profile.status === 'PENDING') {
        this.showPendingModal(profile);
        return;
      }
      this.startOverlay.classList.add('hidden');
      this.btnPause?.classList.remove('hidden');
      this.game.startCombat();
    });

    // Pause button
    this.btnPause?.addEventListener('click', () => {
      if (this.game.mode === 'PLAYING') {
        this.game.pause();
        this.btnPause?.classList.add('hidden');
        this.pauseModal.classList.remove('hidden');
      }
    });

    document.getElementById('btnResume')?.addEventListener('click', () => {
      this.pauseModal.classList.add('hidden');
      this.btnPause?.classList.remove('hidden');
      this.game.resume();
    });

    // Game Mode Switcher Tabs
    document.getElementById('tabModeCampaign')?.addEventListener('click', () => {
      if (this.game.isEndless) {
        const save = storage.getSave();
        this.game.initLevel(save.level, false);
        this.showStartBriefing();
      }
    });

    document.getElementById('tabModeEndless')?.addEventListener('click', () => {
      if (!this.game.isEndless) {
        this.game.initLevel(1, true);
        this.showStartBriefing();
      }
    });

    document.getElementById('btnLaunchEndlessFromMap')?.addEventListener('click', () => {
      this.mapModal.classList.add('hidden');
      this.game.initLevel(1, true);
      this.showStartBriefing();
    });

    document.getElementById('btnRestartPause')?.addEventListener('click', () => {
      this.pauseModal.classList.add('hidden');
      this.game.initLevel(this.game.currentLevel, this.game.isEndless);
      this.showStartBriefing();
    });

    // Sound toggle
    document.getElementById('btnToggleSound')?.addEventListener('click', (e) => {
      const enabled = sfx.toggleMute();
      (e.currentTarget as HTMLElement).textContent = enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    });

    // Result buttons
    document.getElementById('btnRetry')?.addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      this.game.initLevel(this.game.currentLevel, this.game.isEndless);
      this.showStartBriefing();
    });

    document.getElementById('btnNext')?.addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      if (this.game.isEndless) {
        const save = storage.getSave();
        this.game.initLevel(save.level, false);
      } else {
        this.game.initLevel(Math.min(100, this.game.currentLevel + 1), false);
      }
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
      if (this.startOverlay.classList.contains('hidden') && this.game.mode === 'PAUSED') {
        this.game.resume();
      }
    });

    // Account Header Button
    document.getElementById('btnAccountHeader')?.addEventListener('click', () => {
      const profile = getCurrentProfile();
      if (!profile) {
        this.authModal.classList.remove('hidden');
      } else {
        this.renderProfile();
        this.profileModal.classList.remove('hidden');
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

    // Force PWA Cache Clear & Hard Reload
    document.getElementById('btnForceCacheClear')?.addEventListener('click', async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
      } catch (e) {
        console.warn('Cache clear error:', e);
      }
      window.location.reload();
    });

    // Auth Modal Triggers
    document.getElementById('btnOpenAuth')?.addEventListener('click', () => {
      this.authModal.classList.remove('hidden');
    });

    document.getElementById('btnCloseAuth')?.addEventListener('click', () => {
      this.authModal.classList.add('hidden');
    });

    document.getElementById('btnPlayAsGuest')?.addEventListener('click', () => {
      this.authModal.classList.add('hidden');
      this.showStartBriefing();
    });

    // Toggle Sign In vs Register
    document.getElementById('btnToggleAuthMode')?.addEventListener('click', (e) => {
      this.isSignUpMode = !this.isSignUpMode;
      const title = document.getElementById('authTitle')!;
      const submit = document.getElementById('btnAuthSubmit')!;
      const toggle = e.currentTarget as HTMLElement;

      if (this.isSignUpMode) {
        title.textContent = 'REGISTER NEW COMMANDER';
        submit.textContent = 'Create Account (Pending Approval)';
        toggle.textContent = 'Already have an account? Sign In';
      } else {
        title.textContent = 'COMMANDER SIGN IN';
        submit.textContent = 'Sign In';
        toggle.textContent = 'Need an account? Register new commander';
      }
    });

    // Google Sign-In
    document.getElementById('btnAuthGoogle')?.addEventListener('click', async () => {
      const errBox = document.getElementById('authError')!;
      errBox.classList.add('hidden');
      try {
        const profile = await loginWithGoogle();
        if (profile) {
          await storage.syncWithCloud();
          this.handleAuthStateChange(profile);
        }
      } catch (err: any) {
        errBox.textContent = err?.message || 'Google sign-in was cancelled or failed.';
        errBox.classList.remove('hidden');
      }
    });

    // Email Form Submit
    document.getElementById('authForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('authError')!;
      errBox.classList.add('hidden');

      const emailInput = document.getElementById('authEmail') as HTMLInputElement;
      const passInput = document.getElementById('authPassword') as HTMLInputElement;

      try {
        const profile = await loginWithEmail(emailInput.value.trim(), passInput.value, this.isSignUpMode);
        if (profile) {
          await storage.syncWithCloud();
          this.handleAuthStateChange(profile);
        }
      } catch (err: any) {
        errBox.textContent = err?.message || 'Authentication failed. Please verify credentials.';
        errBox.classList.remove('hidden');
      }
    });

    // Logout Buttons
    const handleLogout = async () => {
      await logoutUser();
      this.handleAuthStateChange(null);
    };
    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);
    document.getElementById('btnPendingLogout')?.addEventListener('click', handleLogout);

    // Check Approval Status
    document.getElementById('btnCheckApproval')?.addEventListener('click', async () => {
      await storage.syncWithCloud();
      const profile = getCurrentProfile();
      this.handleAuthStateChange(profile);
    });

    // Admin Modal Controls
    document.getElementById('btnOpenAdmin')?.addEventListener('click', async () => {
      this.profileModal.classList.add('hidden');
      this.adminModal.classList.remove('hidden');
      await this.loadAdminApprovalQueue();
    });

    document.getElementById('btnCloseAdmin')?.addEventListener('click', () => {
      this.adminModal.classList.add('hidden');
    });

    document.getElementById('btnRefreshAdmin')?.addEventListener('click', async () => {
      await this.loadAdminApprovalQueue();
    });
  }

  public async loadAdminApprovalQueue(): Promise<void> {
    const listContainer = document.getElementById('adminUserList')!;
    const countEl = document.getElementById('adminQueueCount')!;
    listContainer.innerHTML = '<div class="text-xs text-slate-400 py-4 text-center">Loading commander list...</div>';

    const users = await getAllUsers();
    const pendingCount = users.filter(u => u.status === 'PENDING').length;
    countEl.textContent = `Pending Approvals: ${pendingCount} | Total Commanders: ${users.length}`;

    if (users.length === 0) {
      listContainer.innerHTML = '<div class="text-xs text-slate-500 py-8 text-center">No registered commanders found.</div>';
      return;
    }

    // Sort: Pending first, then by createdAt descending
    users.sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    listContainer.innerHTML = '';
    users.forEach(u => {
      const isPrimaryAdmin = u.email.toLowerCase() === PRIMARY_ADMIN_EMAIL;
      const isPending = u.status === 'PENDING';
      const isApproved = u.status === 'APPROVED';

      const card = document.createElement('div');
      card.className = `p-3 rounded-2xl border flex flex-col gap-2 ${
        isPending 
          ? 'bg-amber-950/30 border-amber-500/50' 
          : isApproved 
          ? 'bg-slate-900 border-slate-800' 
          : 'bg-rose-950/20 border-rose-900/40 opacity-70'
      }`;

      card.innerHTML = `
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-white">${u.displayName || 'Commander'}</span>
              ${isPrimaryAdmin ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30">PRIMARY ADMIN</span>' : ''}
            </div>
            <div class="text-[11px] font-mono text-slate-400">${u.email}</div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
            isApproved 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
              : isPending 
              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' 
              : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
          }">
            ${u.status}
          </span>
        </div>

        <div class="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-2">
          <div>Level: <span class="font-bold text-sky-400">${u.saveData?.level || 1}</span> (Max: ${u.saveData?.maxLevel || 1})</div>
          <div>Coins: <span class="font-bold text-amber-300">${u.saveData?.coins || 0} 🪙</span></div>
          <div>Joined: ${new Date(u.createdAt || Date.now()).toLocaleDateString()}</div>
        </div>

        ${!isPrimaryAdmin ? `
          <div class="flex gap-2 pt-1">
            ${isPending || !isApproved ? `
              <button class="btn-approve btn-tap flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs uppercase" data-uid="${u.uid}">
                ✓ Approve Access
              </button>
            ` : ''}
            ${isPending || isApproved ? `
              <button class="btn-reject btn-tap flex-1 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-xs uppercase" data-uid="${u.uid}">
                ✕ Decline / Revoke
              </button>
            ` : ''}
          </div>
        ` : ''}
      `;

      card.querySelector('.btn-approve')?.addEventListener('click', async () => {
        await updateUserApproval(u.uid, 'APPROVED');
        sfx.playGateCharge();
        await this.loadAdminApprovalQueue();
      });

      card.querySelector('.btn-reject')?.addEventListener('click', async () => {
        await updateUserApproval(u.uid, 'REJECTED');
        sfx.playLose();
        await this.loadAdminApprovalQueue();
      });

      listContainer.appendChild(card);
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
    const profile = getCurrentProfile();

    document.getElementById('profileName')!.textContent = profile?.displayName || user?.displayName || 'Commander';
    document.getElementById('cloudStatus')!.textContent = profile?.status === 'APPROVED' 
      ? '🟢 Cloud Sync Active' 
      : profile?.status === 'PENDING'
      ? '🟡 Pending Admin Whitelist'
      : '⚪ Offline Local Mode';

    const statHighScore = document.getElementById('statHighScore');
    if (statHighScore) statHighScore.textContent = `${save.stats.highScore || 0}`;

    // Prominent Infinite Survival High Score Hero Card
    const statSurvivalBestTime = document.getElementById('statSurvivalBestTime');
    if (statSurvivalBestTime) statSurvivalBestTime.textContent = this.formatSurvivalTime(save.stats.endlessBestTime || 0);

    const statSurvivalThreat = document.getElementById('statSurvivalThreat');
    if (statSurvivalThreat) statSurvivalThreat.textContent = `Threat LV. ${save.stats.endlessBestLevel || 1}`;

    const statSurvivalScoreRating = document.getElementById('statSurvivalScoreRating');
    if (statSurvivalScoreRating) {
      const survSecs = save.stats.endlessBestTime || 0;
      const survThreat = save.stats.endlessBestLevel || 1;
      const pts = Math.round(survSecs * 100 + (survThreat - 1) * 500);
      statSurvivalScoreRating.textContent = `${pts.toLocaleString()} pts`;
    }

    const statEndlessTime = document.getElementById('statEndlessTime');
    if (statEndlessTime) {
      const bestT = this.formatSurvivalTime(save.stats.endlessBestTime || 0);
      statEndlessTime.textContent = `${bestT}`;
    }
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
