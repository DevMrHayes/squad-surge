# Squad Surge: 100-Level Tactical Highway

> A fast-paced, mobile-first HTML5 Canvas tactical lane puzzle-shooter featuring a 100-level tactical campaign across 5 sector biomes, dynamic squad cluster formations, specialist morphs (Sniper, Vanguard, EMP Mortar), interactive field obstacles (Ricochet Prism Mirrors, Sacrifice Altars, Speed/Hazard Strips), linked Shield Bearers, Healer Drones, and multi-phase breakable bosses.

---

## 🚀 Live Mobile & Web Access

- **Live URL:** [https://squad-surge-game.web.app](https://squad-surge-game.web.app)
- **Installable PWA:** Open in mobile Safari or Chrome and tap **"Add to Home Screen"** for full-screen tactile play.

---

## ⚡ Tech Stack

- **Game Engine:** HTML5 2D Canvas with procedural vector rendering at 60 FPS
- **Framework & Tooling:** TypeScript 5.7, Vite 6, Tailwind CSS 3.4
- **Audio:** Web Audio API procedural synthesizer (zero audio asset latency)
- **Backend & Cloud:** Firebase Auth (Anonymous & Google Sign-In) + Cloud Firestore
- **Hosting:** Google Cloud Platform / Firebase Hosting

---

## 🕹️ Controls & Single-Thumb Ergonomics

- **Single-Thumb Slide:** Touch/drag anywhere on screen or within the dedicated thumb track under the defense line (`H - 108`).
- **Tactical Decisions:** Choose when to charge gates, when to slide over to intercept charging sprinters, and whether to sacrifice troops at conversion altars for evolved weapons.

---

## 🧪 Testing

```bash
npm test
```
All 9 automated test suites validate biome mapping, boss intervals, prism ricochet math, altar conversions, shield tethers, boss enrage mechanics, and specialist classes.
