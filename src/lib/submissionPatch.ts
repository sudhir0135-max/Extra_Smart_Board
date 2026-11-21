/**
 * Change-only editor submissions.
 *
 * An editor submits either the chapter's CONTENT (chapter details, topics, topic order) or its
 * QUESTIONS (flash + inquiry). Only what changed compared with the live chapter is sent:
 *   - questions: added/edited questions (by id) + ids of deleted ones + the editor's order
 *   - content:   changed chapter fields + added/edited topics (whole topic, by id)
 *                + ids of deleted topics + the topic order
 * On approval the patch is applied to the CURRENT live chapter, so two editors working on the
 * same chapter (one on content, one on questions) never overwrite each other.
 *
 * Pure functions only (no Firebase) so they can be unit-tested.
 */

export type QuestionDiff = { upsert: any[]; deleted: string[]; order: string[] };
export type ContentDiff = {
  fields: Record<string, any>;
  topicsUpsert: any[];
  topicsDeleted: string[];
  topicOrder: string[] | null;
};
export type QuestionsPart = { flash: QuestionDiff | null; inquiry: QuestionDiff | null };
export type SubmissionPatch = { questions?: QuestionsPart | null; content?: ContentDiff | null };

/** Fields that are NOT chapter "content" (questions, topics and bookkeeping are handled apart). */
const NON_CONTENT_FIELDS = new Set([
  'id', 'order', 'payloadUrl', 'flashQuestions', 'inquiryQuestions', 'topics',
  '_patch', '_submissionKinds',
]);
const TOPIC_QUESTION_FIELDS = new Set(['flashQuestions', 'inquiryQuestions']);

const stable = (v: any) => JSON.stringify(v === undefined ? null : v);
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v === undefined ? null : v));

/** Stable key of a question: its id, or its text for old plain-text questions. */
export function questionKey(q: any): string {
  if (typeof q === 'string') return `str:${q}`;
  if (!q) return 'null';
  if (q.id) return `id:${q.id}`;
  return `txt:${q.text ?? q.question ?? ''}`;
}

/** All flash questions of a chapter (chapter list + topic-only ones), like the editor shows them. */
export function aggregateFlash(lesson: any): any[] {
  const all: any[] = [...(lesson?.flashQuestions || [])].filter(Boolean);
  for (const t of lesson?.topics || []) {
    for (const q of t?.flashQuestions || []) {
      if (!q) continue;
      if (!all.some(a => questionKey(a) === questionKey(q))) all.push(q.topicTitle ? q : { ...q, topicTitle: t.title });
    }
  }
  return all;
}

/** All inquiry questions of a chapter (chapter list + topic-only ones). */
export function aggregateInquiry(lesson: any): any[] {
  const all: any[] = [...(lesson?.inquiryQuestions || [])].filter(Boolean);
  for (const t of lesson?.topics || []) {
    for (const q of t?.inquiryQuestions || []) {
      if (!q) continue;
      if (!all.some(a => questionKey(a) === questionKey(q))) {
        all.push(typeof q === 'string' || q.topicTitle ? q : { ...q, topicTitle: t.title });
      }
    }
  }
  return all;
}

/** What changed between the live and the draft question lists (null = nothing). */
export function diffQuestions(live: any[], draft: any[]): QuestionDiff | null {
  const liveMap = new Map(live.map(q => [questionKey(q), q]));
  const draftKeys = new Set(draft.map(questionKey));
  const upsert = draft.filter(q => {
    const l = liveMap.get(questionKey(q));
    return l === undefined || stable(l) !== stable(q);
  });
  const deleted = live.map(questionKey).filter(k => !draftKeys.has(k));
  const order = draft.map(questionKey);
  const orderChanged = stable(order) !== stable(live.map(questionKey).filter(k => draftKeys.has(k)));
  if (upsert.length === 0 && deleted.length === 0 && !orderChanged) return null;
  return clean({ upsert, deleted, order });
}

/** Applies a question diff to the live list. Questions not mentioned stay exactly as they are. */
export function applyQuestions(live: any[], diff: QuestionDiff | null | undefined): any[] {
  if (!diff) return live;
  const deleted = new Set(diff.deleted || []);
  const upserts = new Map((diff.upsert || []).map(q => [questionKey(q), q]));
  const byKey = new Map<string, any>();
  for (const q of live) {
    const k = questionKey(q);
    if (!deleted.has(k)) byKey.set(k, q);
  }
  upserts.forEach((q, k) => byKey.set(k, q));
  // Editor's order first; anything else (e.g. added live by someone else) keeps its place at the end
  const ordered: any[] = [];
  const seen = new Set<string>();
  for (const k of diff.order || []) {
    if (byKey.has(k) && !seen.has(k)) { ordered.push(byKey.get(k)); seen.add(k); }
  }
  byKey.forEach((q, k) => { if (!seen.has(k)) ordered.push(q); });
  return ordered;
}

const topicWithoutQuestions = (t: any) => {
  const out: any = {};
  Object.keys(t || {}).forEach(k => { if (!TOPIC_QUESTION_FIELDS.has(k)) out[k] = t[k]; });
  return out;
};

/** What changed in the chapter content (null = nothing). */
export function diffContent(live: any, draft: any): ContentDiff | null {
  const fields: Record<string, any> = {};
  const keys = new Set([...Object.keys(live || {}), ...Object.keys(draft || {})]);
  keys.forEach(k => {
    if (NON_CONTENT_FIELDS.has(k)) return;
    if (stable(live?.[k]) !== stable(draft?.[k])) fields[k] = draft?.[k] === undefined ? null : draft[k];
  });

  const liveTopics: any[] = (live?.topics || []).filter(Boolean);
  const draftTopics: any[] = (draft?.topics || []).filter(Boolean);
  const liveTopicMap = new Map(liveTopics.map(t => [t.id, t]));
  const draftIds = new Set(draftTopics.map(t => t.id));
  const topicsUpsert = draftTopics
    .filter(t => {
      const l = liveTopicMap.get(t.id);
      return !l || stable(topicWithoutQuestions(l)) !== stable(topicWithoutQuestions(t));
    })
    .map(topicWithoutQuestions);
  const topicsDeleted = liveTopics.map(t => t.id).filter(id => !draftIds.has(id));
  const draftOrder = draftTopics.map(t => t.id);
  const liveOrderKept = liveTopics.map(t => t.id).filter(id => draftIds.has(id));
  const draftOrderOfLive = draftOrder.filter(id => liveTopicMap.has(id));
  const orderChanged = stable(liveOrderKept) !== stable(draftOrderOfLive) || topicsUpsert.some(t => !liveTopicMap.has(t.id));
  const topicOrder = orderChanged ? draftOrder : null;

  if (Object.keys(fields).length === 0 && topicsUpsert.length === 0 && topicsDeleted.length === 0 && !topicOrder) return null;
  return clean({ fields, topicsUpsert, topicsDeleted, topicOrder });
}

/** Applies a submission patch to the CURRENT live chapter and returns the full new chapter. */
export function applyPatch(live: any, patch: SubmissionPatch | null | undefined): any {
  const base = clean(live || {});
  let out: any = { ...base };
  const c = patch?.content;

  if (c) {
    Object.entries(c.fields || {}).forEach(([k, v]) => {
      if (v === null) delete out[k]; else out[k] = v;
    });
    const liveTopics: any[] = (base.topics || []).filter(Boolean);
    const liveTopicMap = new Map(liveTopics.map(t => [t.id, t]));
    const deleted = new Set(c.topicsDeleted || []);
    const byId = new Map<string, any>();
    liveTopics.forEach(t => { if (!deleted.has(t.id)) byId.set(t.id, t); });
    (c.topicsUpsert || []).forEach(t => {
      const l = liveTopicMap.get(t.id);
      byId.set(t.id, { ...t, flashQuestions: l?.flashQuestions || [], inquiryQuestions: l?.inquiryQuestions || [] });
    });
    let topics: any[];
    if (c.topicOrder) {
      const seen = new Set<string>();
      topics = [];
      c.topicOrder.forEach(id => { if (byId.has(id) && !seen.has(id)) { topics.push(byId.get(id)); seen.add(id); } });
      byId.forEach((t, id) => { if (!seen.has(id)) topics.push(t); });
    } else {
      topics = liveTopics.filter(t => byId.has(t.id)).map(t => byId.get(t.id));
      byId.forEach((t, id) => { if (!topics.some(x => x.id === id)) topics.push(t); });
    }
    out.topics = topics;
  }

  // Questions: work on the chapter's full lists (as the editor does), then rebuild topic copies
  const flash = applyQuestions(aggregateFlash(base), patch?.questions?.flash);
  const inquiry = applyQuestions(aggregateInquiry(base), patch?.questions?.inquiry);
  out.flashQuestions = flash;
  out.inquiryQuestions = inquiry;
  if (Array.isArray(out.topics)) {
    out.topics = out.topics.map((t: any) => {
      const title = (t.title || '').trim().toLowerCase();
      return {
        ...t,
        flashQuestions: flash.filter((q: any) => q && (q.topicTitle || '').trim().toLowerCase() === title),
        inquiryQuestions: inquiry.filter((q: any) => q && typeof q !== 'string' && (q.topicTitle || '').trim().toLowerCase() === title),
      };
    });
  }

  delete out.payloadUrl;
  delete out._patch;
  delete out._submissionKinds;
  return clean(out);
}

/** All video links a patch adds or changes (for the admin's preview). */
export function patchVideoLinks(patch: SubmissionPatch | null | undefined): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const c = patch?.content;
  if (!c) return out;
  const push = (label: string, urls: any) => {
    (Array.isArray(urls) ? urls : (urls ? [urls] : [])).forEach((u: any) => {
      if (typeof u === 'string' && u.trim() && !out.some(o => o.url === u.trim())) out.push({ label, url: u.trim() });
    });
  };
  if ('videoUrls' in (c.fields || {})) push('Chapter video', c.fields.videoUrls);
  else if ('videoUrl' in (c.fields || {})) push('Chapter video', c.fields.videoUrl);
  (c.topicsUpsert || []).forEach(t => push(`Topic: ${t.title || t.id}`, t.videoUrls && t.videoUrls.length ? t.videoUrls : t.videoUrl));
  return out;
}

/** All video links of a whole chapter (for full / new-chapter submissions). */
export function chapterVideoLinks(lesson: any): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const push = (label: string, urls: any) => {
    (Array.isArray(urls) ? urls : (urls ? [urls] : [])).forEach((u: any) => {
      if (typeof u === 'string' && u.trim() && !out.some(o => o.url === u.trim())) out.push({ label, url: u.trim() });
    });
  };
  push('Chapter video', lesson?.videoUrls && lesson.videoUrls.length ? lesson.videoUrls : lesson?.videoUrl);
  (lesson?.topics || []).forEach((t: any) => push(`Topic: ${t?.title || t?.id}`, t?.videoUrls && t.videoUrls.length ? t.videoUrls : t?.videoUrl));
  return out;
}

/**
 * True when the object holds a list directly inside a list (e.g. accountancy table rows).
 * Firestore cannot store that, so such data must go to Storage as a JSON file instead.
 */
export function hasNestedArrays(value: any, insideArray = false): boolean {
  if (Array.isArray(value)) {
    if (insideArray) return true;
    return value.some(v => hasNestedArrays(v, true));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(v => hasNestedArrays(v, false));
  }
  return false;
}
