/**
 * YouTube thumbnails for offline use: one fixed thumbnail URL per video, so the same picture is
 * saved on the device (Android: file cache; web: service-worker cache) and shown with no internet.
 */
export function youtubeIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return m ? m[1] : null;
}

export const youtubeThumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** Thumbnail URLs of every YouTube video in a chapter (chapter videos + topic videos). */
export function lessonVideoThumbs(lesson: any): string[] {
  const urls: string[] = [];
  const add = (list: any) => (Array.isArray(list) ? list : (list ? [list] : [])).forEach((u: any) => {
    const id = youtubeIdFromUrl(typeof u === 'string' ? u : null);
    if (id) urls.push(youtubeThumbUrl(id));
  });
  add(lesson?.videoUrls && lesson.videoUrls.length ? lesson.videoUrls : lesson?.videoUrl);
  (lesson?.topics || []).forEach((t: any) => add(t?.videoUrls && t.videoUrls.length ? t.videoUrls : t?.videoUrl));
  return Array.from(new Set(urls));
}
