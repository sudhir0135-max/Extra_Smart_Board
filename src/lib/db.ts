import Dexie, { Table } from 'dexie';
import { OfflineBookLessons } from '../types';

export class AppDatabase extends Dexie {
  offline_lessons!: Table<OfflineBookLessons, number>; // bookId is primary key

  constructor() {
    super('SingleScreenOfflineDB');
    this.version(1).stores({
      offline_lessons: 'bookId, sync_status' // bookId as primary key, sync_status as index
    });
  }
}

export const dbLocal = new AppDatabase();
