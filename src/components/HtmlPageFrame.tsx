/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { getCachedHtml, downloadAndCacheHtml } from '../lib/offlineCache';

/**
 * Renders an uploaded interactive HTML page inside an iframe, aligned to the full width
 * of the student reading area.
 *
 * Uploaded HTML files usually wrap their content in centred columns
 * (e.g. `max-width:1200px; margin:0 auto`). Because those files are served from
 * Firebase Storage (a different origin), the app cannot restyle them inside a normal
 * `src` iframe. So the HTML is fetched and rendered via `srcDoc` with a small
 * alignment script injected that removes the centred max-width columns.
 * The HTML is also saved on the device (IndexedDB) so the page can be read offline.
 * If fetching fails online, it falls back to the plain `src` iframe.
 */

// Pages downloaded fresh during this session (memory only)
const htmlCache = new Map<string, string>();

const ALIGN_SCRIPT = `
<script>
(function () {
  var BLOCK_TAGS = { DIV:1, SECTION:1, NAV:1, MAIN:1, ARTICLE:1, HEADER:1, FOOTER:1, ASIDE:1, FORM:1, UL:1, OL:1, P:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, BLOCKQUOTE:1 };
  function alignContent() {
    var all = document.body ? document.body.getElementsByTagName('*') : [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!BLOCK_TAGS[el.tagName]) continue;
      var cs = window.getComputedStyle(el);
      if (cs.maxWidth === 'none') continue;
      var ml = parseFloat(cs.marginLeft) || 0, mr = parseFloat(cs.marginRight) || 0;
      // A centred column: equal non-zero side margins with a max-width cap
      if (ml > 0 && Math.abs(ml - mr) < 1) {
        el.style.setProperty('max-width', 'none', 'important');
        el.style.setProperty('margin-left', '0', 'important');
        el.style.setProperty('margin-right', '0', 'important');
      }
    }
  }
  // In-page links (#section) must scroll inside this page instead of navigating away
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var target = id ? (document.getElementById(id) || document.getElementsByName(id)[0]) : null;
    e.preventDefault();
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alignContent);
  else alignContent();
  window.addEventListener('load', alignContent);
  window.addEventListener('resize', alignContent);
})();
</script>`;

export const buildSrcDoc = (html: string, url: string): string => {
  // <base> keeps relative images/scripts/styles in the uploaded file working
  const head = `<base href="${url.replace(/"/g, '&quot;')}" target="_blank">`;
  let doc = html;
  if (/<head(\s[^>]*)?>/i.test(doc)) {
    doc = doc.replace(/<head(\s[^>]*)?>/i, m => `${m}${head}`);
  } else {
    doc = `${head}${doc}`;
  }
  if (/<\/body>/i.test(doc)) {
    // Insert by index (not String.replace) so "$" characters in the script stay literal
    const idx = doc.search(/<\/body>/i);
    doc = doc.slice(0, idx) + ALIGN_SCRIPT + doc.slice(idx);
  } else {
    doc = doc + ALIGN_SCRIPT;
  }
  return doc;
};

interface HtmlPageFrameProps {
  url: string;
  title: string;
  className?: string;
}

type FrameState =
  | { kind: 'loading' }
  | { kind: 'ready'; html: string }
  | { kind: 'direct' }   // online but fetch failed: plain src iframe
  | { kind: 'offline' }; // offline and never saved

export default function HtmlPageFrame({ url, title, className }: HtmlPageFrameProps) {
  const [state, setState] = useState<FrameState>(() => {
    const mem = htmlCache.get(url);
    return mem ? { kind: 'ready', html: mem } : { kind: 'loading' };
  });

  useEffect(() => {
    let cancelled = false;
    const show = (html: string, isFresh = false) => {
      if (isFresh) htmlCache.set(url, html);
      if (!cancelled) setState({ kind: 'ready', html });
    };

    (async () => {
      // 1. Saved copy (memory, then device storage) shows instantly and works offline
      const memoryCopy = htmlCache.get(url) || null;
      if (memoryCopy) {
        // Already loaded fresh earlier in this session: no need to download again
        show(memoryCopy);
        return;
      }
      let saved: string | null = await getCachedHtml(url);
      if (cancelled) return;
      if (saved) show(saved);
      else setState({ kind: 'loading' });

      // 2. When online, download the latest version and save it for next time
      if (navigator.onLine) {
        const fresh = await downloadAndCacheHtml(url);
        if (cancelled) return;
        if (fresh) {
          htmlCache.set(url, fresh);
          if (fresh !== saved) show(fresh, true);
          return;
        }
      }

      if (!saved && !cancelled) {
        setState(navigator.onLine ? { kind: 'direct' } : { kind: 'offline' });
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  if (state.kind === 'direct') {
    return (
      <iframe
        src={url}
        title={title}
        className={className}
        sandbox="allow-scripts allow-same-origin allow-popups"
        allowFullScreen
      />
    );
  }

  if (state.kind === 'offline') {
    return (
      <div className={`${className || ''} !bg-slate-900/60 !border !border-slate-700/50 flex flex-col items-center justify-center gap-2 text-slate-400 p-6 text-center`}>
        <p className="font-bold text-slate-300 text-sm">Page Not Saved for Offline Use</p>
        <p className="text-xs text-slate-500 max-w-sm">
          This interactive page hasn't been downloaded on this device yet. Open it once while online (or use Synchronize) to read it offline.
        </p>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className={`${className || ''} flex items-center justify-center text-slate-500 text-sm font-mono`}>
        Loading interactive page...
      </div>
    );
  }

  return (
    <iframe
      srcDoc={buildSrcDoc(state.html, url)}
      title={title}
      className={className}
      // No allow-same-origin: the uploaded page runs isolated from the app
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals"
      allowFullScreen
    />
  );
}
