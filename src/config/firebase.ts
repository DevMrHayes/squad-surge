// Firebase Authentication & Cloud Firestore Integration with Whitelist Admin Approval
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  onSnapshot,
  Unsubscribe,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { SaveData, UserAccountProfile, UserApprovalStatus } from '../types/game';

// Environment-backed configuration (No hardcoded credentials)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'storied-runs.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'storied-runs',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'storied-runs.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '680263310460',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const FIRESTORE_DATABASE_ID = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'squad-surge';
export const PRIMARY_ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'hayesorhaze@gmail.com').toLowerCase();

let app: any = null;
let auth: any = null;
let db: any = null;
let currentUser: User | null = null;
let currentProfile: UserAccountProfile | null = null;
let profileUnsubscribe: Unsubscribe | null = null;
let cloudSaveListeners: ((saveData: SaveData, profile: UserAccountProfile) => void)[] = [];

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app, FIRESTORE_DATABASE_ID);
} catch (err) {
  console.warn('[Firebase] Initialization offline fallback:', err);
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function getCurrentProfile(): UserAccountProfile | null {
  return currentProfile;
}

export function isCurrentAdmin(): boolean {
  if (!currentUser) return false;
  const email = (currentUser.email || '').toLowerCase();
  return email === PRIMARY_ADMIN_EMAIL || (currentProfile?.role === 'ADMIN' && currentProfile?.status === 'APPROVED');
}

export function sanitizeSaveData(raw?: Partial<SaveData> | null): SaveData {
  const s = raw || {};
  const u: Partial<SaveData['upgrades']> = s.upgrades || {};
  const st: Partial<SaveData['stats']> = s.stats || {};
  const rawAchievements = s.achievements || {};
  const cleanAchievements: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(rawAchievements)) {
    if (typeof v === 'boolean') {
      cleanAchievements[k] = v;
    }
  }

  const level = Math.max(1, Math.min(100, Math.floor(Number(s.level) || 1)));
  const maxLevel = Math.max(level, Math.min(100, Math.floor(Number(s.maxLevel) || 1)));

  return {
    version: Number(s.version) || 1,
    level,
    maxLevel,
    coins: Math.max(0, Math.floor(Number(s.coins) ?? 150)),
    selectedPerkIdx: Math.max(0, Math.floor(Number(s.selectedPerkIdx) || 0)),
    upgrades: {
      startSquad: Math.max(1, Math.floor(Number(u.startSquad) || 1)),
      firepower: Math.max(1, Math.floor(Number(u.firepower) || 1)),
      fireRate: Math.max(1, Math.floor(Number(u.fireRate) || 1)),
      armorPierce: Math.max(1, Math.floor(Number(u.armorPierce) || 1)),
      specialistChance: Math.max(1, Math.floor(Number(u.specialistChance) || 1)),
    },
    stats: {
      totalKills: Math.max(0, Math.floor(Number(st.totalKills) || 0)),
      bossesDefeated: Math.max(0, Math.floor(Number(st.bossesDefeated) || 0)),
      gatesCharged: Math.max(0, Math.floor(Number(st.gatesCharged) || 0)),
      altarsUsed: Math.max(0, Math.floor(Number(st.altarsUsed) || 0)),
      ricochetKills: Math.max(0, Math.floor(Number(st.ricochetKills) || 0)),
      highestSquad: Math.max(5, Math.floor(Number(st.highestSquad) || 5)),
      gamesPlayed: Math.max(0, Math.floor(Number(st.gamesPlayed) || 0)),
      victories: Math.max(0, Math.floor(Number(st.victories) || 0)),
      highScore: Math.max(0, Math.floor(Number(st.highScore) || 0)),
      endlessBestTime: Math.max(0, Math.round((Number(st.endlessBestTime) || 0) * 10) / 10),
      endlessBestLevel: Math.max(1, Math.floor(Number(st.endlessBestLevel) || 1)),
    },
    achievements: cleanAchievements,
  };
}

export function onCloudSaveSnapshot(cb: (saveData: SaveData, profile: UserAccountProfile) => void): void {
  cloudSaveListeners.push(cb);
}

function attachRealtimeProfileSubscription(user: User): void {
  if (!db) return;
  if (profileUnsubscribe) {
    profileUnsubscribe();
    profileUnsubscribe = null;
  }

  try {
    const userRef = doc(db, 'squad_surge_users', user.uid);
    profileUnsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as UserAccountProfile;
        currentProfile = data;
        if (data.saveData) {
          const clean = sanitizeSaveData(data.saveData);
          cloudSaveListeners.forEach((cb) => cb(clean, data));
        }
      },
      (err) => {
        console.warn('[Firestore] Real-time profile listener error:', err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Could not attach real-time profile listener:', err);
  }
}

export async function getOrCreateUserProfile(user: User, seedSave?: SaveData): Promise<UserAccountProfile> {
  const userEmail = (user.email || '').toLowerCase();
  const isAdmin = userEmail === PRIMARY_ADMIN_EMAIL;

  let localSeed: Partial<SaveData> | null = seedSave || null;
  if (!localSeed && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('squad_surge_save_v1');
      if (raw) localSeed = JSON.parse(raw);
    } catch {
      // ignore local parse error
    }
  }

  const defaultProfile: UserAccountProfile = {
    uid: user.uid,
    email: user.email || (isAdmin ? PRIMARY_ADMIN_EMAIL : 'commander@squadsurge.local'),
    displayName: user.displayName || (isAdmin ? 'Chief Commander Hayes' : 'Recruit Commander'),
    ...(user.photoURL ? { photoURL: user.photoURL } : {}),
    role: isAdmin ? 'ADMIN' : 'PLAYER',
    status: isAdmin ? 'APPROVED' : 'PENDING',
    saveData: sanitizeSaveData(localSeed),
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  if (!db) {
    currentProfile = defaultProfile;
    return defaultProfile;
  }

  try {
    const userRef = doc(db, 'squad_surge_users', user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data() as UserAccountProfile;
      data.saveData = sanitizeSaveData(data.saveData);
      // Enforce admin privileges if user matches primary admin email
      if (isAdmin && (data.role !== 'ADMIN' || data.status !== 'APPROVED')) {
        data.role = 'ADMIN';
        data.status = 'APPROVED';
        await updateDoc(userRef, { role: 'ADMIN', status: 'APPROVED', lastLoginAt: Date.now() }).catch(() => {});
      } else {
        await updateDoc(userRef, { lastLoginAt: Date.now() }).catch(() => {});
      }
      currentProfile = data;
      attachRealtimeProfileSubscription(user);
      return data;
    }

    // New profile creation (omitting undefined fields so Firestore setDoc never rejects)
    await setDoc(userRef, defaultProfile);
    currentProfile = defaultProfile;
    attachRealtimeProfileSubscription(user);
    return defaultProfile;
  } catch (err) {
    console.warn('[Firestore] Profile store error; activating resilient session fallback:', err);
    currentProfile = defaultProfile;
    return defaultProfile;
  }
}

export function initAuthListener(onProfileLoaded: (profile: UserAccountProfile | null) => void) {
  if (!auth) {
    onProfileLoaded(null);
    return;
  }

  // Resolve pending OAuth redirect result on boot (crucial for mobile web & PWAs)
  getRedirectResult(auth)
    .then(async (cred) => {
      if (cred && cred.user) {
        currentUser = cred.user;
        const profile = await getOrCreateUserProfile(cred.user);
        onProfileLoaded(profile);
      }
    })
    .catch((err) => {
      console.warn('[Auth] Redirect resolution notice:', err);
    });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      try {
        const profile = await getOrCreateUserProfile(user);
        onProfileLoaded(profile);
      } catch (err) {
        console.error('[Auth] Error fetching profile:', err);
        onProfileLoaded(null);
      }
    } else {
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }
      currentProfile = null;
      onProfileLoaded(null);
    }
  });
}

export async function loginWithGoogle(): Promise<UserAccountProfile | null> {
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const cred = await signInWithPopup(auth, provider);
    currentUser = cred.user;
    return await getOrCreateUserProfile(cred.user);
  } catch (err: any) {
    const redirectFallbackCodes = [
      'auth/popup-blocked',
      'auth/operation-not-supported-in-this-environment'
    ];
    if (redirectFallbackCodes.includes(err?.code)) {
      console.warn('[Auth] Popup blocked; triggering redirect flow fallback...');
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function loginWithEmail(email: string, pass: string, isSignUp: boolean): Promise<UserAccountProfile | null> {
  if (!auth) return null;
  const cred = isSignUp
    ? await createUserWithEmailAndPassword(auth, email, pass)
    : await signInWithEmailAndPassword(auth, email, pass);
  currentUser = cred.user;
  return await getOrCreateUserProfile(cred.user);
}

export async function logoutUser(): Promise<void> {
  if (!auth) return;
  if (profileUnsubscribe) {
    profileUnsubscribe();
    profileUnsubscribe = null;
  }
  await signOut(auth);
  currentUser = null;
  currentProfile = null;
}

export async function saveProfileToCloud(saveData: SaveData): Promise<boolean> {
  if (!db || !currentUser) return false;
  // Non-approved players cannot overwrite cloud saves
  if (currentProfile && currentProfile.status !== 'APPROVED') return false;

  const cleanSave = sanitizeSaveData(saveData);

  try {
    const userRef = doc(db, 'squad_surge_users', currentUser.uid);
    await updateDoc(userRef, {
      saveData: cleanSave,
      lastLoginAt: Date.now(),
    });
    if (currentProfile) currentProfile.saveData = cleanSave;
    return true;
  } catch (err) {
    // If document did not exist yet (e.g. previous creation failed before rules update), self-heal via getOrCreateUserProfile
    try {
      const profile = await getOrCreateUserProfile(currentUser, cleanSave);
      if (profile && profile.status === 'APPROVED') {
        const userRef = doc(db, 'squad_surge_users', currentUser.uid);
        await updateDoc(userRef, {
          saveData: cleanSave,
          lastLoginAt: Date.now(),
        });
        if (currentProfile) currentProfile.saveData = cleanSave;
        return true;
      }
    } catch (retryErr) {
      console.warn('[Firestore] Cloud sync retry skipped/failed:', retryErr);
    }
    return false;
  }
}

export async function loadProfileFromCloud(): Promise<SaveData | null> {
  if (!db || !currentUser) return null;
  try {
    const userRef = doc(db, 'squad_surge_users', currentUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserAccountProfile;
      data.saveData = sanitizeSaveData(data.saveData);
      currentProfile = data;
      return data.saveData;
    } else {
      const created = await getOrCreateUserProfile(currentUser);
      return created.saveData || null;
    }
  } catch (err) {
    console.warn('[Firestore] Could not load cloud save:', err);
  }
  return null;
}

// Admin-Only Functions
export async function getPendingUsers(): Promise<UserAccountProfile[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'squad_surge_users'),
      where('status', '==', 'PENDING')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserAccountProfile);
  } catch (err) {
    console.error('[Firestore] Error getting pending users:', err);
    return [];
  }
}

export async function getAllUsers(): Promise<UserAccountProfile[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, 'squad_surge_users'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserAccountProfile);
  } catch (err) {
    console.error('[Firestore] Error getting all users:', err);
    return [];
  }
}

export async function updateUserApproval(targetUid: string, status: UserApprovalStatus): Promise<boolean> {
  if (!db || !currentUser) return false;
  try {
    const userRef = doc(db, 'squad_surge_users', targetUid);
    await updateDoc(userRef, {
      status,
      approvedBy: currentUser.email || PRIMARY_ADMIN_EMAIL,
      approvedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.error('[Firestore] Error updating user approval:', err);
    return false;
  }
}
