import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function checkDb() {
  console.log('--- FIREBASE DATABASE CHECK ---');
  
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`\nFound COLLECTION: 'users' (${usersSnap.size} documents)`);
    usersSnap.forEach(doc => {
      console.log(`  Document [${doc.id}]:`, doc.data());
    });
  } catch (err) {
    console.error("  Error reading 'users' collection:", err.message);
  }

  try {
    const booksSnap = await getDocs(collection(db, 'books'));
    console.log(`\nFound COLLECTION: 'books' (${booksSnap.size} documents)`);
    booksSnap.forEach(doc => {
      // Books can be huge, print a summary
      const data = doc.data();
      console.log(`  Document [${doc.id}]: Title: ${data.title}, Class: ${data.classId}, Subject: ${data.subjectId}`);
    });
  } catch (err) {
    console.error("  Error reading 'books' collection:", err.message);
  }

  process.exit(0);
}

checkDb();
