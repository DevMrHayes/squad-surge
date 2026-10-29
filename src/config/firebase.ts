// Firebase Authentication & Cloud Firestore Integration with Whitelist Admin Approval
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
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
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'shipyard-cat-game.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'shipyard-cat-game',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'shipyard-cat-game.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '311874067924',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const PRIMARY_ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'hayesorhaze@gmail.com').toLowerCase();

let app: any = null;
let auth: any = null;
let db: any = null;
let currentUser: User | null = null;
let currentProfile: UserAccountProfile | null = null;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
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
  const userRef = doc(db, 'squad_surge_users', user.uid);
  const snap = await getDoc(userRef);
  const userEmail = (user.email || '').toLowerCase();
  const isAdmin = userEmail === PRIMARY_ADMIN_EMAIL;

  if (snap.exists()) {
    const data = snap.data() as UserAccountProfile;
    // Enforce admin privileges if user matches primary admin email
    if (isAdmin && (data.role !== 'ADMIN' || data.status !== 'APPROVED')) {
      data.role = 'ADMIN';
      data.status = 'APPROVED';
      await updateDoc(userRef, { role: 'ADMIN', status: 'APPROVED', lastLoginAt: Date.now() });
    } else {
      await updateDoc(userRef, { lastLoginAt: Date.now() }).catch(() => {});
    }
    currentProfile = data;
    return data;
  }

  // Create new profile
  const newProfile: UserAccountProfile = {
    uid: user.uid,
    email: user.email || 'commander@squadsurge.local',
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
      },
      achievements: {},
    },
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  await setDoc(userRef, newProfile);
  currentProfile = newProfile;
  return newProfile;
}

export function initAuthListener(onProfileLoaded: (profile: UserAccountProfile | null) => void) {
  if (!auth) {
    onProfileLoaded(null);
    return;
  }
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
  const cred = await signInWithPopup(auth, provider);
  currentUser = cred.user;
  return await getOrCreateUserProfile(cred.user);
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
      serverTimestamp: serverTimestamp(),
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
