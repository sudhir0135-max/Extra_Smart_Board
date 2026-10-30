/**
 * Admin: download a chapter's existing questions as XLSX.
 * Columns match the bulk-upload templates, so a downloaded file can be edited and uploaded again:
 *  - Flash:   Question, Answer, Difficulty, Topic, Source
 *  - Inquiry: Question, Answer, Topic, Marks, Source
 * Questions stored at chapter level and inside topics are combined (duplicates removed).
 * The chapter is re-read from the server first so the file has the latest questions.
 */
import * as XLSX from 'xlsx';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { resolveLessonPayload } from './firebaseHelper';
import { Lesson, FlashQuestion, InquiryQuestionObj } from '../types';

async function freshLesson(bookId: number, lesson: Lesson): Promise<Lesson> {
  try {
    const snap = await getDocFromServer(doc(db, 'books', String(bookId), 'lessons', lesson.id));
    if (snap.exists()) return (await resolveLessonPayload({ id: snap.id, ...snap.data() } as any)) as Lesson;
  } catch (e) {
    console.warn('[questionExport] using the chapter already loaded:', e);
  }
  return lesson;
}

const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : v ? Object.values(v) : []).filter(Boolean) as T[];

export function collectFlashQuestions(lesson: Lesson): FlashQuestion[] {
  const out: FlashQuestion[] = [...asArray<FlashQuestion>(lesson.flashQuestions)];
  for (const t of lesson.topics || []) {
    for (const q of asArray<FlashQuestion>(t.flashQuestions)) {
      if (!out.some(x => x.id === q.id)) out.push(q.topicTitle ? q : { ...q, topicTitle: t.title });
    }
  }
  return out;
}

export function collectInquiryQuestions(lesson: Lesson): (string | InquiryQuestionObj)[] {
  const key = (q: string | InquiryQuestionObj) => (typeof q === 'string' ? q : q.id || q.text);
  const out: (string | InquiryQuestionObj)[] = [...asArray<string | InquiryQuestionObj>(lesson.inquiryQuestions)];
  for (const t of lesson.topics || []) {
    for (const q of asArray<string | InquiryQuestionObj>(t.inquiryQuestions)) {
      if (out.some(x => key(x) === key(q))) continue;
      out.push(typeof q === 'string' ? { id: '', text: q, topicTitle: t.title || null } : (q.topicTitle ? q : { ...q, topicTitle: t.title || null }));
    }
  }
  return out;
}

const safeName = (s: string) => (s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Chapter';

function writeSheet(rows: Record<string, any>[], header: string[], widths: number[], sheetName: string, fileName: string) {
  const ws = XLSX.utils.json_to_sheet(rows, { header });
  ws['!cols'] = widths.map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

/** Returns how many questions were written (0 = nothing to download). */
export async function downloadChapterQuestionsXlsx(
  kind: 'flash' | 'inquiry',
  bookId: number,
  bookTitle: string,
  lesson: Lesson
): Promise<number> {
  const l = await freshLesson(bookId, lesson);
  const base = `${safeName(bookTitle)} - ${safeName(l.title)}`;

  if (kind === 'flash') {
    const qs = collectFlashQuestions(l);
    if (qs.length === 0) return 0;
    writeSheet(
      qs.map(q => ({ Question: q.question || '', Answer: q.answer || '', Difficulty: q.difficulty || 'Medium', Topic: q.topicTitle || '', Source: q.source || '' })),
      ['Question', 'Answer', 'Difficulty', 'Topic', 'Source'],
      [60, 60, 12, 35, 20],
      'Flash Questions',
      `${base} - Flash Questions.xlsx`
    );
    return qs.length;
  }

  const qs = collectInquiryQuestions(l);
  if (qs.length === 0) return 0;
  writeSheet(
    qs.map(q => typeof q === 'string'
      ? { Question: q, Answer: '', Topic: '', Marks: '', Source: '' }
      : { Question: q.text || '', Answer: q.answerText || '', Topic: q.topicTitle || '', Marks: q.marks ?? '', Source: q.source || '' }),
    ['Question', 'Answer', 'Topic', 'Marks', 'Source'],
    [70, 80, 35, 8, 20],
    'Inquiry Questions',
    `${base} - Inquiry Questions.xlsx`
  );
  return qs.length;
}
