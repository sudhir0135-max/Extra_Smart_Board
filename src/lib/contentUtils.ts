import { Topic, Lesson, InquiryQuestionObj } from '../types';

export const hasTextContent = (html: string | undefined | null): boolean => {
  if (!html) return false;
  
  // Check for any images embedded in the rich text (base64 or URLs)
  if (html.includes('<img')) return true;

  // Remove HTML tags to check if there is actual text
  const stripped = html.replace(/<[^>]*>?/gm, '').trim();
  
  // If the string length is greater than 0, it has text content
  // Exclude common blank editor remnants like zero-width spaces or purely empty tags
  return stripped.length > 0 && stripped !== '&nbsp;';
};

export const getEffectiveTopicInquiryQuestions = (
  topic?: Topic | null,
  lesson?: Lesson | null
): (string | InquiryQuestionObj)[] => {
  if (!topic) return [];

  const directQuestions = (topic.inquiryQuestions || []).filter(Boolean);
  const topicTitleLower = (topic.title || '').trim().toLowerCase();

  const lessonMatchingQuestions: (string | InquiryQuestionObj)[] = [];
  if (lesson?.inquiryQuestions && topicTitleLower) {
    for (const q of lesson.inquiryQuestions) {
      if (!q) continue;
      if (typeof q !== 'string') {
        const qTopicTitle = (q.topicTitle || '').trim().toLowerCase();
        if (qTopicTitle && qTopicTitle === topicTitleLower) {
          lessonMatchingQuestions.push(q);
        }
      }
    }
  }

  // Deduplicate direct questions and lesson matching questions by question ID or content
  const combined = [...directQuestions, ...lessonMatchingQuestions];
  const seenKeys = new Set<string>();
  const result: (string | InquiryQuestionObj)[] = [];

  for (const q of combined) {
    const key = typeof q === 'string' ? `str:${q}` : `id:${q.id || q.text}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      result.push(q);
    }
  }

  return result;
};


/**
 * Bulk-upload safeguard: questions only appear on a topic ribbon when their Topic exactly matches
 * (ignoring case/spaces) one of the chapter's topic titles. Before saving, list any Topic values that
 * match none of them and ask the editor whether to continue. Returns true to continue.
 */
export const confirmUploadTopics = (
  topicTitles: (string | null | undefined)[],
  availableTopics: string[]
): boolean => {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const known = new Set(availableTopics.filter(Boolean).map(norm));
  const counts = new Map<string, number>();
  topicTitles.forEach(t => {
    const v = (t || '').trim();
    if (!v || known.has(norm(v))) return;
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  if (counts.size === 0) return true;

  const list = Array.from(counts.entries()).map(([t, n]) => `  • "${t}" (${n} question${n > 1 ? 's' : ''})`).join('\n');
  const chapterTopics = availableTopics.length > 0
    ? `This chapter's topics are:\n${availableTopics.map(t => `  • ${t}`).join('\n')}`
    : 'This chapter has no topics.';
  return window.confirm(
    `These Topic names in the file don't match any topic of the selected chapter:\n${list}\n\n` +
    `${chapterTopics}\n\n` +
    `Those questions will be saved to the chapter but will NOT appear on any topic ribbon. ` +
    `Check that the right chapter is selected and the Topic names are spelled exactly as above.\n\n` +
    `Continue the upload anyway?`
  );
};
