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

export async function getOrCreateUserProfile(user: User): Promise<UserAccountProfile> {
  const userEmail = (user.email || '').toLowerCase();
  const isAdmin = userEmail === PRIMARY_ADMIN_EMAIL;

  const defaultProfile: UserAccountProfile = {
    uid: user.uid,
    email: user.email || (isAdmin ? PRIMARY_ADMIN_EMAIL : 'commander@squadsurge.local'),
    displayName: user.displayName || (isAdmin ? 'Chief Commander Hayes' : 'Recruit Commander'),
    photoURL: user.photoURL || undefined,
    role: isAdmin ? 'ADMIN' : 'PLAYER',
    status: isAdmin ? 'APPROVED' : 'PENDING',
    saveData: {
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
      },
      achievements: {},
    },
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
      // Enforce admin privileges if user matches primary admin email
      if (isAdmin && (data.role !== 'ADMIN' || data.status !== 'APPROVED')) {
        data.role = 'ADMIN';
        data.status = 'APPROVED';
        await updateDoc(userRef, { role: 'ADMIN', status: 'APPROVED', lastLoginAt: Date.now() }).catch(() => {});
      } else {
        await updateDoc(userRef, { lastLoginAt: Date.now() }).catch(() => {});
      }
      currentProfile = data;
      return data;
    }

    // New profile creation
    await setDoc(userRef, defaultProfile);
    currentProfile = defaultProfile;
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
  await signOut(auth);
  currentUser = null;
  currentProfile = null;
}

export async function saveProfileToCloud(saveData: SaveData): Promise<boolean> {
  if (!db || !currentUser) return false;
  // Non-approved players cannot overwrite cloud saves
  if (currentProfile && currentProfile.status !== 'APPROVED') return false;

  try {
    const userRef = doc(db, 'squad_surge_users', currentUser.uid);
    await updateDoc(userRef, {
      saveData,
      lastLoginAt: Date.now(),
    });
    if (currentProfile) currentProfile.saveData = saveData;
    return true;
  } catch (err) {
    console.warn('[Firestore] Cloud sync skipped/failed:', err);
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
      currentProfile = data;
      return data.saveData || null;
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
