import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBrq6hPRqTLrWoE5metUgIpXPeBk8k2ljc",
  authDomain: "samrtboard.firebaseapp.com",
  projectId: "samrtboard",
  storageBucket: "samrtboard.firebasestorage.app",
  messagingSenderId: "606884655831",
  appId: "1:606884655831:web:92493103cbc230a9373692",
  measurementId: "G-42ZBVCEBXN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Offline cache shared safely by ALL open tabs of the app (multi-tab mode).
// The previous single-tab mode (enableIndexedDbPersistence) made a second tab lose the cache and
// crash on its next write with "INTERNAL ASSERTION FAILED: Unexpected state ... Failed to obtain
// exclusive access to the persistence layer".
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (err) {
  // Already initialized (e.g. hot reload) or the browser can't persist: use the existing/default instance
  console.warn('Firestore offline cache not enabled:', err);
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
