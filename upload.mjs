import { initializeApp } from 'firebase/app';
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
const storage = getStorage(app);

async function uploadApk() {
  const filePath = './ExtraPadhai.apk';
  const fileBuffer = fs.readFileSync(filePath);
  const apkRef = ref(storage, 'apk/ExtraPadhai.apk');
  
  console.log('Uploading ExtraPadhai.apk to Firebase Storage...');
  try {
    const snapshot = await uploadBytes(apkRef, fileBuffer, {
      contentType: 'application/vnd.android.package-archive',
    });
    console.log('Uploaded successfully!');
    const url = await getDownloadURL(snapshot.ref);
    console.log('Download URL:', url);
  } catch (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
}

uploadApk();
