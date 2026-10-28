// Squad Surge: Core Game Types & Data Structures

export type SectorId = 1 | 2 | 3 | 4 | 5;

export interface BiomeConfig {
  id: SectorId;
  name: string;
  theme: string;
  roadColor: string;
  laneLineColor: string;
  ambientColor: string;
  accentColor: string;
  ruleTitle: string;
  ruleDesc: string;
  bgGlow: string;
}

export type SpecialistType = 'STANDARD' | 'SNIPER' | 'VANGUARD' | 'MORTAR';

export interface SquadMember {
  id: number;
  relX: number;
  relY: number;
  type: SpecialistType;
  color: string;
}

export interface PlayerState {
  x: number;
  y: number;
  count: number;
  maxVisualBarrels: number;
  fireTimer: number;
  sniperTimer: number;
  vanguardTimer: number;
  mortarTimer: number;
  members: SquadMember[];
  specialists: {
    sniper: number;
    vanguard: number;
    mortar: number;
  };
  buffs: {
    apTimer: number;
    cryoTimer: number;
    rapidTimer: number;
    blastTimer: number;
    shieldHp: number;
    laserWeapon: boolean;
    homingMissiles: boolean;
  };
  dragSpeedMultiplier: number;
  fireRateMultiplier: number;
}

export type GateType = 'MATH' | 'CRATE' | 'ALTAR' | 'QUANTUM';
export type MathOp = '+' | 'x';

export interface Gate {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  lane: 'LEFT' | 'RIGHT' | 'CENTER';
  type: GateType;
  op: MathOp;
  val: number;
  chargeHits: number;
  hitsPerStep: number;
  maxVal: number;
  lockHp: number;
  maxLockHp: number;
  isUnlocked: boolean;
  boostKey?: 'ap' | 'cryo' | 'rapid' | 'blast' | 'shield' | 'sniper' | 'vanguard' | 'mortar';
  altarSacrificeCost?: number;
  altarWeaponReward?: 'laserWeapon' | 'homingMissiles';
  sliding?: boolean;
  slideSpeed?: number;
  slideDir?: number;
  flipPolarity?: boolean;
  polarityTimer?: number;
  isConsumed?: boolean;
}

export type ObstacleType = 'PRISM_MIRROR' | 'SPEED_STRIP' | 'HAZARD_STRIP';

export interface FieldObstacle {
  id: number;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  angleDeg: number; // 45 or -45 for ricochet bumper
  lane: 'LEFT' | 'RIGHT' | 'CENTER';
  overclockRate?: number;
  dragFactor?: number;
  active: boolean;
}

export type EnemyType = 
  | 'GRUNT' 
  | 'SPRINTER' 
  | 'ARMORED_BRUTE' 
  | 'ARTILLERY' 
  | 'EXPLOSIVE_MINE' 
  | 'SHIELD_BEARER' 
  | 'HEALER_DRONE' 
  | 'WARDEN_BOSS' 
  | 'TITAN_BOSS';

export interface BossArmorPlate {
  id: 'left' | 'right';
  hp: number;
  maxHp: number;
  broken: boolean;
  relX: number;
  relY: number;
  w: number;
  h: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  scoreVal: number;
  isBoss: boolean;
  isSprinter?: boolean;
  isShooter?: boolean;
  shootTimer?: number;
  artilleryTargetX?: number;
  shielded?: boolean;
  shieldSourceId?: number;
  healTimer?: number;
  bossPhase?: number;
  armorPlates?: BossArmorPlate[];
  enraged?: boolean;
  enrageDeployed?: boolean;
  isSlowed?: boolean;
  slowTimer?: number;
  active: boolean;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  color: string;
  isPierce?: boolean;
  isBlast?: boolean;
  isCryo?: boolean;
  isLaser?: boolean;
  isHoming?: boolean;
  isMortar?: boolean;
  isFromPlayer: boolean;
  ricochetsLeft?: number;
  targetEnemyId?: number;
  mortarArc?: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    progress: number;
    duration: number;
  };
  active: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  life: number;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  fontSize: number;
  alpha: number;
  life: number;
}

export interface LevelPlan {
  level: number;
  sector: SectorId;
  biome: BiomeConfig;
  totalEnemies: number;
  isBossLevel: boolean;
  isTitanLevel: boolean;
  coinReward: number;
  waves: WaveStep[];
  features: string[];
}

export interface WaveStep {
  spawnYOffset: number;
  gates?: Partial<Gate>[];
  obstacles?: Partial<FieldObstacle>[];
  enemies?: {
    type: EnemyType;
    lane: 'LEFT' | 'RIGHT' | 'CENTER';
    count: number;
    spacingY?: number;
  }[];
}

export interface SaveData {
  version: number;
  level: number;
  maxLevel: number;
  coins: number;
  upgrades: {
    startSquad: number;
    firepower: number;
    fireRate: number;
    armorPierce: number;
    specialistChance: number;
  };
  stats: {
    totalKills: number;
    bossesDefeated: number;
    gatesCharged: number;
    altarsUsed: number;
    ricochetKills: number;
    highestSquad: number;
    gamesPlayed: number;
    victories: number;
  };
  achievements: Record<string, boolean>;
  userId?: string;
  displayName?: string;
  lastSyncedAt?: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  rewardCoins: number;
}
