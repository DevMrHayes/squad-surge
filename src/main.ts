// Squad Surge: Main Application Entry Point
import './style.css';
import { GameLoop } from './engine/gameLoop';
import { UIController } from './ui/uiController';
import { initAuthListener } from './config/firebase';
import { storage } from './services/storage';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (!canvas) return;

  let ui: UIController;

  const game = new GameLoop(canvas, {
    onHUDUpdate: (level, left, total, coins, isEndless, endlessTime, endlessThreat) => {
      if (ui) ui.updateHUD(level, left, total, coins, isEndless, endlessTime, endlessThreat);
    },
    onGameOver: (won, coins, reason, details) => {
      if (ui) ui.showResult(won, coins, reason, details);
    },
  });

  ui = new UIController(game);

  window.addEventListener('resize', () => {
    game.resize();
  });

  // Handle PWA Service Worker Registration & Non-Intrusive Auto-Update
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version installed!');
              // Do NOT abruptly abort active gameplay; only reload if not in active combat
              if (game.mode !== 'PLAYING') {
                window.location.reload();
              } else {
                console.log('[PWA] Deferring reload until return to tactical menu.');
              }
            }
          });
        }
      });
      // Force immediate check for fresh bundle
      reg.update().catch(() => {});
      console.log('[PWA] Service Worker registered successfully.');
    } catch (e) {
      console.warn('[PWA] Service worker registration error:', e);
    }
  }

  // Keep active level & briefing synchronized when real-time cloud snapshot updates progression
  storage.onUpdate((updatedSave) => {
    if (game.mode !== 'PLAYING' && !game.isEndless && game.currentLevel < updatedSave.level) {
      game.initLevel(updatedSave.level, false);
      if (ui) ui.showStartBriefing();
    } else if (game.mode !== 'PLAYING' && ui) {
      ui.updateHUD(
        game.currentLevel,
        game.enemiesLeft,
        game.totalEnemiesInLevel,
        updatedSave.coins,
        game.isEndless,
        game.endlessTimeSurvived,
        game.endlessThreatLevel
      );
    }
  });

  // Re-sync with cloud when switching devices / returning to app tab
  const syncOnResume = () => {
    if (document.visibilityState === 'visible') {
      storage.syncWithCloud().catch(() => {});
    }
  };
  window.addEventListener('focus', syncOnResume);
  document.addEventListener('visibilitychange', syncOnResume);

  // Firebase Auth background initialization with Player Account Whitelist
  initAuthListener(async (profile) => {
    if (profile) {
      console.log('[Auth] Signed in as:', profile.email, 'Role:', profile.role, 'Status:', profile.status);
      if (profile.status === 'APPROVED') {
        await storage.syncWithCloud();
        const currentSave = storage.getSave();
        // Never disrupt an active Endless Survival session or active combat
        if (game.mode !== 'PLAYING') {
          if (!game.isEndless) {
            game.initLevel(currentSave.level, false);
          }
          ui.showStartBriefing();
        }
      }
    }
    ui.handleAuthStateChange(profile);
  });

  // Start with pre-level briefing for Level 1 (or current saved level)
  const save = storage.getSave();
  game.initLevel(save.level);
  ui.showStartBriefing();
  game.start();
});
