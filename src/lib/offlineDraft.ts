/**
 * Writes chapters fetched from the server into the device's offline copy WITHOUT losing an
 * editor's unsubmitted work.
 *
 * An editor's changes (pages, flash and inquiry questions, topics…) live only in the local
 * draft until the chapter is submitted and approved. Every refresh from the server must
 * therefore keep the chapters listed in `pendingLessonIds`. Everything runs inside one Dexie
 * transaction, so an editor save that happens at the same moment is never overwritten.
 */
import { dbLocal } from './db';

export async function persistServerLessons(
  bookId: number,
  serverLessons: any[],
  bookTitle?: string
): Promise<{ lessons: any[]; pendingIds: string[]; serverLessons: any[] }> {
  const db: any = dbLocal;
  return db.transaction('rw', db.offline_lessons, async () => {
    const existing: any = await db.offline_lessons.get(bookId).catch(() => undefined);
    // A large chapter whose full copy could not be downloaded arrives as a cut-down placeholder:
    // keep the complete copy already saved on this device instead (if there is one).
    serverLessons = serverLessons.map((l: any) => {
      if (!l || !l._payloadMissing) return l;
      const saved = (existing?.lessons || []).find((ol: any) => ol && ol.id === l.id && !ol._payloadMissing);
      return saved ? { ...saved, order: l.order ?? saved.order } : l;
    });
    let lessonsToPersist = serverLessons;
    let pendingIds: string[] = [];

    // A "pending" copy holds editor changes not yet on the server. Only the chapters listed in
    // pendingLessonIds keep the local version; all others follow the server. Older copies
    // without the list: chapters that differ from the server are kept (never discard work).
    if (existing && existing.sync_status === 'pending' && existing.lessons) {
      if (Array.isArray(existing.pendingLessonIds)) {
        pendingIds = existing.pendingLessonIds;
      } else {
        const strip = (l: any) => { const { order, payloadUrl, ...rest } = l || {}; return JSON.stringify(rest); };
        pendingIds = (existing.lessons || [])
          .filter((ol: any) => {
            const live = serverLessons.find((l: any) => l.id === ol.id);
            return !live || strip(live) !== strip(ol);
          })
          .map((ol: any) => ol.id);
      }
    }

    if (pendingIds.length > 0) {
      lessonsToPersist = serverLessons.map((liveL: any) => {
        const pendingL = pendingIds.includes(liveL.id) ? (existing.lessons || []).find((ol: any) => ol.id === liveL.id) : null;
        if (!pendingL) return liveL;
        return {
          ...liveL,
          ...pendingL,
          topics: pendingL.topics || liveL.topics,
          pages: pendingL.pages || liveL.pages,
          inquiryQuestions: pendingL.inquiryQuestions || liveL.inquiryQuestions,
          flashQuestions: pendingL.flashQuestions || liveL.flashQuestions,
        };
      });
      // Chapters created on this device that the server does not have yet stay too
      for (const ol of existing.lessons || []) {
        if (pendingIds.includes(ol.id) && !lessonsToPersist.some((l: any) => l.id === ol.id)) {
          lessonsToPersist = [...lessonsToPersist, ol];
        }
      }
    }

    await db.offline_lessons.put({
      bookId,
      ...(bookTitle ? { bookTitle } : (existing?.bookTitle ? { bookTitle: existing.bookTitle } : {})),
      lessons: lessonsToPersist,
      sync_status: pendingIds.length > 0 ? 'pending' : 'synced',
      updated_at: new Date().toISOString(),
      pendingLessonIds: pendingIds,
    } as any);

    return { lessons: lessonsToPersist, pendingIds, serverLessons };
  });
}
