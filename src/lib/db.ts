import Dexie, { Table } from 'dexie';
import { OfflineBookLessons } from '../types';

/** Uploaded interactive HTML pages saved for offline reading */
export interface CachedHtmlPage {
  url: string;
  html: string;
  cached_at: string;
}

export class AppDatabase extends Dexie {
  offline_lessons!: Table<OfflineBookLessons, number>; // bookId is primary key
  html_pages!: Table<CachedHtmlPage, string>; // url is primary key

  constructor() {
    super('SingleScreenOfflineDB');
    this.version(1).stores({
      offline_lessons: 'bookId, sync_status' // bookId as primary key, sync_status as index
    });
    this.version(2).stores({
      offline_lessons: 'bookId, sync_status',
      html_pages: 'url'
    });
  }
}

export const dbLocal = new AppDatabase();
