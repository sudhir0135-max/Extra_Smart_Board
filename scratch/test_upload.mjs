import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import fs from 'fs';

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
const auth = getAuth(app);
const storage = getStorage(app);

async function run() {
  try {
    console.log('Signing in anonymously...');
    const userCredential = await signInAnonymously(auth);
    console.log('Signed in successfully! UID:', userCredential.user.uid);
    
    const filePath = './ExtraPadhai.apk';
    const fileBuffer = fs.readFileSync(filePath);
    const apkRef = ref(storage, 'apk/ExtraPadhai.apk');
    
    console.log('Uploading ExtraPadhai.apk to Firebase Storage...');
    const snapshot = await uploadBytes(apkRef, fileBuffer, {
      contentType: 'application/vnd.android.package-archive',
    });
    console.log('Uploaded successfully!');
    const url = await getDownloadURL(snapshot.ref);
    console.log('Download URL:', url);
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
