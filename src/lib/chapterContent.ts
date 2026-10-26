import { Lesson } from '../types';

/**
 * How a chapter's reading content is authored and shown to students.
 *  - 'pdf'    : a single uploaded PDF document (nothing else is shown)
 *  - 'html'   : pages default to uploaded interactive HTML (iframes)
 *  - 'canvas' : pages default to rich text written in the page canvas editor
 * HTML and Canvas chapters can mix both kinds of page; only the default for new pages differs.
 */
export type ChapterContentType = 'pdf' | 'html' | 'canvas';

/** Whether HTML / Canvas pages live under topics or directly under the chapter. */
export type ChapterTopicMode = 'topics' | 'none';

export const CHAPTER_CONTENT_TYPE_LABELS: Record<ChapterContentType, string> = {
  pdf: 'Upload PDF',
  html: 'Upload HTML',
  canvas: 'Write in Canvas'
};

const hasIframePage = (pages?: { iframeUrl?: string | null }[]) =>
  Boolean(pages && pages.some(p => p && p.iframeUrl && String(p.iframeUrl).trim().length > 0));

/** True when the editor has explicitly chosen a content type for this chapter. */
export const hasExplicitChapterType = (lesson?: Lesson | null): boolean =>
  Boolean(lesson && lesson.contentType);

/**
 * Returns the chapter's content type. Chapters created before the type selector existed
 * are auto-detected: a PDF attachment => 'pdf', any HTML iframe page => 'html', else 'canvas'.
 */
export const getChapterContentType = (lesson?: Lesson | null): ChapterContentType => {
  if (!lesson) return 'canvas';
  if (lesson.contentType) return lesson.contentType;
  if (lesson.pdfUrl && lesson.pdfUrl.trim().length > 0) return 'pdf';
  if (hasIframePage(lesson.pages)) return 'html';
  if ((lesson.topics || []).some(t => hasIframePage(t.pages))) return 'html';
  return 'canvas';
};

/** Returns the chapter's topic mode (auto-detected for older chapters). PDF chapters never use topics. */
export const getChapterTopicMode = (lesson?: Lesson | null): ChapterTopicMode => {
  if (!lesson) return 'none';
  if (lesson.topicMode) return lesson.topicMode;
  return (lesson.topics && lesson.topics.length > 0) ? 'topics' : 'none';
};

/**
 * Builds the lesson the STUDENT panel renders, keeping only the content that matches the
 * chapter's chosen type and topic mode. Content of other types is kept in the database
 * (so editors can switch back) but is hidden from students here.
 *
 * Chapters without an explicit contentType (created before this feature) are returned
 * unchanged so their existing display is not affected.
 */
export const getStudentViewLesson = (lesson: Lesson): Lesson => {
  if (!lesson.contentType) return lesson;

  const type = lesson.contentType;

  if (type === 'pdf') {
    // PDF chapters show the PDF only: no pages, topics, videos or questions.
    return {
      ...lesson,
      pages: [],
      topics: [],
      videoUrl: null,
      videoUrls: [],
      flashQuestions: [],
      inquiryQuestions: [],
      interactiveImages: []
    };
  }

  const topicMode = getChapterTopicMode(lesson);

  // HTML and Canvas chapters may mix freely: each page decides for itself.
  // A page with an uploaded HTML file shows the HTML (the Workspace renders iframeUrl first);
  // any other page shows its canvas text. Completely blank pages (no HTML, text, images,
  // equations or figure) are hidden, e.g. an HTML page slot whose file was never uploaded.
  const isBlankPage = (p: any): boolean => {
    if (p.iframeUrl && String(p.iframeUrl).trim().length > 0) return false;
    if (p.leftImage || p.centerImage || p.rightImage) return false;
    if (p.equations && p.equations.length > 0) return false;
    if (p.figure) return false;
    const text = String(p.content || '');
    if (text.includes('<img')) return false;
    const stripped = text.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
    return stripped.length === 0;
  };

  const shapePages = <P extends { content: string; iframeUrl?: string | null; pageNumber: number }>(pages: P[] = []): P[] =>
    pages
      .filter(p => !isBlankPage(p))
      .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

  if (topicMode === 'topics') {
    return {
      ...lesson,
      pdfUrl: null,
      pages: [],
      topics: (lesson.topics || []).map(t => ({ ...t, pages: shapePages(t.pages || []) }))
    };
  }

  return {
    ...lesson,
    pdfUrl: null,
    topics: [],
    pages: shapePages(lesson.pages || [])
  };
};
