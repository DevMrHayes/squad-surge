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
    onHUDUpdate: (level, left, total, coins) => {
      if (ui) ui.updateHUD(level, left, total, coins);
    },
    onGameOver: (won, coins, reason) => {
      if (ui) ui.showResult(won, coins, reason);
    },
  });

  ui = new UIController(game);

  window.addEventListener('resize', () => {
    game.resize();
  });

  // Handle PWA Service Worker Registration & Live Auto-Update
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version installed! Reloading to apply updates...');
              window.location.reload();
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

  // Firebase Auth background initialization with Player Account Whitelist
  initAuthListener(async (profile) => {
    if (profile) {
      console.log('[Auth] Signed in as:', profile.email, 'Role:', profile.role, 'Status:', profile.status);
      if (profile.status === 'APPROVED') {
        await storage.syncWithCloud();
        const currentSave = storage.getSave();
        game.initLevel(currentSave.level);
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
