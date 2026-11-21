/**
 * In the Android app, swaps the online image links inside a piece of HTML (question text,
 * answers, flash cards) for the copies saved on the device, so pictures show with no internet.
 * On the web the service worker already serves saved copies, so the HTML is returned as is.
 */
import { useEffect, useState } from 'react';
import { getLocalImageSrc } from './imageCache';

const isNativeApp = () =>
  typeof (window as any).Capacitor !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

export function useOfflineHtml(html: string): string {
  const [out, setOut] = useState(html);
  useEffect(() => {
    setOut(html);
    if (!html || !isNativeApp()) return;
    const urls = Array.from(new Set(Array.from(html.matchAll(/<img[^>]+src=["'](https?:[^"']+)["']/gi)).map(m => m[1])));
    if (urls.length === 0) return;
    let alive = true;
    Promise.all(urls.map(u => getLocalImageSrc(u).then(local => [u, local] as const).catch(() => [u, u] as const)))
      .then(pairs => {
        if (!alive) return;
        let next = html;
        pairs.forEach(([u, local]) => { if (local && local !== u) next = next.split(u).join(local); });
        setOut(next);
      });
    return () => { alive = false; };
  }, [html]);
  return out;
}
