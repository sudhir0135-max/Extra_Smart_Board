import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';

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

async function findMathContent() {
  console.log('--- SEARCHING FOR MATH CONTENT IN FIREBASE ---');
  
  try {
    const booksSnap = await getDocs(collection(db, 'books'));
    console.log(`Found ${booksSnap.size} books\n`);
    
    for (const doc of booksSnap.docs) {
      const data = doc.data();
      const lessons = data.lessons || [];
      
      for (const lesson of lessons) {
        const pages = lesson.pages || [];
        for (const page of pages) {
          const content = page.content || '';
          // Search for LaTeX patterns
          if (content.includes('\\frac') || content.includes('\\(') || content.includes('$')) {
            console.log(`=== FOUND MATH in Book "${data.title}", Lesson "${lesson.title}", Page ${page.pageNumber} ===`);
            // Show the raw content around math areas
            const matches = content.match(/(.{0,50})(\\frac|\\\(|\$)(.{0,80})/g);
            if (matches) {
              matches.slice(0, 3).forEach(m => {
                console.log('  RAW MATCH:', JSON.stringify(m));
              });
            }
            console.log('');
          }
        }
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }

  process.exit(0);
}

findMathContent();
