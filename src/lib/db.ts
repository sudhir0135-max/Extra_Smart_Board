import Dexie, { Table } from 'dexie';
import { OfflineBookLessons } from '../types';

/** Uploaded interactive HTML pages saved for offline reading */
export interface CachedHtmlPage {
  url: string;
  html: string;
  cached_at: string;
}

/** Notice image saved on the device (see lib/notices.ts) */
export interface SavedNoticeImage {
  id: string;
  imageUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  blob?: Blob;       // browser: the image itself
  filePath?: string; // Android app: file in the app's notices folder
  saved_at: string;
}

export class AppDatabase extends Dexie {
  offline_lessons!: Table<OfflineBookLessons, number>; // bookId is primary key
  html_pages!: Table<CachedHtmlPage, string>; // url is primary key
  notice_images!: Table<SavedNoticeImage, string>; // id is primary key

  constructor() {
    super('SingleScreenOfflineDB');
    this.version(1).stores({
      offline_lessons: 'bookId, sync_status' // bookId as primary key, sync_status as index
    });
    this.version(2).stores({
      offline_lessons: 'bookId, sync_status',
      html_pages: 'url'
    });
    this.version(3).stores({
      offline_lessons: 'bookId, sync_status',
      html_pages: 'url',
      notice_images: 'id, endDate'
    });
  }
}

export const dbLocal = new AppDatabase();
