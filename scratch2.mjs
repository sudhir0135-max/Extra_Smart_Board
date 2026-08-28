import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

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

// August 26, 2026 00:00:00 IST timestamp
const AUG_26_2026_TS = new Date('2026-08-26T00:00:00+05:30').getTime();

// Cache of oldUrl -> newUrl to avoid re-uploading duplicate image references
const urlMap = new Map();

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

function getMimeType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  return 'image/png';
}

async function moveImageToSubject(oldUrl, subjectName) {
  if (urlMap.has(oldUrl)) {
    return urlMap.get(oldUrl);
  }

  // Extract filename
  const match = oldUrl.match(/\/o\/images%2F([^?]+)/);
  if (!match) return oldUrl;

  const fileName = decodeURIComponent(match[1]);
  // Verify timestamp prefix
  const tsMatch = fileName.match(/^(\d{13})_/);
  const ts = tsMatch ? parseInt(tsMatch[1], 10) : 0;

  if (tsMatch && ts < AUG_26_2026_TS) {
    // Before Aug 26, 2026 → leave as is
    return oldUrl;
  }

  const targetFolder = `images/subjects/${subjectName}`;
  const targetPath = `${targetFolder}/${fileName}`;
  const targetRef = ref(storage, targetPath);

  console.log(`\nMoving: ${fileName}`);
  console.log(`  Target: ${targetPath}`);

  try {
    // 1. Download bytes from old URL
    const bytes = await fetchBytes(oldUrl);
    const mime = getMimeType(fileName);

    // 2. Upload to new target path
    await uploadBytes(targetRef, bytes, { contentType: mime });

    // 3. Get new download URL
    const newUrl = await getDownloadURL(targetRef);

    // 4. Try deleting old file from root images/
    try {
      const oldRef = ref(storage, `images/${fileName}`);
      await deleteObject(oldRef);
      console.log(`  [DELETED OLD] images/${fileName}`);
    } catch (delErr) {
      console.warn(`  [WARN] Could not delete old file images/${fileName}:`, delErr.message);
    }

    urlMap.set(oldUrl, newUrl);
    return newUrl;
  } catch (err) {
    // If fetching old URL failed (e.g. 404 because already moved), check if file exists at target!
    try {
      const existingNewUrl = await getDownloadURL(targetRef);
      console.log(`  [ALREADY MOVED] Found at ${targetPath}`);
      urlMap.set(oldUrl, existingNewUrl);
      return existingNewUrl;
    } catch (checkErr) {
      console.error(`  [ERROR] Failed to move ${fileName}:`, err.message);
      return oldUrl;
    }
  }

}

// Recursively process and replace URLs in text/objects
async function processAndReplaceUrl(val, subjectName) {
  if (!val || typeof val !== 'string') return val;

  let result = val;

  // Check direct URL matches
  if (result.includes('/o/images%2F') && !result.includes('/o/images%2Fsubjects%2F')) {
    // Extract exact URL match if string is just a single URL
    if (result.startsWith('http')) {
      const match = result.match(/https:\/\/[^"'\s]+/);
      if (match) {
        const newUrl = await moveImageToSubject(match[0], subjectName);
        result = result.replace(match[0], newUrl);
      }
    } else {
      // String might contain embedded HTML with multiple <img src="...">
      const imgRegex = /https:\/\/[^"'\s]+\/o\/images%2F[^"'\s]+/g;
      const matches = Array.from(new Set(result.match(imgRegex) || []));
      for (const oldUrl of matches) {
        if (!oldUrl.includes('/o/images%2Fsubjects%2F')) {
          const newUrl = await moveImageToSubject(oldUrl, subjectName);
          result = result.split(oldUrl).join(newUrl);
        }
      }
    }
  }

  return result;
}

async function migrate() {
  console.log('=== STARTING IMAGE MIGRATION TO SUBJECT FOLDERS ===\n');

  // 1. Load subjects
  const subjectsSnap = await getDocs(collection(db, 'subjects'));
  const subjectMap = new Map();
  subjectsSnap.forEach(s => subjectMap.set(s.id, s.data().name));

  // 2. Load books
  const booksSnap = await getDocs(collection(db, 'books'));
  console.log(`Loaded ${booksSnap.size} books.\n`);

  let totalUpdatedBooks = 0;
  let totalUpdatedLessons = 0;

  for (const bookDoc of booksSnap.docs) {
    const bookId = bookDoc.id;
    const bookData = bookDoc.data();
    const subjectName = subjectMap.get(bookData.subjectId) || 'General';

    console.log(`Processing Book [${bookId}] "${bookData.title}" (Subject: ${subjectName})...`);

    let bookModified = false;

    // Check cover image
    if (bookData.coverImage) {
      const newCover = await processAndReplaceUrl(bookData.coverImage, subjectName);
      if (newCover !== bookData.coverImage) {
        bookData.coverImage = newCover;
        bookModified = true;
      }
    }

    // Process embedded lessons
    if (Array.isArray(bookData.lessons)) {
      for (let lIdx = 0; lIdx < bookData.lessons.length; lIdx++) {
        const lesson = bookData.lessons[lIdx];

        // Process pages
        if (Array.isArray(lesson.pages)) {
          for (let pIdx = 0; pIdx < lesson.pages.length; pIdx++) {
            const page = lesson.pages[pIdx];
            const newLeft = await processAndReplaceUrl(page.leftImage, subjectName);
            const newCenter = await processAndReplaceUrl(page.centerImage, subjectName);
            const newRight = await processAndReplaceUrl(page.rightImage, subjectName);
            const newContent = await processAndReplaceUrl(page.content, subjectName);

            if (newLeft !== page.leftImage || newCenter !== page.centerImage || newRight !== page.rightImage || newContent !== page.content) {
              lesson.pages[pIdx] = {
                ...page,
                leftImage: newLeft,
                centerImage: newCenter,
                rightImage: newRight,
                content: newContent
              };
              bookModified = true;
            }
          }
        }

        // Process inquiry questions
        if (Array.isArray(lesson.inquiryQuestions)) {
          for (let iIdx = 0; iIdx < lesson.inquiryQuestions.length; iIdx++) {
            const iq = lesson.inquiryQuestions[iIdx];
            if (typeof iq !== 'string' && iq) {
              const newImg = await processAndReplaceUrl(iq.image, subjectName);
              const newAnsImg = await processAndReplaceUrl(iq.answerImage, subjectName);
              const newText = await processAndReplaceUrl(iq.text, subjectName);
              const newAnsText = await processAndReplaceUrl(iq.answerText, subjectName);

              if (newImg !== iq.image || newAnsImg !== iq.answerImage || newText !== iq.text || newAnsText !== iq.answerText) {
                lesson.inquiryQuestions[iIdx] = {
                  ...iq,
                  image: newImg,
                  answerImage: newAnsImg,
                  text: newText,
                  answerText: newAnsText
                };
                bookModified = true;
              }
            }
          }
        }
      }
    }

    // Process subcollection lessons
    const lessonsSubSnap = await getDocs(collection(db, 'books', bookId, 'lessons'));
    for (const lessonDoc of lessonsSubSnap.docs) {
      const lessonData = lessonDoc.data();
      let lessonModified = false;

      if (Array.isArray(lessonData.pages)) {
        for (let pIdx = 0; pIdx < lessonData.pages.length; pIdx++) {
          const page = lessonData.pages[pIdx];
          const newLeft = await processAndReplaceUrl(page.leftImage, subjectName);
          const newCenter = await processAndReplaceUrl(page.centerImage, subjectName);
          const newRight = await processAndReplaceUrl(page.rightImage, subjectName);
          const newContent = await processAndReplaceUrl(page.content, subjectName);

          if (newLeft !== page.leftImage || newCenter !== page.centerImage || newRight !== page.rightImage || newContent !== page.content) {
            lessonData.pages[pIdx] = {
              ...page,
              leftImage: newLeft,
              centerImage: newCenter,
              rightImage: newRight,
              content: newContent
            };
            lessonModified = true;
          }
        }
      }

      if (Array.isArray(lessonData.inquiryQuestions)) {
        for (let iIdx = 0; iIdx < lessonData.inquiryQuestions.length; iIdx++) {
          const iq = lessonData.inquiryQuestions[iIdx];
          if (typeof iq !== 'string' && iq) {
            const newImg = await processAndReplaceUrl(iq.image, subjectName);
            const newAnsImg = await processAndReplaceUrl(iq.answerImage, subjectName);
            const newText = await processAndReplaceUrl(iq.text, subjectName);
            const newAnsText = await processAndReplaceUrl(iq.answerText, subjectName);

            if (newImg !== iq.image || newAnsImg !== iq.answerImage || newText !== iq.text || newAnsText !== iq.answerText) {
              lessonData.inquiryQuestions[iIdx] = {
                ...iq,
                image: newImg,
                answerImage: newAnsImg,
                text: newText,
                answerText: newAnsText
              };
              lessonModified = true;
            }
          }
        }
      }

      if (lessonModified) {
        const cleanLesson = JSON.parse(JSON.stringify(lessonData));
        await setDoc(doc(db, 'books', bookId, 'lessons', lessonDoc.id), cleanLesson);
        totalUpdatedLessons++;
        console.log(`  [UPDATED LESSON DOC] books/${bookId}/lessons/${lessonDoc.id}`);
      }
    }

    if (bookModified) {
      const cleanBook = JSON.parse(JSON.stringify(bookData));
      await setDoc(doc(db, 'books', bookId), cleanBook);
      totalUpdatedBooks++;
      console.log(`  [UPDATED BOOK DOC] books/${bookId}`);
    }
  }


  console.log('\n=============================================');
  console.log(`MIGRATION COMPLETE!`);
  console.log(`Distinct images moved: ${urlMap.size}`);
  console.log(`Book docs updated: ${totalUpdatedBooks}`);
  console.log(`Lesson docs updated: ${totalUpdatedLessons}`);
  console.log('=============================================\n');

  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});




