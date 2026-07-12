import { Lesson } from '../types';

const NATIVE_IMAGE_DIR = 'extrapadhai/images';
const NATIVE_IMAGE_INDEX = 'extrapadhai/image-index.json';

const isNative = () => {
  return typeof (window as any).Capacitor !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
};

async function getFilesystem() {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Capacitor } = await import('@capacitor/core');
  return { Filesystem, Directory, Encoding, Capacitor };
}

function urlToFilename(url: string): string {
  try {
    const parsed = new URL(url);
    const basename = parsed.pathname.split('/').pop() || 'image';
    const decoded = decodeURIComponent(basename);
    return decoded.replace(/[^a-zA-Z0-9.\-_]/g, '_') + '_' + Date.now() + '.jpg';
  } catch {
    return 'image_' + Date.now() + '.jpg';
  }
}

async function ensureNativeDir() {
  const { Filesystem, Directory } = await getFilesystem();
  try {
    await Filesystem.mkdir({ path: NATIVE_IMAGE_DIR, directory: Directory.Data, recursive: true });
  } catch (e) {
    // probably already exists
  }
}

async function readNativeIndex(): Promise<Record<string, string>> {
  const { Filesystem, Directory, Encoding } = await getFilesystem();
  try {
    const result = await Filesystem.readFile({ path: NATIVE_IMAGE_INDEX, directory: Directory.Data, encoding: Encoding.UTF8 });
    return JSON.parse(result.data as string);
  } catch {
    return {};
  }
}

async function writeNativeIndex(index: Record<string, string>): Promise<void> {
  const { Filesystem, Directory, Encoding } = await getFilesystem();
  try {
    await ensureNativeDir();
    await Filesystem.writeFile({
      path: NATIVE_IMAGE_INDEX,
      data: JSON.stringify(index, null, 2),
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
  } catch (e) {
    console.error('[imageCache] Error writing index:', e);
  }
}

async function getBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Capacitor expects base64 without the data:image/... prefix
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Download a remote URL to Capacitor Filesystem
 */
export async function downloadAndCacheImage(url: string): Promise<string> {
  if (!isNative()) return url;
  if (!url || !url.startsWith('http')) return url;

  const { Filesystem, Directory } = await getFilesystem();
  
  const index = await readNativeIndex();
  if (index[url]) {
    // Already downloaded, check if it actually exists
    try {
      await Filesystem.stat({ path: index[url], directory: Directory.Data });
      return url; // file exists
    } catch {
      // file missing, re-download
    }
  }

  await ensureNativeDir();
  const filename = urlToFilename(url);
  const filePath = `${NATIVE_IMAGE_DIR}/${filename}`;

  console.log('[imageCache] Downloading:', url);
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const base64Data = await getBlobAsBase64(blob);

    await Filesystem.writeFile({
      path: filePath,
      data: base64Data,
      directory: Directory.Data
    });

    index[url] = filePath;
    await writeNativeIndex(index);
    console.log('[imageCache] Cached to:', filePath);
    return url;
  } catch (e) {
    console.error('[imageCache] Failed to download:', url, e);
    return url;
  }
}

/**
 * Translate a remote URL to a local capacitor:// URL if it exists in cache
 */
export async function getLocalImageSrc(url: string): Promise<string> {
  if (!isNative() || !url || !url.startsWith('http')) return url;

  try {
    const { Capacitor, Directory, Filesystem } = await getFilesystem();
    const index = await readNativeIndex();
    
    if (index[url]) {
      // Get absolute native path to convert to Capacitor URL
      const stat = await Filesystem.stat({ path: index[url], directory: Directory.Data });
      if (stat && stat.uri) {
        return Capacitor.convertFileSrc(stat.uri);
      }
    }
  } catch (e) {
    // Silent fail, just use web url
  }
  return url;
}

/**
 * Extract all image URLs from a lesson structure
 */
export function extractImagesFromLesson(lesson: Lesson): string[] {
  const urls = new Set<string>();

  const extractFromHtml = (html?: string) => {
    if (!html) return;
    // Match <img src="URL" />
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      if (match[1].startsWith('http')) urls.add(match[1]);
    }
    
    // Match annotations (data-annotation-media-url)
    const mediaRegex = /data-annotation-media-url=["']([^"']+)["']/g;
    while ((match = mediaRegex.exec(html)) !== null) {
      if (match[1].startsWith('http')) urls.add(match[1]);
    }
  };

  if (lesson.pages) {
    lesson.pages.forEach(page => {
      extractFromHtml(page.content);
      if (page.leftImage) urls.add(page.leftImage);
      if (page.rightImage) urls.add(page.rightImage);
      if (page.centerImage) urls.add(page.centerImage);
    });
  }

  if (lesson.inquiryQuestions) {
    lesson.inquiryQuestions.forEach(q => {
      extractFromHtml(q.text);
      extractFromHtml(q.answerText);
      if (q.image) urls.add(q.image);
      if (q.answerImage) urls.add(q.answerImage);
    });
  }

  return Array.from(urls);
}
