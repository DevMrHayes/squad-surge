// Persistent Storage & Cloud Synchronization Manager
import { SaveData } from '../types/game';
import { saveProfileToCloud, loadProfileFromCloud } from '../config/firebase';

const STORAGE_KEY = 'squad_surge_save_v1';

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  level: 1,
  maxLevel: 1,
  coins: 150,
  selectedPerkIdx: 0,
  upgrades: {
    startSquad: 1,
    firepower: 1,
    fireRate: 1,
    armorPierce: 1,
    specialistChance: 1,
  },
  stats: {
    totalKills: 0,
    bossesDefeated: 0,
    gatesCharged: 0,
    altarsUsed: 0,
    ricochetKills: 0,
    highestSquad: 5,
    gamesPlayed: 0,
    victories: 0,
    highScore: 0,
    endlessBestTime: 0,
    endlessBestLevel: 1,
  },
  achievements: {},
};

export class StorageManager {
  private currentSave: SaveData;
  private onSaveUpdatedCallbacks: ((save: SaveData) => void)[] = [];

  constructor() {
    this.currentSave = this.loadLocal();
  }

  public getSave(): SaveData {
    return this.currentSave;
  }

  public onUpdate(cb: (save: SaveData) => void) {
    this.onSaveUpdatedCallbacks.push(cb);
  }

  private notify() {
    this.onSaveUpdatedCallbacks.forEach(cb => cb(this.currentSave));
  }

  private loadLocal(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SAVE));
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SAVE,
        ...parsed,
        upgrades: { ...DEFAULT_SAVE.upgrades, ...(parsed.upgrades || {}) },
        stats: { ...DEFAULT_SAVE.stats, ...(parsed.stats || {}) },
        achievements: { ...(parsed.achievements || {}) },
      };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }
  }

  public saveLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentSave));
      this.notify();
      // Debounced fire-and-forget sync to Firebase
      saveProfileToCloud(this.currentSave).catch(() => {});
    } catch (e) {
      console.error('[Storage] Error saving state:', e);
    }
  }

  public async syncWithCloud(): Promise<void> {
    const cloudSave = await loadProfileFromCloud();
    if (cloudSave) {
      // Merge favoring higher progress
      this.currentSave.level = Math.max(this.currentSave.level, cloudSave.level || 1);
      this.currentSave.maxLevel = Math.max(this.currentSave.maxLevel, cloudSave.maxLevel || 1);
      this.currentSave.coins = Math.max(this.currentSave.coins, cloudSave.coins || 0);
      
      if (cloudSave.upgrades) {
        for (const [k, v] of Object.entries(cloudSave.upgrades)) {
          const key = k as keyof typeof this.currentSave.upgrades;
          this.currentSave.upgrades[key] = Math.max(this.currentSave.upgrades[key] || 1, v || 1);
        }
      }
      if (cloudSave.stats) {
        for (const [k, v] of Object.entries(cloudSave.stats)) {
          const key = k as keyof typeof this.currentSave.stats;
          this.currentSave.stats[key] = Math.max(this.currentSave.stats[key] || 0, v || 0);
        }
      }
      if (cloudSave.achievements) {
        this.currentSave.achievements = {
          ...this.currentSave.achievements,
          ...cloudSave.achievements,
        };
      }
      this.saveLocal();
    }
  }

  public getUpgradeCost(key: keyof SaveData['upgrades']): number {
    const lv = this.currentSave.upgrades[key] || 1;
    const baseMap: Record<keyof SaveData['upgrades'], number> = {
      startSquad: 30,
      firepower: 35,
      fireRate: 40,
      armorPierce: 50,
      specialistChance: 60,
    };
    const base = baseMap[key] || 35;
    return Math.round(base * Math.pow(1.36, lv - 1));
  }

  public buyUpgrade(key: keyof SaveData['upgrades']): boolean {
    const cost = this.getUpgradeCost(key);
    if (this.currentSave.coins >= cost) {
      this.currentSave.coins -= cost;
      this.currentSave.upgrades[key] = (this.currentSave.upgrades[key] || 1) + 1;
      this.saveLocal();
      return true;
    }
    return false;
  }

  public recordWin(level: number, coinsEarned: number): void {
    this.currentSave.coins += coinsEarned;
    this.currentSave.stats.victories += 1;
    this.currentSave.stats.gamesPlayed += 1;
    this.currentSave.maxLevel = Math.max(this.currentSave.maxLevel, Math.min(100, level + 1));
    this.currentSave.level = Math.min(100, level + 1);
    this.saveLocal();
  }

  public recordLoss(coinsEarned: number): void {
    this.currentSave.coins += coinsEarned;
    this.currentSave.stats.gamesPlayed += 1;
    this.saveLocal();
  }

  public recordEndlessRun(timeSurvived: number, threatLevel: number, coinsEarned: number): { isNewRecord: boolean; prevBest: number } {
    this.currentSave.coins += coinsEarned;
    this.currentSave.stats.gamesPlayed += 1;
    const prevBest = this.currentSave.stats.endlessBestTime || 0;
    const isNewRecord = timeSurvived > prevBest;
    if (isNewRecord) {
      this.currentSave.stats.endlessBestTime = Math.round(timeSurvived * 10) / 10;
      this.currentSave.stats.endlessBestLevel = Math.max(this.currentSave.stats.endlessBestLevel || 1, threatLevel);
      this.currentSave.stats.highScore = Math.max(this.currentSave.stats.highScore || 0, Math.round(timeSurvived * 100));
    }
    this.saveLocal();
    return { isNewRecord, prevBest };
  }

  public unlockAchievement(id: string, reward: number): boolean {
    if (!this.currentSave.achievements[id]) {
      this.currentSave.achievements[id] = true;
      this.currentSave.coins += reward;
      this.saveLocal();
      return true;
    }
    return false;
  }
}

export const storage = new StorageManager();
