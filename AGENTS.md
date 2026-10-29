# Squad Surge: 100-Level Tactical Highway — Agent Guide

Welcome to **Squad Surge: 100-Level Tactical Highway**, an official development project in the Antigravity portfolio.

---

## 🎮 Game Architecture Overview

1. **Core Loop:** The player slides a dynamic squad formation horizontally along a raised defense line (`y = H - 108`), leaving a dedicated thumb track underneath.
2. **5 Sector Biomes (100 Levels):**
   - **Sector 1 (1–20) Standard Highway:** Core math gates, split-lane dilemmas, Speed Strips.
   - **Sector 2 (21–40) Cryo Permafrost:** Horizontally oscillating gates, Sprinter swarms, Hazard strips.
   - **Sector 3 (41–60) Foundry Phalanx:** Angled Ricochet Prism bumpers, heavy armor phalanxes.
   - **Sector 4 (61–80) High-Voltage Grid:** Linked Shield Bearers with invulnerability beams, Healer Drones, and Sacrifice Conversion Altars.
   - **Sector 5 (81–100) Quantum Singularity:** Flip-polarity `+/-` gates, Dual-phase Titans with detachable armor plates and enrage minefields.
3. **Squad Specialist Morphs (Phase 3):**
   - **Cyan Sniper (💎):** Piercing railgun shot that passes through gates and shields.
   - **Orange Vanguard (⚡):** Wide cone shotgun blast melting nearby sprinters.
   - **Yellow EMP Mortar (🟡):** Arcing mortar shells detonating over gates onto backline drones.
4. **Interactive Field Obstacles (Phase 1):**
   - **Ricochet Prism Mirrors:** Bounces bullets diagonally across lanes.
   - **Sacrifice Altars:** Consumes squad troops in exchange for permanent weapon overclocks (Piercing Lasers or Homing Micro-Missiles).
   - **Speed/Hazard Strips:** +50% fire rate overclock or movement drag zones.
5. **Enemy Synergies & Multi-Phase Bosses (Phase 2):**
   - **Shield Bearers:** Projects tethered immunity aura.
   - **Healer Drones:** Periodically heals front-rank brutes.
   - **Bosses (Levels % 5 & % 10):** Left/right armor plates break off individually; Phase 2 Enrage activates below 50% HP with explosive mine deployment.

---

## 🛠️ Key Commands

- `npm test`: Runs automated simulation test suite (`node tests/verify-game.cjs`).
- `npm run dev`: Boots local Vite development server on port 5173.
- `npm run build`: Compiles production PWA bundle (`tsc && vite build`).
- `npm run deploy`: Deploys to Google Cloud Firebase Hosting (`https://squad-surge-game.web.app`) and Firestore rules.

---

## ☁️ Cloud, Security & Player Account Approval System

- **Firebase Hosting Site:** `squad-surge-game.web.app` (GCP Project: `shipyard-cat-game`).
- **Secure Credentials:** All Firebase configurations are loaded via Vite environment variables (`.env` with `VITE_FIREBASE_*`). Git repository is sanitized with zero hardcoded API keys.
- **Role-Based Access Control (RBAC):**
  - **Admin Email:** `hayesorhaze@gmail.com` (assigned `ADMIN` role with auto-approval).
  - **Player Accounts:** Players authenticate via Google Sign-In or Email/Password, defaulting to `status: 'PENDING'`.
  - **Admin Approval Queue:** In-game admin modal (`#adminModal`) permits `hayesorhaze@gmail.com` to review and approve/reject pending players.
  - **Firestore Security Rules:** Managed via [`firestore.rules`](./firestore.rules), enforcing strict privilege boundaries so only approved users can persist progress, while only the admin can modify user account statuses.
- **Offline PWA:** Caches assets via `public/sw.js` and installs full-screen to mobile home screens.
