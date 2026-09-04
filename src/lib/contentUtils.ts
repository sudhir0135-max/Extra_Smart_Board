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

