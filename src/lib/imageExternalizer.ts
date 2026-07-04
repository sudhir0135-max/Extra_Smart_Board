/**
 * imageExternalizer.ts
 *
 * Scans every base64 data-URI inside a Book object and uploads them to
 * Firebase Storage, replacing the inline blob with a permanent https:// URL.
 *
 * Covered locations:
 *  - book.coverImage
 *  - lesson.pages[].content     (TinyMCE HTML — <img src="data:...">)
 *  - lesson.pages[].leftImage / centerImage / rightImage
 *  - lesson.inquiryQuestions[].image / answerImage
 *  - lesson.inquiryQuestions[].text / answerText  (TinyMCE HTML)
 *
 * Flash-question text is plain text (no images), so it is skipped.
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import type { Book, Lesson, InquiryQuestionObj } from '../types';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Returns true if the value looks like a base64 data-URI. */
function isBase64(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

/**
 * Convert a base64 data-URI to a Blob.
 * e.g. "data:image/png;base64,iVBOR..." → Blob(image/png)
 */
function dataUriToBlob(dataUri: string): { blob: Blob; ext: string } {
  const [header, b64] = dataUri.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  const byteString = atob(b64);
  const buf = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) buf[i] = byteString.charCodeAt(i);
  return { blob: new Blob([buf], { type: mime }), ext };
}

/**
 * Upload a single base64 data-URI to Firebase Storage.
 * @param dataUri  The full data:... string.
 * @param path     Storage path prefix (no trailing slash).
 * @returns        The public download URL.
 */
async function uploadBase64(dataUri: string, path: string): Promise<string> {
  const { blob, ext } = dataUriToBlob(dataUri);
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const fileRef = ref(storage, `${path}/${uniqueName}`);
  await uploadBytes(fileRef, blob, { contentType: blob.type });
  return getDownloadURL(fileRef);
}

/**
 * Scan an HTML string for <img src="data:..."> tags and upload each one,
 * returning the HTML with all data-URIs replaced by Storage URLs.
 */
async function externalizeHtml(html: string, storagePath: string): Promise<string> {
  if (!html || !html.includes('data:')) return html;

  // Match src="data:..." or src='data:...' — greedy to capture full base64
  const imgRegex = /src=["'](data:[^"']+)["']/g;
  const matches: { full: string; dataUri: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = imgRegex.exec(html)) !== null) {
    matches.push({ full: m[0], dataUri: m[1] });
  }

  if (matches.length === 0) return html;

  // Upload all found base64 images in parallel
  const uploads = await Promise.all(
    matches.map(async ({ full, dataUri }) => {
      const url = await uploadBase64(dataUri, storagePath);
      // Rebuild the src attribute with the new URL (preserve quote style)
      const quote = full[4]; // char after 'src='
      return { full, replacement: `src=${quote}${url}${quote}` };
    })
  );

  // Replace in the HTML string
  let result = html;
  for (const { full, replacement } of uploads) {
    result = result.split(full).join(replacement);
  }
  return result;
}

/**
 * Externalize a single direct image field (leftImage, coverImage, etc.).
 * If it is already an https:// URL or null/undefined, it is returned as-is.
 */
async function externalizeField(
  value: string | null | undefined,
  storagePath: string
): Promise<string | null | undefined> {
  if (!isBase64(value)) return value;
  return uploadBase64(value, storagePath);
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Process a single lesson: upload any embedded base64 images to Storage
 * and return a new Lesson object with all base64 replaced by URLs.
 */
export async function externalizeLessonImages(lesson: Lesson, bookId: number): Promise<Lesson> {
  const basePath = `books/${bookId}/lessons/${lesson.id}/images`;

  const processedPages = await Promise.all(
    (lesson.pages ?? []).map(async (page) => {
      const [content, leftImage, centerImage, rightImage] = await Promise.all([
        externalizeHtml(page.content ?? '', basePath),
        externalizeField(page.leftImage, basePath),
        externalizeField(page.centerImage, basePath),
        externalizeField(page.rightImage, basePath),
      ]);
      return { ...page, content, leftImage, centerImage, rightImage };
    })
  );

  const processedInquiry = await Promise.all(
    (lesson.inquiryQuestions ?? []).map(async (q) => {
      // Legacy format: plain string questions have no images
      if (typeof q === 'string') return q;
      const iq = q as InquiryQuestionObj;
      const [image, answerImage, text, answerText] = await Promise.all([
        externalizeField(iq.image, basePath),
        externalizeField(iq.answerImage, basePath),
        externalizeHtml(iq.text ?? '', basePath),
        externalizeHtml(iq.answerText ?? '', basePath),
      ]);
      return { ...iq, image, answerImage, text, answerText };
    })
  );

  return {
    ...lesson,
    pages: processedPages,
    inquiryQuestions: processedInquiry,
  };
}

/**
 * Process a full Book: externalize all base64 images in coverImage and
 * every lesson.  Returns a new Book object safe to write to Firestore.
 */
export async function externalizeBookImages(book: Book): Promise<Book> {
  const coverPath = `books/${book.id}/cover`;
  const coverImage = await externalizeField(book.coverImage, coverPath);

  const lessons = await Promise.all(
    book.lessons.map((lesson) => externalizeLessonImages(lesson, book.id))
  );

  return { ...book, coverImage: coverImage ?? null, lessons };
}
