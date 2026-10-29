/**
 * Notice images ("notifications") shown over the book shelf page.
 *
 * Admin uploads an image with a start date and an end date (both inclusive, YYYY-MM-DD).
 * The list lives in Firestore at settings/notice_images ({ items: NoticeImage[] }).
 *
 * Devices:
 *  - when internet is available, download every notice that is not expired and not yet saved
 *    (Android app: into the app folder extrapadhai/notices; browser: IndexedDB)
 *  - delete saved notices after their end date, or when the admin removed them
 *  - show the saved notices whose dates include today, also when offline
 */
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { dbLocal, SavedNoticeImage } from './db';

export interface NoticeImage {
  id: string;
  imageUrl: string;
  startDate: string; // YYYY-MM-DD, first day shown
  endDate: string;   // YYYY-MM-DD, last day shown
  title?: string | null;
  createdAt: string;
}

const NOTICE_DOC = () => doc(db, 'settings', 'notice_images');
const NATIVE_NOTICE_DIR = 'extrapadhai/notices';
export const NOTICES_UPDATED_EVENT = 'extrapadhai-notices-updated';

const isNative = () =>
  typeof (window as any).Capacitor !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

/** Today's date on this device as YYYY-MM-DD. */
export function todayStr(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const isNoticeActive = (n: { startDate: string; endDate: string }, today = todayStr()) =>
  n.startDate <= today && today <= n.endDate;

// ── Admin side ────────────────────────────────────────────────────────────────

export async function fetchNoticeList(): Promise<NoticeImage[]> {
  const snap = await getDocFromServer(NOTICE_DOC());
  const items = snap.exists() ? (snap.data().items as NoticeImage[]) : [];
  return (Array.isArray(items) ? items : []).filter(n => n && n.id && n.imageUrl && n.startDate && n.endDate);
}

export async function saveNoticeList(items: NoticeImage[]): Promise<void> {
  await setDoc(NOTICE_DOC(), { items, updatedAt: new Date().toISOString() });
}

// ── Device side ───────────────────────────────────────────────────────────────

async function fs() {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Capacitor } = await import('@capacitor/core');
  return { Filesystem, Directory, Capacitor };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function deleteSaved(row: SavedNoticeImage): Promise<void> {
  if (row.filePath) {
    try {
      const { Filesystem, Directory } = await fs();
      await Filesystem.deleteFile({ path: row.filePath, directory: Directory.Data });
    } catch { /* already gone */ }
  }
  await dbLocal.notice_images.delete(row.id).catch(() => {});
}

async function downloadNotice(n: NoticeImage): Promise<void> {
  const res = await fetch(n.imageUrl, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const row: SavedNoticeImage = {
    id: n.id,
    imageUrl: n.imageUrl,
    startDate: n.startDate,
    endDate: n.endDate,
    saved_at: new Date().toISOString(),
  };
  if (isNative()) {
    const { Filesystem, Directory } = await fs();
    try { await Filesystem.mkdir({ path: NATIVE_NOTICE_DIR, directory: Directory.Data, recursive: true }); } catch { /* exists */ }
    const ext = (blob.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
    const filePath = `${NATIVE_NOTICE_DIR}/${n.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
    await Filesystem.writeFile({ path: filePath, data: await blobToBase64(blob), directory: Directory.Data });
    row.filePath = filePath;
  } else {
    row.blob = blob;
  }
  await dbLocal.notice_images.put(row);
}

/** Deletes saved notices whose end date has passed. Works offline. */
export async function purgeExpiredNotices(today = todayStr()): Promise<number> {
  const rows = await dbLocal.notice_images.toArray().catch(() => [] as SavedNoticeImage[]);
  const expired = rows.filter(r => r.endDate < today);
  for (const r of expired) await deleteSaved(r);
  return expired.length;
}

let syncing = false;

/**
 * Brings the device's notice folder up to date. Safe to call often; does nothing heavy
 * when everything is already saved. Without internet it only deletes expired notices.
 */
export async function syncNoticeImages(): Promise<void> {
  if (syncing) return;
  syncing = true;
  let changed = false;
  try {
    const today = todayStr();
    changed = (await purgeExpiredNotices(today)) > 0;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    let list: NoticeImage[];
    try {
      list = await fetchNoticeList();
    } catch (e) {
      console.warn('[notices] could not read the notice list:', e);
      return;
    }
    const wanted = list.filter(n => n.endDate >= today);
    const wantedIds = new Set(wanted.map(n => n.id));
    const saved = await dbLocal.notice_images.toArray().catch(() => [] as SavedNoticeImage[]);

    // removed by the admin
    for (const r of saved) {
      if (!wantedIds.has(r.id)) { await deleteSaved(r); changed = true; }
    }
    // new ones, a replaced image, or changed dates
    for (const n of wanted) {
      const have = saved.find(r => r.id === n.id);
      if (have && have.imageUrl === n.imageUrl) {
        if (have.startDate !== n.startDate || have.endDate !== n.endDate) {
          await dbLocal.notice_images.update(n.id, { startDate: n.startDate, endDate: n.endDate });
          changed = true;
        }
        continue;
      }
      try {
        if (have) await deleteSaved(have);
        await downloadNotice(n);
        changed = true;
      } catch (e) {
        console.warn('[notices] download failed, will retry next time:', n.imageUrl, e);
      }
    }
  } finally {
    syncing = false;
    if (changed) window.dispatchEvent(new Event(NOTICES_UPDATED_EVENT));
  }
}

export interface DisplayNotice { id: string; src: string; startDate: string; endDate: string }

/** Saved notices to show today, oldest start date first. Works offline. Call `release` when done. */
export async function getActiveSavedNotices(): Promise<{ notices: DisplayNotice[]; release: () => void }> {
  const today = todayStr();
  const rows = (await dbLocal.notice_images.toArray().catch(() => [] as SavedNoticeImage[]))
    .filter(r => isNoticeActive(r, today))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.saved_at.localeCompare(b.saved_at));
  const objectUrls: string[] = [];
  const notices: DisplayNotice[] = [];
  for (const r of rows) {
    let src = '';
    if (r.blob) {
      src = URL.createObjectURL(r.blob);
      objectUrls.push(src);
    } else if (r.filePath) {
      try {
        const { Filesystem, Directory, Capacitor } = await fs();
        const stat = await Filesystem.stat({ path: r.filePath, directory: Directory.Data });
        src = Capacitor.convertFileSrc(stat.uri);
      } catch {
        await dbLocal.notice_images.delete(r.id).catch(() => {}); // file missing: download again next sync
        continue;
      }
    }
    if (src) notices.push({ id: r.id, src, startDate: r.startDate, endDate: r.endDate });
  }
  return { notices, release: () => objectUrls.forEach(u => URL.revokeObjectURL(u)) };
}
