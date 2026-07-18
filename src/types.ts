/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InquiryQuestionObj {
  id: string;
  text: string;
  image?: string | null;
  imagePosition?: 'left' | 'center' | 'right';
  // Answer fields — same shape as the question
  answerText?: string | null;
  answerImage?: string | null;
  answerImagePosition?: 'left' | 'center' | 'right';
}

export interface Lesson {
  id: string;
  title: string;
  subtitle?: string | null;
  pages: {
    pageNumber: number;
    content: string; // HTML-like rich-text or formatted text
    iframeUrl?: string | null;
    leftImage?: string | null;
    centerImage?: string | null;
    rightImage?: string | null;
    equations?: string[] | null;
    figure?: {
      caption: string;
      svgType: 'brain' | 'river' | 'ecosystem' | 'math' | 'music' | 'language' | 'fairness';
    } | null;
  }[];
  videoUrl?: string | null;
  flashQuestions: FlashQuestion[];
  inquiryQuestions?: (string | InquiryQuestionObj)[];
}


export interface AcademicClass {
  id: string;
  name: string;
}

export interface AcademicSubject {
  id: string;
  name: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  source?: string | null;
  color: string;
  coverImage?: string | null;
  classId?: string | null;
  subjectId?: string | null;
  lessonCount?: number;
  lessons: Lesson[];
}

export interface FlashQuestion {
  id: string;
  question: string;
  answer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface DrawingStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  isHighlighter?: boolean;
}

export interface OfflineAction {
  id: string;
  timestamp: string;
  type: 'ADD_NOTE' | 'SAVE_DRAWING' | 'SUBMIT_SCORE' | 'BOOKMARK';
  payload: any;
  status: 'pending' | 'synchronized';
}

export type ThemeMode = 'parchment' | 'dark' | 'high-contrast-blue' | 'high-contrast-green' | 'mono';

export interface Note {
  bookId: number;
  lessonId: string;
  text: string;
  updatedAt: string;
}

export interface BookEditor {
  id: string;
  name: string;
  username: string;
  gmailId?: string;
  assignedBookId: number;
  isActive: boolean;
  storagePath?: string;
  pageCount?: number;
  pagesReady?: boolean;
}

export type SyncStatus = 'pending' | 'uploaded' | 'failed' | 'deleted';

export interface OfflineBookLessons {
  bookId: number;
  lessons: Lesson[];
  sync_status: SyncStatus;
}

export interface EditorSubmission {
  bookId: number;
  editorId: string;
  editorEmail: string;
  /** Populated only when lessons are fetched from the subcollection */
  lessons?: Lesson[];
  lessonCount?: number;
  timestamp: number;
}
