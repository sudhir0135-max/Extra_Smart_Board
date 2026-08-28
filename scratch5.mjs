import { initializeApp } from 'firebase/app';
import { getFirestore, getDocs, getDoc, doc, collection } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, uploadString, getMetadata, getDownloadURL } from 'firebase/storage';

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
const db  = getFirestore(app);
const storage = getStorage(app);

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the given Storage path exists. */
async function fileExists(storagePath) {
  try {
    await getMetadata(ref(storage, storagePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Download a public URL and return an ArrayBuffer of its bytes.
 * Uses the global fetch available in Node 18+.
 */
async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Get logo URL from Firestore settings/branding
  const brandingSnap = await getDoc(doc(db, 'settings', 'branding'));
  if (!brandingSnap.exists() || !brandingSnap.data().logoUrl) {
    console.error('No logo URL found in Firestore settings/branding. Aborting.');
    process.exit(1);
  }
  const logoUrl = brandingSnap.data().logoUrl;
  // Extract file extension from URL path (before the query string)
  const logoExt = logoUrl.split('?')[0].split('.').pop() || 'png';
  console.log(`Logo URL: ${logoUrl}`);
  console.log(`Logo extension: .${logoExt}`);

  // 2. Download logo bytes once
  console.log('\nDownloading logo...');
  const logoBytes = await fetchBytes(logoUrl);
  const logoMime  = logoExt === 'png' ? 'image/png'
                  : logoExt === 'jpg' || logoExt === 'jpeg' ? 'image/jpeg'
                  : logoExt === 'webp' ? 'image/webp'
                  : 'image/png';
  console.log(`Downloaded ${logoBytes.byteLength} bytes (${logoMime})`);

  // 3. Load all subjects
  const subjectsSnap = await getDocs(collection(db, 'subjects'));
  const subjects = subjectsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
  console.log(`\nFound ${subjects.length} subjects:\n  ${subjects.map(s => s.name).join(', ')}`);

  // 4. For each subject: ensure folder + logo
  console.log('\n--- Processing subject folders ---');
  for (const subject of subjects) {
    const folderBase  = `images/subjects/${subject.name}`;
    const keepPath    = `${folderBase}/.keep`;
    const logoPath    = `${folderBase}/logo.${logoExt}`;

    // 4a. Create folder placeholder if missing
    const keepExists = await fileExists(keepPath);
    if (!keepExists) {
      await uploadString(ref(storage, keepPath), '', 'raw', { contentType: 'text/plain' });
      console.log(`  [CREATED] ${keepPath}`);
    } else {
      console.log(`  [EXISTS ] ${keepPath}`);
    }

    // 4b. Copy logo into subject folder if missing
    const logoExists = await fileExists(logoPath);
    if (!logoExists) {
      await uploadBytes(ref(storage, logoPath), logoBytes, { contentType: logoMime });
      console.log(`  [COPIED ] ${logoPath}`);
    } else {
      console.log(`  [EXISTS ] ${logoPath}`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
