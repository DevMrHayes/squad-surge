// Firebase Authentication & Cloud Firestore Integration
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { SaveData } from '../types/game';

// Web App SDK Config for project 'shipyard-cat-game'
const firebaseConfig = {
  projectId: "shipyard-cat-game",
  appId: "1:311874067924:web:473cb5eb067288dfa54a41",
  storageBucket: "shipyard-cat-game.firebasestorage.app",
  apiKey: "AIzaSy_REDACTED_API_KEY_USE_ENV",
  authDomain: "shipyard-cat-game.firebaseapp.com",
  messagingSenderId: "311874067924",
};

let app: any = null;
let auth: any = null;
let db: any = null;
let currentUser: User | null = null;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn('[Firebase] Initialization offline fallback:', err);
}

export function initAuthListener(onUserChanged: (user: User | null) => void) {
  if (!auth) {
    onUserChanged(null);
    return;
  }
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    onUserChanged(user);
  });
}

export async function loginAnonymously(): Promise<User | null> {
  if (!auth) return null;
  try {
    const cred = await signInAnonymously(auth);
    currentUser = cred.user;
    return cred.user;
  } catch (err) {
    console.warn('[Auth] Anonymous sign-in failed, proceeding in offline mode:', err);
    return null;
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  if (!auth) return null;
  try {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    currentUser = cred.user;
    return cred.user;
  } catch (err) {
    console.error('[Auth] Google sign-in failed:', err);
    throw err;
  }
}

export async function saveProfileToCloud(saveData: SaveData): Promise<boolean> {
  if (!db || !currentUser) return false;
  try {
    const userDocRef = doc(db, 'squad_surge_players', currentUser.uid);
    await setDoc(userDocRef, {
      ...saveData,
      userId: currentUser.uid,
      displayName: currentUser.displayName || 'Commander',
      lastSyncedAt: Date.now(),
      serverTimestamp: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Cloud sync skipped/failed:', err);
    return false;
  }
}

export async function loadProfileFromCloud(): Promise<Partial<SaveData> | null> {
  if (!db || !currentUser) return null;
  try {
    const userDocRef = doc(db, 'squad_surge_players', currentUser.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as Partial<SaveData>;
    }
  } catch (err) {
    console.warn('[Firestore] Could not load cloud save:', err);
  }
  return null;
}

export function getCurrentUser(): User | null {
  return currentUser;
}
