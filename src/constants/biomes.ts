// Sector Biome Configurations & Rules for Levels 1 - 100
import { BiomeConfig, SectorId } from '../types/game';

export const SECTOR_BIOMES: Record<SectorId, BiomeConfig> = {
  1: {
    id: 1,
    name: 'Sector 1: Tactical Highway',
    theme: 'Standard Industrial Defense Line',
    roadColor: '#0a0f1d',
    laneLineColor: '#1e293b',
    ambientColor: '#38bdf8',
    accentColor: '#0284c7',
    ruleTitle: 'Split-Lane Dilemma',
    ruleDesc: 'Enemies rush the opposite lane while gates absorb your firepower. Prioritize survival over greed.',
    bgGlow: 'rgba(56, 189, 248, 0.05)',
  },
  2: {
    id: 2,
    name: 'Sector 2: Cryo Permafrost',
    theme: 'Sub-Zero Drift & Glacial Slipstream',
    roadColor: '#081326',
    laneLineColor: '#1e3a5f',
    ambientColor: '#67e8f9',
    accentColor: '#06b6d4',
    ruleTitle: 'Sliding Gates & Sprinter Swarms',
    ruleDesc: 'Reinforcement gates oscillate horizontally. Fast sprinters charge through narrow openings.',
    bgGlow: 'rgba(103, 232, 249, 0.08)',
  },
  3: {
    id: 3,
    name: 'Sector 3: The Foundry Phalanx',
    theme: 'Molten Alloy & Heavy Armor Phalanxes',
    roadColor: '#170c0c',
    laneLineColor: '#451a1a',
    ambientColor: '#fb923c',
    accentColor: '#ea580c',
    ruleTitle: 'Ricochet Prism Bumpers',
    ruleDesc: 'Deflect shots diagonally off angled prism bumpers to charge gates while shredding armor phalanxes.',
    bgGlow: 'rgba(251, 146, 60, 0.08)',
  },
  4: {
    id: 4,
    name: 'Sector 4: High-Voltage Grid',
    theme: 'Electrified Corridors & Tethered Shields',
    roadColor: '#0e0b1f',
    laneLineColor: '#2e1065',
    ambientColor: '#a855f7',
    accentColor: '#9333ea',
    ruleTitle: 'Linked Shields & Sacrifice Altars',
    ruleDesc: 'Shield Bearers make enemies immune until neutralized. Trade troops at Altars for permanent Laser weapons.',
    bgGlow: 'rgba(168, 85, 247, 0.08)',
  },
  5: {
    id: 5,
    name: 'Sector 5: Quantum Singularity',
    theme: 'Subatomic Tachyon Grid & Polarity Flux',
    roadColor: '#090514',
    laneLineColor: '#3b0764',
    ambientColor: '#ec4899',
    accentColor: '#db2777',
    ruleTitle: 'Flip-Polarity Gates & Dual-Phase Titans',
    ruleDesc: 'Gates toggle between [+] and [-] every 3 seconds. Multi-phase Titans spawn explosive mines.',
    bgGlow: 'rgba(236, 72, 153, 0.09)',
  },
};

export function getSectorForLevel(level: number): SectorId {
  if (level <= 20) return 1;
  if (level <= 40) return 2;
  if (level <= 60) return 3;
  if (level <= 80) return 4;
  return 5;
}

export const ACHIEVEMENTS_CATALOG = [
  { id: 'first_blood', title: 'First Drop', desc: 'Clear Level 1 of the tactical highway.', icon: '🎯', rewardCoins: 100 },
  { id: 'squad_50', title: 'Tactical Division', desc: 'Grow your active squad to 50+ soldiers.', icon: '🛡️', rewardCoins: 150 },
  { id: 'ricochet_master', title: 'Angle of Attack', desc: 'Eliminate 15 enemies using prism deflections.', icon: '📐', rewardCoins: 200 },
  { id: 'altar_convert', title: 'Ultimate Sacrifice', desc: 'Trade troops at a Sacrifice Altar for an evolved weapon.', icon: '⚡', rewardCoins: 250 },
  { id: 'sniper_elite', title: 'Piercing Precision', desc: 'Field 5 Cyan Sniper Specialists simultaneously.', icon: '🔭', rewardCoins: 200 },
  { id: 'warden_down', title: 'Warden Breaker', desc: 'Defeat your first Sector Warden boss.', icon: '👑', rewardCoins: 300 },
  { id: 'titan_slayer', title: 'Titan Obliterator', desc: 'Topple a Level 10/20/30+ Multi-Phase Titan.', icon: '☠️', rewardCoins: 500 },
  { id: 'quantum_leap', title: 'Tachyon Master', desc: 'Reach the Quantum Sector (Level 81+).', icon: '🌌', rewardCoins: 1000 },
];
