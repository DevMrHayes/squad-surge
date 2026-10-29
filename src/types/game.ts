// Squad Surge: Core Game Types & Time-Scheduled Data Structures

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

export interface TailoredPerk {
  id: string;
  icon: string;
  name: string;
  desc: string;
  bonusSquad: number;
  gateChargeMult: number;
  fireRateMult: number;
  startShield: number;
}

export interface PlayerState {
  x: number;
  y: number;
  count: number;
  shields: number;
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
    laserWeapon: boolean;
    homingMissiles: boolean;
  };
  dragSpeedMultiplier: number;
  fireRateMultiplier: number;
}

export type GateKind = 'CHARGE_ADD' | 'LOCKED_MULT' | 'BUFF_GATE' | 'HAZARD' | 'ALTAR' | 'QUANTUM';

export interface Gate {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  lane: 'LEFT' | 'RIGHT' | 'CENTER';
  kind: GateKind;
  val: number;
  maxVal: number;
  chargeHits: number;
  hitsPerStep: number;
  lockHitsRemaining: number;
  lockHitsMax: number;
  unlocked: boolean;
  boostType?: 'AP' | 'CRYO' | 'BLAST' | 'FIRERATE' | 'SHIELD' | 'SNIPER' | 'VANGUARD' | 'MORTAR';
  label?: string;
  color?: string;
  hitScale: number;
  altarSacrificeCost?: number;
  altarWeaponReward?: 'laserWeapon' | 'homingMissiles';
  sliding?: boolean;
  slideSpeed?: number;
  slideDir?: number;
  flipPolarity?: boolean;
  polarityTimer?: number;
  pairId?: number;
  shattered?: boolean;
}

export interface Crate {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  boostType: 'AP' | 'CRYO' | 'BLAST' | 'FIRERATE' | 'SHIELD' | 'SNIPER' | 'VANGUARD' | 'MORTAR';
  label: string;
  color: string;
  hitScale: number;
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
  | 'RUNNER' 
  | 'SPRINTER' 
  | 'BRUTE' 
  | 'SHOOTER' 
  | 'MINE' 
  | 'SHIELD_BEARER' 
  | 'HEALER_DRONE' 
  | 'CAPTAIN' 
  | 'WARDEN' 
  | 'TITAN';

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
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  scoreVal: number;
  color: string;
  armored: boolean;
  isBoss: boolean;
  name?: string;
  slowTimer: number;
  shootCooldown: number;
  hitFlash: number;
  shielded?: boolean;
  shieldSourceId?: number;
  healTimer?: number;
  bossPhase: number;
  armorPlates?: BossArmorPlate[];
  enraged?: boolean;
  enrageDeployed?: boolean;
  active: boolean;
}

export interface EnemyMortarShell {
  x: number;
  y: number;
  targetX: number;
  vx: number;
  vy: number;
  squadLoss: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  gateCharge: number;
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
  maxLife: number;
  isSpark?: boolean;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  lineWidth: number;
  alpha: number;
  decay: number;
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

// Scheduled Items
export interface GateQueueItem {
  spawnTime: number;
  lane: number; // 0 = Left, 1 = Right
  kind: GateKind;
  val?: number;
  maxVal?: number;
  hitsPerStep?: number;
  lockHitsRemaining?: number;
  lockHitsMax?: number;
  boostType?: 'AP' | 'CRYO' | 'BLAST' | 'FIRERATE' | 'SHIELD' | 'SNIPER' | 'VANGUARD' | 'MORTAR';
  label?: string;
  color?: string;
  altarSacrificeCost?: number;
  altarWeaponReward?: 'laserWeapon' | 'homingMissiles';
  sliding?: boolean;
  flipPolarity?: boolean;
  pairId?: number;
}

export interface CrateQueueItem {
  spawnTime: number;
  lane3: number; // 0, 1, 2
  hp: number;
  maxHp: number;
  boostType: 'AP' | 'CRYO' | 'BLAST' | 'FIRERATE' | 'SHIELD' | 'SNIPER' | 'VANGUARD' | 'MORTAR';
  label: string;
  color: string;
}

export interface EnemyScheduleItem {
  spawnTime: number;
  xNorm: number;
  kind: EnemyType;
  hp: number;
  maxHp: number;
  speedMult: number;
  name?: string;
}

export interface ObstacleQueueItem {
  spawnTime: number;
  type: ObstacleType;
  lane: 'LEFT' | 'RIGHT' | 'CENTER';
  angleDeg: number;
  overclockRate?: number;
  dragFactor?: number;
}

export type MissionArchetype = 
  | 'SWARM_INFILTRATION' 
  | 'ARMORED_SIEGE' 
  | 'ARTILLERY_STORM' 
  | 'PRECISION_GRID' 
  | 'CONVERSION_ZONE' 
  | 'TITAN_SHOWDOWN';

export interface MissionArchetypeConfig {
  id: MissionArchetype;
  badge: string;
  badgeColor: string;
  title: string;
  advisory: string;
  featuredBuff: string;
}

export interface LevelPlan {
  level: number;
  sector: SectorId;
  biome: BiomeConfig;
  archetype: MissionArchetypeConfig;
  tier: number;
  isBossLevel: boolean;
  isTitanLevel: boolean;
  scrollSpeed: number;
  totalEnemies: number;
  gateQueue: GateQueueItem[];
  crateQueue: CrateQueueItem[];
  enemySchedule: EnemyScheduleItem[];
  obstacleQueue: ObstacleQueueItem[];
  coinReward: number;
}

export interface SaveData {
  version: number;
  level: number;
  maxLevel: number;
  coins: number;
  selectedPerkIdx: number;
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
    highScore?: number;
  };
  achievements: Record<string, boolean>;
  userId?: string;
  displayName?: string;
  lastSyncedAt?: number;
}

export type UserRole = 'ADMIN' | 'PLAYER';
export type UserApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

export interface UserAccountProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserApprovalStatus;
  saveData: SaveData;
  createdAt: number;
  lastLoginAt: number;
  approvedBy?: string;
  approvedAt?: number;
}
