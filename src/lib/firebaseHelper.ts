import { ref, uploadBytes, getDownloadURL, deleteObject, uploadString, listAll } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadImageToStorage(file: File, folder: string = 'images'): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`;
  const fileRef = ref(storage, `${folder}/${fileName}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

export async function fetchAllUploadedImages(folder: string = 'images'): Promise<{url: string, name: string}[]> {
  const folderRef = ref(storage, folder);
  const result = await listAll(folderRef);
  const items = await Promise.all(result.items.map(async (itemRef) => {
    const url = await getDownloadURL(itemRef);
    return { name: itemRef.name, url };
  }));
  return items;
}

export async function uploadPdfToStorage(file: File): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`;
  const fileRef = ref(storage, `pdfs/${fileName}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

/**
 * Upload a single WebP page image to Firebase Storage.
 * Path: books/{classId}/{subjectId}/{bookId}/{lessonId}/pages/page_NNN.webp
 */
export async function uploadWebpPage(
  classId: string,
  subjectId: string,
  bookId: string | number,
  lessonId: string,
  pageNumber: number,
  blob: Blob
): Promise<string> {
  const padded = String(pageNumber).padStart(3, '0');
  const path = `books/${classId}/${subjectId}/${bookId}/${lessonId}/pages/page_${padded}.webp`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType: 'image/webp' });
  return await getDownloadURL(fileRef);
}

/**
 * Write meta.json for a lesson to Firebase Storage.
 */
export async function writeMetaJson(
  classId: string,
  subjectId: string,
  bookId: string | number,
  lessonId: string,
  meta: {
    bookId: string | number;
    lessonId: string;
    title: string;
    classId: string;
    subjectId: string;
    lessonOrder: number;
    pageCount: number;
  }
): Promise<void> {
  const path = `books/${classId}/${subjectId}/${bookId}/${lessonId}/meta.json`;
  const fileRef = ref(storage, path);
  await uploadString(fileRef, JSON.stringify(meta, null, 2), 'raw', {
    contentType: 'application/json',
  });
}

/**
 * Delete a file from Firebase Storage by its full gs:// path or download URL.
 * Silently ignores "not found" errors.
 */
export async function deleteFileFromStorage(urlOrPath: string): Promise<void> {
  try {
    let storagePath: string;
    if (urlOrPath.startsWith('http')) {
      // Extract path from download URL
      // Format: .../o/PATH?token=...
      const match = urlOrPath.match(/\/o\/(.+?)(\?|$)/);
      if (!match) return;
      storagePath = decodeURIComponent(match[1]);
    } else {
      storagePath = urlOrPath;
    }
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
  } catch (e: any) {
    if (e?.code !== 'storage/object-not-found') {
      console.warn('[deleteFileFromStorage] Error:', e);
    }
  }
}

/**
 * Build the base storagePath for a lesson's WebP pages.
 * e.g. "books/class_8/science/42/lesson-ed-42-1234567890"
 */
export function buildLessonStoragePath(
  classId: string,
  subjectId: string,
  bookId: string | number,
  lessonId: string
): string {
  return `books/${classId}/${subjectId}/${bookId}/${lessonId}`;
}
