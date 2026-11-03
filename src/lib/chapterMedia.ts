/**
 * Chapter-level media opened from the icons on the closed greenboard handle.
 */
import { Lesson, InquiryQuestionObj } from '../types';
export { getEffectiveTopicVideos } from './contentUtils';

/** The chapter's lecture videos ("Chapter Lecture Video URLs" / admin "Lecture Embed"). Topic videos are not included. */
export function getChapterVideoUrls(lesson?: Lesson | null): string[] {
  if (!lesson) return [];
  const list = lesson.videoUrls && lesson.videoUrls.length > 0 ? lesson.videoUrls : (lesson.videoUrl ? [lesson.videoUrl] : []);
  return list.map(u => (u || '').trim()).filter(Boolean);
}

/** "T.S. Grewal", "TS Grewal" and "ts grewal" are the same source. */
export const sourceKey = (s?: string | null): string => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** PDF chapters: the chapter's "Some Extra Questions" that have a source (questions without a source are not shown). */
export function getPdfChapterQuestions(lesson?: Lesson | null): InquiryQuestionObj[] {
  return ((lesson?.inquiryQuestions || []) as (string | InquiryQuestionObj)[])
    .filter((q): q is InquiryQuestionObj => !!q && typeof q !== 'string' && sourceKey(q.source).length > 0);
}
