// Squad Surge: Main Application Entry Point
import { GameLoop } from './engine/gameLoop';
import { UIController } from './ui/uiController';
import { initAuthListener, loginAnonymously } from './config/firebase';
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

  // Handle PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      console.log('[PWA] Service Worker registered successfully.');
    } catch (e) {
      console.warn('[PWA] Service worker registration error:', e);
    }
  }

  // Firebase Auth background initialization
  initAuthListener(async (user) => {
    if (user) {
      console.log('[Auth] Signed in as:', user.uid);
      await storage.syncWithCloud();
    } else {
      // Auto sign in anonymously for seamless frictionless mobile onboarding
      loginAnonymously().catch(() => {});
    }
  });

  // Start with pre-level briefing for Level 1 (or current saved level)
  const save = storage.getSave();
  game.initLevel(save.level);
  ui.showStartBriefing();
  game.start();
});
