import { initializeApp } from 'firebase/app';
import { getFirestore, getDocs, collectionGroup, collection } from 'firebase/firestore';

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
  const booksSnap = await getDocs(collection(db, 'books'));
  console.log(`Found ${booksSnap.size} books.`);
  for (const doc of booksSnap.docs) {
    if (doc.id === '28') {
      const lessonsSnap = await getDocs(collection(db, 'books', doc.id, 'lessons'));
      console.log(`Book 28 subLessons size: ${lessonsSnap.size}`);
      lessonsSnap.forEach(ld => {
        console.log(`Lesson keys:`, Object.keys(ld.data()));
        console.log(`Lesson id:`, ld.data().id);
      });
    }
  }
  process.exit(0);
}
checkDb();
