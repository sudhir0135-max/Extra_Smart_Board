import { initializeApp } from 'firebase/app';
import { getFirestore, getDocs, getDoc, doc, collection } from 'firebase/firestore';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBrq6hPRqTLrWoE5metUgIpXPeBk8k2ljc",
  authDomain: "samrtboard.firebaseapp.com",
  projectId: "samrtboard",
  storageBucket: "samrtboard.firebasestorage.app",
  messagingSenderId: "606884655831",
  appId: "1:606884655831:web:92493103cbc230a9373692",
  measurementId: "G-42ZBVCEBXN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

async function main() {
  // 1. Get logo URL from Firestore settings/branding
  console.log('\n=== Firestore settings/branding ===');
  const brandingDoc = await getDoc(doc(db, 'settings', 'branding'));
  console.log('  exists:', brandingDoc.exists());
  if (brandingDoc.exists()) console.log('  data:', JSON.stringify(brandingDoc.data()));

  // 2. List all files in branding/ folder in Storage
  console.log('\n=== Storage: branding/ folder ===');
  try {
    const brandingRef = ref(storage, 'branding');
    const result = await listAll(brandingRef);
    for (const item of result.items) {
      const url = await getDownloadURL(item);
      console.log(`  [FILE] ${item.fullPath}`);
      console.log(`         URL: ${url}`);
    }
    for (const prefix of result.prefixes) {
      console.log(`  [DIR] ${prefix.fullPath}`);
    }
  } catch(e) {
    console.error('Error listing branding:', e.message);
  }

  process.exit(0);
}
main();
