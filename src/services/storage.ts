// Persistent Storage & Cloud Synchronization Manager (with Kindle/Tablet Local Multi-Profile & IndexedDB Backup)
import { SaveData } from '../types/game';
import { saveProfileToCloud, loadProfileFromCloud, onCloudSaveSnapshot } from '../config/firebase';

const STORAGE_KEY = 'squad_surge_save_v1';
const ACTIVE_SLOT_KEY = 'squad_surge_active_slot';
const IDB_NAME = 'SquadSurgeLocalDB';
const IDB_STORE = 'saves';

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
  private activeSlot: number = 1;
  private onSaveUpdatedCallbacks: ((save: SaveData) => void)[] = [];

  constructor() {
    this.activeSlot = this.loadActiveSlot();
    this.currentSave = this.loadLocal();
    this.requestPersistentStorage();
    this.restoreFromIndexedDBIfNeeded();
    onCloudSaveSnapshot((cloudSave) => {
      this.mergeCloudSave(cloudSave, false);
    });
  }

  private getSlotStorageKey(slot: number = this.activeSlot): string {
    return slot <= 1 ? STORAGE_KEY : `${STORAGE_KEY}_slot${slot}`;
  }

  private getSlotNameKey(slot: number = this.activeSlot): string {
    return `squad_surge_local_name_slot${slot}`;
  }

  private loadActiveSlot(): number {
    try {
      const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
      const parsed = Number(raw);
      if (parsed >= 1 && parsed <= 3) return Math.floor(parsed);
    } catch {
      // ignore
    }
    return 1;
  }

  public getActiveSlot(): number {
    return this.activeSlot;
  }

  public getLocalCommanderName(slot: number = this.activeSlot): string {
    try {
      const saved = localStorage.getItem(this.getSlotNameKey(slot));
      if (saved && saved.trim()) return saved.trim();
    } catch {
      // ignore
    }
    return `Commander ${slot}`;
  }

  public setLocalCommanderName(name: string, slot: number = this.activeSlot): void {
    const clean = (name || '').trim().slice(0, 24) || `Commander ${slot}`;
    try {
      localStorage.setItem(this.getSlotNameKey(slot), clean);
      this.writeToIndexedDB(this.getSlotNameKey(slot), clean);
      this.notify();
    } catch {
      // ignore
    }
  }

  public getSlotSummary(slot: number): { slot: number; name: string; level: number; coins: number } {
    try {
      const raw = localStorage.getItem(this.getSlotStorageKey(slot));
      const parsed = raw ? JSON.parse(raw) : DEFAULT_SAVE;
      return {
        slot,
        name: this.getLocalCommanderName(slot),
        level: parsed.level || 1,
        coins: parsed.coins ?? 150,
      };
    } catch {
      return { slot, name: `Commander ${slot}`, level: 1, coins: 150 };
    }
  }

  public switchLocalSlot(slot: number): SaveData {
    const targetSlot = Math.max(1, Math.min(3, Math.floor(slot)));
    this.activeSlot = targetSlot;
    try {
      localStorage.setItem(ACTIVE_SLOT_KEY, String(targetSlot));
    } catch {
      // ignore
    }
    this.currentSave = this.loadLocal();
    this.restoreFromIndexedDBIfNeeded();
    this.notify();
    return this.currentSave;
  }

  private requestPersistentStorage(): void {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }
    } catch {
      // ignore on unsupported browsers
    }
  }

  private writeToIndexedDB(key: string, value: any): void {
    try {
      if (typeof indexedDB === 'undefined') return;
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(value, key);
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
  }

  private restoreFromIndexedDBIfNeeded(): void {
    try {
      if (typeof indexedDB === 'undefined') return;
      const key = this.getSlotStorageKey();
      const hasLocal = typeof localStorage !== 'undefined' && !!localStorage.getItem(key);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get(key);
          getReq.onsuccess = () => {
            const idbSave = getReq.result as SaveData | undefined;
            if (idbSave && (!hasLocal || (idbSave.maxLevel || 1) > (this.currentSave.maxLevel || 1))) {
              this.mergeCloudSave(idbSave, false);
            } else {
              this.writeToIndexedDB(key, this.currentSave);
            }
          };
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
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
      const key = this.getSlotStorageKey();
      const raw = localStorage.getItem(key);
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

  public saveLocal(syncCloud = true): void {
    try {
      const key = this.getSlotStorageKey();
      localStorage.setItem(key, JSON.stringify(this.currentSave));
      this.writeToIndexedDB(key, this.currentSave);
      this.notify();
      if (syncCloud) {
        saveProfileToCloud(this.currentSave).catch(() => {});
      }
    } catch (e) {
      console.error('[Storage] Error saving state:', e);
    }
  }

  public mergeCloudSave(cloudSave: SaveData, forcePushToCloud = false): boolean {
    if (!cloudSave) return false;

    const beforeJson = JSON.stringify(this.currentSave);
    const cloudBeforeJson = JSON.stringify(cloudSave);

    // Merge favoring highest campaign progression across devices
    const mergedMaxLevel = Math.max(
      this.currentSave.maxLevel || 1,
      this.currentSave.level || 1,
      cloudSave.maxLevel || 1,
      cloudSave.level || 1
    );
    const mergedLevel = Math.max(
      this.currentSave.level || 1,
      cloudSave.level || 1,
      mergedMaxLevel
    );

    this.currentSave.level = Math.min(100, mergedLevel);
    this.currentSave.maxLevel = Math.min(100, mergedMaxLevel);
    this.currentSave.coins = Math.max(this.currentSave.coins || 0, cloudSave.coins || 0);

    if (cloudSave.upgrades) {
      for (const [k, v] of Object.entries(cloudSave.upgrades)) {
        const key = k as keyof typeof this.currentSave.upgrades;
        if (key in this.currentSave.upgrades) {
          this.currentSave.upgrades[key] = Math.max(this.currentSave.upgrades[key] || 1, Number(v) || 1);
        }
      }
    }
    if (cloudSave.stats) {
      for (const [k, v] of Object.entries(cloudSave.stats)) {
        const key = k as keyof typeof this.currentSave.stats;
        if (key in this.currentSave.stats) {
          this.currentSave.stats[key] = Math.max(this.currentSave.stats[key] || 0, Number(v) || 0);
        }
      }
    }
    // Ensure endless survival personal bests are explicitly preserved & maximized
    this.currentSave.stats.endlessBestTime = Math.max(
      this.currentSave.stats.endlessBestTime || 0,
      cloudSave.stats?.endlessBestTime || 0
    );
    this.currentSave.stats.endlessBestLevel = Math.max(
      this.currentSave.stats.endlessBestLevel || 1,
      cloudSave.stats?.endlessBestLevel || 1
    );
    if (cloudSave.achievements) {
      this.currentSave.achievements = {
        ...this.currentSave.achievements,
        ...cloudSave.achievements,
      };
    }

    const afterJson = JSON.stringify(this.currentSave);
    const localChanged = beforeJson !== afterJson;
    const cloudNeedsUpdate = forcePushToCloud || afterJson !== cloudBeforeJson;

    if (localChanged || cloudNeedsUpdate) {
      this.saveLocal(cloudNeedsUpdate);
    }
    return localChanged;
  }

  public async syncWithCloud(): Promise<void> {
    const cloudSave = await loadProfileFromCloud();
    if (cloudSave) {
      this.mergeCloudSave(cloudSave, true);
    } else {
      // Ensure current local state is pushed if cloud was empty
      await saveProfileToCloud(this.currentSave).catch(() => {});
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

  public updateEndlessBestTime(timeSurvived: number, threatLevel: number): boolean {
    const prevBest = this.currentSave.stats.endlessBestTime || 0;
    if (timeSurvived > prevBest) {
      this.currentSave.stats.endlessBestTime = Math.round(timeSurvived * 10) / 10;
      this.currentSave.stats.endlessBestLevel = Math.max(this.currentSave.stats.endlessBestLevel || 1, threatLevel);
      this.currentSave.stats.highScore = Math.max(this.currentSave.stats.highScore || 0, Math.round(timeSurvived * 100));
      this.saveLocal();
      return true;
    }
    return false;
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
