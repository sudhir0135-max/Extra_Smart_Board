import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as https from 'https';

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

async function run() {
  const docRef = doc(db, 'settings', 'branding');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().logoUrl) {
    const url = docSnap.data().logoUrl;
    console.log("Logo URL:", url);
    const file = fs.createWriteStream("public/logo.png");
    https.get(url, function(response) {
      response.pipe(file);
      file.on('finish', function() {
        file.close();
        console.log("Downloaded logo.png");
        process.exit(0);
      });
    });
  } else {
    console.log("No logo found");
    process.exit(1);
  }
}
run();
