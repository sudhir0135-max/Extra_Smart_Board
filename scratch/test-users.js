import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

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

async function testUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    console.log("Users:", snap.docs.map(d => d.data()));
  } catch (err) {
    console.error("Read Error:", err.message);
  }

  try {
    const docRef = await addDoc(collection(db, "users"), {
      email: "test@example.com",
      role: "editor",
      createdAt: new Date().toISOString()
    });
    console.log("Added user:", docRef.id);
  } catch (err) {
    console.error("Write Error:", err.message);
  }
}

testUsers();
