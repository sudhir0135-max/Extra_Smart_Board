/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InquiryQuestionObj {
  id: string;
  text: string;
  image?: string | null;
  imagePosition?: 'left' | 'center' | 'right';
}

export interface Lesson {
  id: string;
  title: string;
  subtitle?: string | null;
  pages: {
    pageNumber: number;
    content: string; // HTML-like rich-text or formatted text
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
  pdfUrl?: string | null;       // Legacy: old Firebase Storage PDF URL (cleared after WebP conversion)
  storagePath?: string | null;  // NEW: path to WebP pages in Firebase Storage e.g. "books/class_8/science/bookId/lessonId"
  pageCount?: number | null;    // NEW: total number of WebP page images
  pagesReady?: boolean;         // NEW: true when all WebP images are uploaded and ready
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
}
