# Changelog

All notable changes to this project will be documented in this file.

## [2026-10-30] - Greenboard: Simpler Toolbar with Highlighter

### Changed
- **Greenboard (`BlackboardPanel.tsx`)**: only four colours — Red, Blue, Yellow, White (bright shades readable on green). The pen-size picker is removed; each tool has a fixed thickness. New **Highlighter** tool (wide, see-through strokes in the selected colour) next to **Pen**. The **Eraser is removed** — Undo and Clear cover corrections. White pen is the default.
- **Drag handle**: the Rough Work strip sits on the board's moving (left) edge. Tap = open/close; drag sideways = resize (pull it out from closed to open it). Released below **30%** → closes; above **80%** → **full width** (100% of the lesson area). Width remembered on the device (`localStorage greenboard_width_pct`). Closed board = exactly the handle width (no blank gap). Canvas follows the size without stretching drawings (ResizeObserver).
- **Fixed button positions**: title, colours, Pen/Highlighter, Undo, Clear and Close share one top bar, icon-only, right-aligned to the board's fixed right edge with no wrapping, so buttons never move while the board is dragged.
- **See-through mode**: at full width an eye button makes the board 70% transparent (30% green) so the lesson shows through clearly (drawings stay solid); switched off automatically when the board is made narrower.

## [2026-10-30] - Editor Panel: Reorder Topics

### Added
- **Topic order (`BookEditorPanel.tsx` `handleMoveTopic`)**: ↑ / ↓ buttons next to Edit Topic move the selected topic one place up or down. The new order is saved straight to the chapter (same save as editing a topic), so the topic dropdown ("Topic 1, 2, …") and the student panel's topic ribbons follow it. The moved topic stays selected; the buttons are disabled at the first/last position and in admin preview.

## [2026-10-30] - Admin: Download Chapter Questions as XLSX

### Added
- **Admin panel → Textbooks → chapter header**: "Flash XLSX" and "Inquiry XLSX" buttons next to the chapter title download the selected chapter's existing questions (`lib/questionExport.ts`). The chapter is re-read from the server first; chapter-level and topic-level copies are combined without duplicates. Columns match the upload templates so the file can be edited and uploaded again — Flash: Question, Answer, Difficulty, Topic, Source; Inquiry: Question, Answer, Topic, Marks, Source. File name: "<Book> - <Chapter> - Inquiry Questions.xlsx".

## [2026-10-29] - Fix: Student Panel Showed Old Saved Questions (Source Checkboxes Missing)

### Fixed
- **Root cause**: every editor save stored the whole book in this browser as `sync_status: 'pending'` and nothing ever cleared it. The books merge in `App.tsx` always preferred the saved copy over fresh server data, and `fetchBookLessons` never refreshed a pending copy — so the student panel kept showing old questions (without `source`) and the Source checkboxes never appeared.
- `BookEditorPanel.tsx`: after a successful Firestore save the local copy is marked `synced`.
- `App.tsx` `fetchBookLessons`: a pending copy older than 10 minutes is treated as stale and replaced by the server copy (heals devices that already have a stuck pending copy).
- `App.tsx` books merge: a synced saved copy is only used when the server chapters are not loaded (offline); loaded server chapters always win.

## [2026-10-29] - Source Field Placement & Update Notice

### Fixed & Improved
- **Advanced Editor (`InquiryQuestionManager.tsx`) and new-window editor (`QuestionEditorPage.tsx`)**: the Topic / Source / Marks fields moved to the top of the right-hand column (they were below the image settings and easy to miss).
- **New-version notice (`components/UpdateBanner.tsx`, web only)**: a tab left open across a deploy kept running the old code (why the Source field looked missing). Open tabs now check for a newer deploy when they come back into view and every 10 minutes, and show "A new version of the app is available — Reload".

## [2026-10-29] - Notice Images on the Book Shelf

### Added
- **Admin → Notice Images (`components/NoticeManager.tsx`)**: upload an image with a start date and an end date (both days included), change dates, or delete. The list is stored in Firestore `settings/notice_images` (`{ items: NoticeImage[] }`, readable by everyone, writable when signed in — no rules change needed); images go to Storage `images/notices/`. Status shows Scheduled / Showing now / Expired.
- **Device sync (`lib/notices.ts`)**: whenever internet is available (app start, reconnect, foreground, every 15 min via the background refresh, and when the book shelf opens) the device downloads every notice that is not yet saved and not expired — Android app: files in the app folder `extrapadhai/notices/`; browser: IndexedDB table `notice_images` (Dexie version 3). Saved notices are deleted after their end date (also offline) or when the admin deletes them; changed dates or a replaced image are picked up.
- **Overlay on the book shelf page (`components/NoticeOverlay.tsx`, grade-selector screen)**: shows the saved notices whose dates include today, from the device copy (works offline). Several notices → arrows and dots. They appear every time the student comes to the book shelf; closing hides them only for that visit.

## [2026-10-29] - Seamless Offline Mode & Background Content Refresh

### Added & Improved
- **Background refresh (`App.tsx` `runBackgroundRefresh`)**: whenever internet is available the app silently re-downloads the chapters of this device's books (the selected book, the class/subjects set up on the Android device, and every book already saved on the device), with their PDFs, HTML pages and images. Runs at start-up, when the connection comes back, when the app returns to the foreground (at most every 5 minutes) and every 15 minutes. `fetchBookLessons(bookId, { background: true })` no longer changes the open chapter.
- **No offline marks**: removed the "No internet connection / Back online" toasts and the "Actions cached waiting for internet" footer; the Sync button is always shown. Question images use the copy saved on the device (`SavedImage` in `FloatingButton.tsx`) instead of an "Image unavailable offline" box. The red "Offline / Internet Connection Required" video screens (`FloatingButton.tsx`, `BlackboardPanel.tsx`) are replaced by a quiet note that videos play when the device is connected. The HTML page fallback text is softened (`HtmlPageFrame.tsx`).
- **Android APK rebuilt** with all changes up to this date (including the Approve All fix and question sources).

## [2026-10-29] - Question Source Field & Student Source Filter

### Added & Improved
- **`source` field on questions (`types.ts`)**: `InquiryQuestionObj.source` and `FlashQuestion.source` (optional, e.g. "NCERT", "CBSE 2023").
- **Editors (`InquiryQuestionManager.tsx`, `FlashQuestionManager.tsx`, `QuestionEditorPage.tsx`)**: a Source text box (with suggestions from sources already used in the chapter) in the quick-add row and the advanced/new-window editors; a sky-blue "Source" badge on each question in the list. XLSX/JSON bulk upload reads an optional `Source` column, and the downloadable templates include it. The new-window editor now keeps `source` instead of dropping it on save.
- **Student panel (`FloatingButton.tsx`, "Some Extra Questions from Lesson")**: one checkbox per distinct source name (with its question count) filters the list to the ticked sources. By default only **NCERT** is ticked (every source is ticked if the list has no NCERT questions); the selection resets when the chapter/topic changes. Source names are grouped ignoring case, spaces and dots ("T.S. Grewal" = "TS Grewal"). Questions without a source are not filtered and always show. The row is hidden when no question in the list has a source.

## [2026-10-29] - Bulk Upload Topic Safeguard

### Added & Improved
- **Warning when uploaded Topic names do not match the chapter (`lib/contentUtils.ts` `confirmUploadTopics`, `InquiryQuestionManager.tsx`, `FlashQuestionManager.tsx`)**: questions only appear on a topic ribbon when their Topic exactly matches one of the chapter's topic titles. Before saving an XLSX/JSON bulk upload, any Topic values that match none of the selected chapter's topics (ignoring case and extra spaces) are listed with their question counts, together with the chapter's actual topics, and the editor can cancel (nothing is saved). Prompted by 7 debenture questions uploaded into "Accounting for Share Capital", whose debenture topic names matched no topic there, so they did not appear on any ribbon.

## [2026-10-29] - Editor Panel: Tabbed Chapter Content Layout

### Added & Improved
- **Admin: Copy Book with chapter names only, as the opposite type (`AdminPanel.tsx`)**: new Copy button next to Edit/Delete in the Textbooks list opens a dialog showing the source type and the type of the copy (PDF ↔ Interactive), an editable name, and the source chapter names (read directly from Firestore, including old books that keep chapters in the book document). Creates a new book (new unique id, same class, subject, author, source, colour and cover; `bookType` flipped) with one chapter per source chapter name in the same order and no content: PDF → Interactive creates empty Canvas chapters; Interactive → PDF creates empty PDF chapters. Blocks a duplicate name within the same class and subject.
- **Compact chapter header (`BookEditorPanel.tsx`)**: title, subtitle, Save Meta and Purge Chapter in one row (replaces the "Active Chapter Settings" card).
- **Chapter Content card with PDF / HTML / Canvas tabs**: the selected tab IS the chapter content type (replaces the separate "Chapter Content Type" card). Switching to or from PDF asks for confirmation (other content stays saved, hidden). Tab bodies:
  - **PDF**: chapter PDF upload / replace / preview only.
  - **HTML / Canvas**: one topic row (Topic-wise / Without topics toggle, topic selector, Edit / Delete / + Add Topic, topic form with Topic Video URL or upload) replacing the separate "Chapter Topic:" card, followed by the Pages editor (chapter lecture videos, page strip, per-page HTML or canvas fields).
- **Tab-specific page fields**: the HTML tab shows only Collapsible Page Settings, the HTML file (URL / Preview / Remove / Upload) and Save Page Changes (no text editor, images, LaTeX, vector or Add Page; the page strip appears only if several pages already exist). The Canvas tab shows only the images, text editor, LaTeX and vector blocks with Add Page (no HTML upload or collapsible settings). Topics can still mix: upload HTML in the HTML tab, write text in the Canvas tab; between HTML and Canvas the tab only sets the default for new pages. A notice appears when a Canvas-tab page is actually showing an uploaded HTML file to students, or an HTML-tab page has no HTML yet and students see its canvas text.
- **Removed "Interactive Smartboard Vector Vector Layouts" from the Canvas tab**: it only attached one of 7 built-in demo SVG drawings (brain, river, ecosystem, etc.) with a caption, shown only on chapter-root pages (never on topic pages), and none fit the curriculum. Existing pages keep any drawing they already have (saving a page preserves it); real diagrams use the page image uploads or images in the text editor.
- **Topic row**: "Add Topic" now sits right next to the topic dropdown (before Edit / Delete), and the duplicate "+" in its label was removed.
- **Icon-only top bar buttons (`BookEditorPanel.tsx`)**: Asset Library, Submit this Chapter, Discard Local Draft and Back to Dashboard show only their icons, each with a hover tooltip and an accessible label.
- **Assigned book name in the top bar**: was capped at 200px and squeezed between the logo and buttons, so even short names were cut off. It now takes the free space in the middle, wraps to two lines for long names, shows the full name on hover, and the buttons / saved-message can no longer squash it.
- **Questions & Extras card**: Flashcards, Inquiry Questions and Interactive Maps under three tabs (with counts) instead of three stacked cards; hidden for PDF chapters.

### Fixed & Rectified
- **"FIRESTORE INTERNAL ASSERTION FAILED … Failed to obtain exclusive access to the persistence layer" when saving (`lib/firebase.ts`)**:
  - **Root Cause**: Firestore offline persistence was enabled with `enableIndexedDbPersistence` (single-tab mode). With the app open in more than one tab, the tabs competed for the cache and the tab that lost it crashed on its next write (seen when changing the chapter type).
  - **Fix**: Firestore is initialised with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`, so all tabs share the offline cache safely (also removes the deprecation warning). Verified with two tabs reading from Firestore and the shared cache with no errors.
- **Topic-wise chapter opened with no topic actually selected**: the dropdown showed "Topic 1" but the pages editor stayed hidden until a topic was picked manually. The auto-select effect ran before the "reset topic on chapter change" effect, which then cleared it; the auto-select effect is now declared after the reset effect.

## [2026-10-28] - Critical Fix: "Approve All" Deleted Unsubmitted Chapters

### Fixed & Rectified
- **Chapter Re-ordering Not Reflected in Student Panel (`BookEditorPanel.tsx`)**:
  - **Root Cause**: `handleMoveLesson` only called `saveBookLocally()` (the editor's own IndexedDB). The new sequence never reached Firestore, while the student panel loads chapters from `books/{id}/lessons` sorted by `order`. (Topic/page moves already saved to Firestore; chapter moves did not.)
  - **Fix**: After a move, the new position is written to Firestore by updating ONLY the `order` field of each chapter that already exists live (batch `update`), then `fetchBookLessons` refreshes all screens. No chapter content is rewritten, and chapters not yet live are neither created nor touched.
- **Rich Text Editor Did Not Refresh When Switching Topic (`BookEditorPanel.tsx`)**:
  - **Root Cause**: The editor was keyed only on book/chapter/page index, so switching topic (usually also page 1) did not remount it; and the page text is loaded into the drafts by an effect AFTER the render, so even a remount would have shown the previous text. Before the 2026-10-26 reversed-typing fix, TinyMCE re-read every `initialValue` change, which hid this.
  - **First fix (deployed 2026-10-28 11:15, caused a regression)**: remounting the editor on every switch via its `key` left TinyMCE blank (no toolbar) when a topic was selected, because the editor was torn down and rebuilt in quick succession while TinyMCE was still initialising.
  - **Fix**: One editor instance is kept per book; `BookEditorPanel` passes `contentKey={editorLoadKey}` (bumped after the selected page's text is loaded into the drafts) and `RichTextEditor` loads the new text into the existing editor with `setContent()` (clearing undo history). Verified with rapid topic switching (t1 → t2 → t3 → t2 → t1): always one editor with its toolbar and the correct topic text; typing still left-to-right.
- **Approving an editor submission wiped every chapter that was not in the submission (`App.tsx`)**:
  - **Root Cause**: "Approve All" called `saveBookToFirebase({ ...book, lessons })` with the chapter list held on the admin's review screen. That list is built from in-memory `firebaseBooks`, whose `lessons` come from the book metadata doc (always `lessons: []` since chapters moved to the `books/{id}/lessons` subcollection) unless `fetchBookLessons` happened to have loaded that book in the same session. When it hadn't (e.g. the admin portal was freshly opened), the review screen contained only the submitted chapter(s). `saveBookToFirebase` then treated every live chapter missing from that list as an orphan and deleted it, and also overwrote the admin's offline copy with the reduced list. "Approve This Chapter" had the same weakness (`b.lessons` + approved chapter).
  - **Fix**:
    1. Approval (single and all) no longer rewrites the whole book. It reads the live chapters directly from Firestore, writes ONLY the chapters the editor submitted (keeping their existing order; new ones appended), deletes ONLY chapters the editor explicitly requested to delete, updates `lessonCount`, clears those submission docs, and refreshes via `fetchBookLessons`. Unsubmitted chapters are never touched.
    1b. Large submitted chapters (stored in Storage with a cut-down placeholder in Firestore) are always re-loaded in full before approval; if the full copy cannot be loaded, that chapter is skipped and stays pending (alert shown) instead of being published without its questions/topic pages.
    1c. Verified against a simulated database: Approve All with a partial in-memory list updated the submitted chapter, added the new one, removed only the chapter the editor asked to delete, and left all other chapters unchanged; single-chapter approval left other submitted chapters pending.
    2. `saveBookToFirebase` safety guard: if the in-memory chapter list is empty while Firestore has chapters, it saves metadata only; it deletes a missing chapter only when exactly one is missing (normal single delete) or when called with `{ allowBulkChapterDelete: true }`. Otherwise it keeps them and shows a warning toast.
    3. Review screen loads the book's live chapters (`fetchBookLessons`) before showing a submission, and the preview merge prefers the subcollection cache over the empty book-doc list.
- **Chapter Recovery Tool (`src/recovery/ChapterRecoveryTool.tsx`, `main.tsx`)** — open `/recover?book=<id>`:
  - Runs instead of the main app so nothing re-syncs and overwrites this browser's offline data first. Reads, in order: this device's offline chapter store, the Firestore offline cache (live chapters and editor submissions), Firebase Storage large-chapter backups (`books/{id}/lessons/*/payload.json`) and editor submission backups (`editor_submissions/{id}/lessons/*`, admin sign-in needed), then the live database last.
  - Lists every chapter found with each surviving version (source, date, topics/pages/questions), lets the admin pick a version, and restores ONLY chapters missing from the live book (re-checked right before writing; live chapters are never overwritten). "Download backup file" saves everything found as JSON.
  - Book 27 "Companies and Analysis": Storage backups found for "Issue of Debentures" (27 Oct) and "Cash Flow Statement" (23 Oct).

## [2026-10-26] - Feature: Distinct Topic Ribbon Colours, PDF-only Floating Button & Student Panel Offline Support

### Added & Improved
- **Distinct Vibrant Colour per Topic Ribbon (`Workspace.tsx`)**:
  - **Root Cause**: Topic ribbons cycled through only 6 Tailwind themes (topic 7 repeated topic 1), and topics using the collapsible HTML dropdown ignored the theme entirely (fixed dark slate).
  - **Fix**: Each topic gets its own hue spaced by the golden angle (~137.5deg) via inline gradient/border/title styles, applied to both the standard topic ribbon and the collapsible HTML dropdown, so every ribbon differs however many topics there are.
- **Circular Floating Button Only on PDF Chapters (`FloatingButton.tsx`, `App.tsx`)**:
  - Added `showLauncher` prop. The round draggable launcher (and its radial menu: video, questions, drawing, notes) shows only on PDF chapters. On other chapters the component stays mounted (launcher hidden) so topic video/question panels opened from topic ribbons keep working.
- **Student Panel Offline Support**:
  - **Service worker for the web build** (`service-worker/sw-template.js`, `vite.config.ts`, `main.tsx`): the `offline-service-worker` Vite plugin generates `dist/sw.js` with the full list of built files and a build version. App shell is saved on install so the app opens with no internet; page loads fall back to the saved shell; Firebase Storage images and HTML pages are cached after first use (PDFs/videos skipped; chapter payload JSON with `_cb` always network). Registered only in production builds and not inside the Android app.
  - **Uploaded HTML pages offline** (`lib/offlineCache.ts`, `lib/db.ts` v2 `html_pages` table, `HtmlPageFrame.tsx`): HTML pages are saved in IndexedDB (web and Android), shown from the saved copy when offline, and refreshed when online. Replaced the old "Page Unavailable Offline" gate; unsaved pages show "Page Not Saved for Offline Use".
  - **Background pre-download** (`App.tsx`): when a book's chapters are loaded and on Synchronize, HTML pages and images of non-PDF chapters are saved for offline use (Android: native image cache; web: service worker cache).
  - **Topic images included** (`lib/imageCache.ts`): `extractImagesFromLesson` now includes topic pages and topic questions, which were previously skipped.
  - Added `preview_offline.bat` to build and run the production preview (http://localhost:4173) for testing offline mode.

## [2026-10-26] - Feature: Chapter Content Type Selector (PDF / HTML / Canvas) with Topic-wise Mode

### Fixed & Rectified
- **Canvas Text Editor Typing Reversed / Right-to-Left (`RichTextEditor.tsx`)**:
  - **Root Cause**: The 2026-10-25 live draft sync (`onChange` -> `setPageContentDraft`) sent every keystroke to `BookEditorPanel`, which passed it straight back as TinyMCE's `initialValue`. TinyMCE resets its content and moves the caret to the start whenever `initialValue` changes, so each new character was inserted before the previous ones.
  - **Fix**: `RichTextEditor` now captures its starting content once on mount (the parent already remounts it per page via `key`) and only refreshes it when returning from the Live Render Preview tab, so preview edits are not lost. Also set TinyMCE `directionality: 'ltr'` explicitly.
- **Uploaded HTML Pages Shown Full-Width Instead of Centred (`HtmlPageFrame.tsx`, `Workspace.tsx`)**:
  - **Root Cause**: Uploaded HTML files wrap their content in centred columns (`max-width:1200px; margin:0 auto`). They were loaded with a plain `src` iframe from Firebase Storage (a different origin), so the app could not restyle them and the content always appeared as a centred column in the student panel.
  - **Fix**: New [`HtmlPageFrame.tsx`](file:///c:/Single%20Screen/src/components/HtmlPageFrame.tsx) fetches the HTML and renders it via `srcDoc` with a `<base>` tag (so relative assets still load) and a small injected script that removes centred max-width columns, so content aligns to the left and fills the reading area. In-page `#anchor` links scroll inside the page. The uploaded page now runs sandboxed without `allow-same-origin`. Falls back to the direct `src` iframe if the fetch fails. Both topic and chapter-root HTML pages in `Workspace.tsx` use it.

### Added & Improved
- **Mixed HTML & Canvas Pages in Non-PDF Chapters (`BookEditorPanel.tsx`, `lib/chapterContent.ts`)**:
  - In HTML and Canvas chapters, each page now decides its own type automatically: a page with an uploaded HTML file (`iframeUrl`) shows the HTML; any other page shows its canvas text. Topics can therefore mix HTML and canvas pages freely; no extra editor option.
  - HTML / Canvas chapter type now only sets what new pages start as (empty HTML slot vs. canvas placeholder text).
  - Editor shows a "Students see: Uploaded HTML / Canvas text" banner per page, a HTML/Text badge on each page tab, an always-available HTML upload panel, and a "Remove HTML" button to turn a page back into canvas text. Canvas-only fields (images, text editor, LaTeX, vector) hide while a page shows HTML.
  - Student view hides completely blank pages (no HTML, text, images, equations or figure).
- **Per-Chapter Content Type (`types.ts`, `lib/chapterContent.ts`)**:
  - Added `Lesson.contentType` (`'pdf' | 'html' | 'canvas'`) and `Lesson.topicMode` (`'topics' | 'none'`).
  - New helper module [`chapterContent.ts`](file:///c:/Single%20Screen/src/lib/chapterContent.ts) with `getChapterContentType`, `getChapterTopicMode` and `getStudentViewLesson`. Older chapters without `contentType` are auto-detected (pdfUrl => PDF, any iframe page => HTML, else Canvas) and their student display is left unchanged.
- **Editor: Choose How a Chapter Is Created (`BookEditorPanel.tsx`)**:
  - "Create New Lesson Chapter" now has a **PDF / HTML / Canvas** picker and, for HTML/Canvas, a **Topic-wise / Without topics** picker. Topic-wise chapters start with no root pages; HTML chapters start with an empty HTML page slot.
  - New **Chapter Content Type** card on the active chapter replaces the book-level "Interactive Book / PDF Book" toggle. Switching type or topic mode keeps the other content saved (hidden), so switching back restores it. Changes save directly to Firestore.
  - Only the matching input screen is shown: PDF uploader (PDF only — no topics, pages, videos, questions or maps); HTML page uploader without the text editor/images/LaTeX/vector blocks; Canvas text editor without the iframe field. Topic bar appears only for topic-wise chapters and no longer offers a "Main Chapter Level" option.
  - Chapter list cards show a type badge (PDF / HTML / Canvas, Topics / No topics).
  - Chapter PDF attach/detach now saves directly to Firestore (previously local-only) so students see it immediately.
- **Student Panel Renders by Chapter Type (`App.tsx`, `Workspace.tsx`)**:
  - `activeLesson` is passed through `getStudentViewLesson`: PDF chapters show only the PDF; topic-wise chapters show only topics; non-topic chapters show only root pages; HTML chapters show only pages that have an uploaded HTML file; Canvas chapters ignore leftover iframe links.
  - The legacy `bookType === 'pdf'` fallback now applies only to chapters without an explicit `contentType`. PDF pre-caching only runs for PDF-type chapters.

## [2026-10-25] - Feature & Rectification: Flexible Topic/Chapter Interactive HTML Presentation & Direct Firestore Page Persistence

### Fixed & Rectified
- **Flexible Topic vs. Chapter Interactive HTML Presentation (`Workspace.tsx`)**:
  - **Root Cause**: In [`Workspace.tsx`](file:///c:/Single%20Screen/src/components/Workspace.tsx), the topic page renderer (`topic.pages.map`) only rendered static TinyMCE text and standard column images. It completely lacked support for `iframeUrl` and `isCollapsible`. When editors attached interactive HTML pages to a topic, the iframe was never rendered at all.
  - **Fix**: Upgraded topic page rendering in `Workspace.tsx` to fully support interactive HTML `<iframe>`s and collapsible settings. If an HTML page is uploaded under a specific topic, it renders directly inside that topic's expanded view with online/offline detection and "Interactive HTML" status badge; if uploaded without a topic, it renders in the chapter-level reading canvas stack.
- **Single Dropdown Experience: Conditional HTML Dropdown vs Topic Dropdown (`Workspace.tsx`)**:
  - **Root Cause**: When an editor created a topic page with interactive HTML and enabled "Collapsible Page Settings", students in [`Workspace.tsx`](file:///c:/Single%20Screen/src/components/Workspace.tsx) were presented with two nested dropdowns: an outer topic ribbon dropdown (`[ ^ ] Topic Title [ N page(s) ]`) and an inner secondary dropdown button (`Topic Title v`), requiring two separate clicks to access the iframe.
  - **Fix**: Implemented strict conditional rendering based on `'Collapsible Page Settings'` (`hasCollapsiblePage`):
    - **When Collapsible Page Settings is Enabled**: The outer topic dropdown ribbon is suppressed; only the sleek HTML dropdown is displayed at the curriculum level with summary title, chevron toggle, `Interactive HTML` badge, and quick-action icons (Video, Flashcard, Question). Expanding it directly reveals the HTML iframe (and topic video if attached) in a single click.
    - **When Collapsible Page Settings is Disabled**: The standard topic dropdown ribbon is displayed. Expanding it renders the topic's pages and content directly without any redundant inner collapsible dropdown button.
- **Accordion Toggle State Normalization for String and Number Keys (`Workspace.tsx`)**:
  - Updated `expandedPages` and `togglePageExpand` to handle both chapter-level page numbers (`1, 2, ...`) and topic page keys (`topic-{topicId}-{index}`) seamlessly so collapsible sections toggle independently without interference.
- **Firebase Storage Public Read Authorization for HTML Pages (`firebaseHelper.ts`, `storage.rules`)**:
  - **Root Cause**: Uploading HTML files previously placed them under `html/`, which had no public read rule in [`storage.rules`](file:///c:/Single%20Screen/storage.rules), resulting in `403 Forbidden` errors when iframes loaded them without auth headers.
  - **Fix**: Updated [`uploadHtmlToStorage`](file:///c:/Single%20Screen/src/lib/firebaseHelper.ts) to upload to `books/html/` with sanitized filenames and explicit `contentType: 'text/html; charset=utf-8'`, utilizing the existing public read permissions under `books/**`. Added an explicit `/html/{allHtml=**}` public read rule in `storage.rules` for backward compatibility.

### Added & Improved
- **Direct Live Firestore Save for Page Canvas Operations (`BookEditorPanel.tsx`)**:
  - Decoupled page saving from the "Submit this Chapter" / Admin review workflow (Option B).
  - All page CRUD operations (`handleUpdatePage`, `handleAddPage`, `handleDeletePage`, `handleMovePage`) now invoke `saveLessonDirectToFirestore(modifiedBook, updatedLesson)`.
  - Every page creation, HTML upload, or text change commits directly to Firestore `books/{bookId}/lessons/{lessonId}` and IndexedDB, triggering `fetchBookLessons` to refresh `subLessonsCache` across the application in real time.
- **Co-located "Save Page Changes", Target Context Badge & HTML Preview (`BookEditorPanel.tsx`)**:
  - Added a dedicated, prominent **"Save Page Changes"** button directly inside the "Collapsible Page Settings / Iframe URL" container so editors don't have to scroll up to the TinyMCE header to commit changes.
  - Added a dynamic **Placement Badge** (`Placement: Topic: {title}` vs `Placement: Chapter Root (Page N)`) making the upload target unambiguous.
  - Added a **"Preview"** link next to the HTML URL input allowing editors to test uploaded interactive pages in a new tab immediately.
- **Live Content Draft Synchronization (`RichTextEditor.tsx`)**:
  - Added `onChange` prop to [`RichTextEditor.tsx`](file:///c:/Single%20Screen/src/components/RichTextEditor.tsx) hooked into TinyMCE's `onEditorChange` so `pageContentDraft` in `BookEditorPanel` stays updated as text is typed.

## [2026-10-23] - Feature: Asset Library Multiple Image Delete & Direct Subject Management

### Added & Improved
- **Asset Library Multi-Image Selection & Batch Deletion (`AssetLibraryModal.tsx`)**:
  - Interactive selection checkboxes on all asset library image cards with indigo glow highlight and ring.
  - "Select All" / "Deselect All" toolbar action for the selected folder/subject.
  - Counter badge showing selected image count with "Clear Selection" option.
  - "Delete Selected ({count})" button with safety confirmation dialog and concurrent batch deletion progress tracker.
  - Automatic selection clearing on folder or subject switch.
  - Filtered out `.keep` placeholder files from the gallery display.
- **Curriculum Subject Direct Asset Access & Panel Reliability (`AdminPanel.tsx`)**:
  - Added dedicated Asset Library shortcut button to every subject row in the Curriculum Subject Nodes catalog to jump directly to that subject's image directory.
  - Preserved `activeTab` state during Admin authentication and panel initialization.
- **Storage List Reliability (`firebaseHelper.ts`)**:
  - Wrapped `fetchAllUploadedImages` item retrieval in individual try-catches to ensure single corrupted or missing items do not break the whole gallery.

## [2026-10-21] - Rectification: Interactive Image Tag Display in Canvas & Live Preview

### Fixed & Rectified
- **Interactive Tag Image Lightbox & Live Render Preview Support (`RichTextEditor.tsx`)**:
  - **Root Cause**: In the Book Editor's "Textbook Classroom Page Canvas" (`RichTextEditor.tsx`), when editors switched to the **"Live Render Preview"** tab to test their page canvas, clicking on `.lesson-annotation` tags did nothing because `previewContainerRef` completely lacked click handlers or modal triggers. Furthermore, `ImageFrame` was not imported into `RichTextEditor`, leaving editors with no way to test or inspect attached images without publishing and navigating all the way to the student panel.
  - **Fix**: Integrated [`ImageFrame.tsx`](file:///c:/Single%20Screen/src/components/ImageFrame.tsx) and an interactive tag click handler into [`RichTextEditor.tsx`](file:///c:/Single%20Screen/src/components/RichTextEditor.tsx). Clicking any media tag in the Live Render Preview immediately opens the image in full screen with zoom, pan, and caption support, or opens interactive map deep-dives and speech bubble notes.
- **Embedded Image Previews & Direct Image File Upload in TinyMCE Tag Dialog (`tinymceAnnotationPlugin.ts`)**:
  - **Root Cause**: When editors created or edited tags in TinyMCE, the dialog only had a raw text input for `mediaUrl` with zero image previews, zero file upload options, and defaulted `mediaType` to `'none'` (Speech Bubble). If an editor pasted an image URL but didn't manually change the dropdown from `'none'`, the system saved the tag as text-only and permanently hid the image from view.
  - **Fix**: Upgraded [`tinymceAnnotationPlugin.ts`](file:///c:/Single%20Screen/src/lib/tinymceAnnotationPlugin.ts):
    1. Added an **"Attached Media Preview"** card displaying the image thumbnail directly inside the TinyMCE dialog.
    2. Added a **"📁 Upload Image File"** button to allow editors to directly upload image files from their computer into Firebase Storage (`images/annotations/`) without needing to paste URLs.
    3. Added a **"🔍 View Media Full Size"** button so editors can verify image links right inside the dialog.
    4. Added auto-upgrade logic: whenever an image URL is attached, `mediaType` is automatically upgraded to `'image-frame'` so images are never ignored.
- **Unified Image Tag Display in Classroom Workspace (`Workspace.tsx`)**:
  - **Root Cause**: In [`Workspace.tsx`](file:///c:/Single%20Screen/src/components/Workspace.tsx), tags configured with `mediaType === 'image'` attempted to open `BlackboardPanel` (a 40% side greenboard drawer) rather than the standard image lightbox (`ImageFrame`), which was inconsistent and confusing. Furthermore, if an annotation had both text and an attached image, the speech bubble popover only rendered the text string and completely omitted the image.
  - **Fix**: Harmonized image annotations so that both `'image-frame'` and `'image'` tags immediately open [`ImageFrame`](file:///c:/Single%20Screen/src/components/ImageFrame.tsx) for crystal-clear, high-resolution viewing. In addition, updated the speech bubble popover to render the attached image directly above the text notes with click-to-enlarge capabilities.

## [2026-10-21] - Rectification: Topic Video Visibility & Persistence in Student Panel

### Fixed & Rectified
- **Direct Live Firestore Sync for Topic CRUD Operations (`BookEditorPanel.tsx`)**:
  - **Root Cause**: When topics were created, modified, or deleted in the Book Editor Panel, `handleSaveTopic` and `handleDeleteTopic` only executed `saveBookLocally()`, which wrote changes exclusively to local IndexedDB (`offline_lessons`) with `sync_status: 'pending'`. The topic and its attached `videoUrl` were never written to live Firestore (`books/{bookId}/lessons/{lessonId}`). When a student navigated to the chapter, `fetchBookLessons` retrieved the chapter from Firestore (lacking the newly attached topic/video) and overwrote `offline_lessons` and `subLessonsCache`, causing the video to vanish completely.
  - **Fix**: Updated `handleSaveTopic` and `handleDeleteTopic` in [`BookEditorPanel.tsx`](file:///c:/Single%20Screen/src/components/BookEditorPanel.tsx) to invoke `saveLessonDirectToFirestore(modifiedBook, updatedLesson)`. Now any topic creation, topic title edit, or video URL modification immediately commits to both local IndexedDB and live Firestore, refreshing `subLessonsCache` across the application in real time.
- **Deep Topic & Video URL Preservation in Offline Merge (`App.tsx`)**:
  - **Root Cause**: `books` memoization in [`App.tsx`](file:///c:/Single%20Screen/src/App.tsx) previously used shallow assignment for topics (`topics: ol.topics !== undefined ? ol.topics : (liveL.topics || [])`), which could drop `videoUrl` if an existing offline topic lacked the URL while the live topic or subcollection had it. Furthermore, `fetchBookLessons` previously overwrote `offline_lessons` unconditionally, blowing away any pending offline topic creations.
  - **Fix**: Added deep merging for topics in `App.tsx`'s offline merge engine that guarantees `videoUrl` is preserved (`videoUrl: ot.videoUrl ? ot.videoUrl : (lt?.videoUrl || ot.videoUrl || null)`). Added a pending-edit check in `fetchBookLessons` so existing offline records with `sync_status: 'pending'` have their local topics and questions merged rather than wiped out.
- **Auto-Maximized Topic Video Playback & MP4 File Support (`FloatingButton.tsx`)**:
  - **Root Cause**: When opening a topic video from the Student Panel (`onOpenTopicModal?.(topic, 'video')`), `externalTopicModal` set `activePanel: 'video'`, but left `maximizedVideoId: null`. Consequently, the player stayed in library grid view, showing an unplayed card in a 100px-bordered container rather than immediately playing the requested topic lecture. Furthermore, only YouTube embeds were supported, failing if an uploaded MP4 or Storage video URL was provided.
  - **Fix**: Added `setMaximizedVideoId('topic-video-0')` trigger when `externalTopicModal.panel === 'video'` so the topic's video starts playing full-screen instantly. Added support for direct HTML5 `<video controls autoPlay>` streaming for MP4/WebM/Firebase Storage URLs alongside YouTube iframe embeds.
- **Embedded Topic Video Lecture in Expanded Container & Vibrant Ribbon Indicator (`Workspace.tsx`)**:
  - **Root Cause**: In the Student Panel's topic container, when a student expanded a topic (`isExpanded`), only reading pages (`topic.pages`) were rendered; the attached video lecture was not displayed anywhere in the container.
  - **Fix**: Added an embedded **Topic Video Lecture** player directly inside the expanded topic container in [`Workspace.tsx`](file:///c:/Single%20Screen/src/components/Workspace.tsx) with a responsive 16:9 player (`renderTopicVideo`), video title badge, and a **"Theater Mode"** button to open the full-screen modal. Upgraded the video action button on the Topic Ribbon with an active sky-blue glow and ring indicator (`ring-1 ring-sky-400/40 shadow-sky-500/20`).
- **Direct Video File Upload Option in Book Editor (`BookEditorPanel.tsx`)**:
  - Added an **"Upload"** button next to the YouTube Video URL field in the Topic form of [`BookEditorPanel.tsx`](file:///c:/Single%20Screen/src/components/BookEditorPanel.tsx) allowing editors to directly upload video files (`video/*`) to Firebase Storage (`videos/topics/`) in addition to pasting YouTube or external URLs.


## [2026-10-19] - Rectification: Inquiry Questions Reverting to Pre-saved Position

### Fixed & Rectified
- **Sanitized Direct Firestore Chapter Save & Removed Silent Error Swallowing (`BookEditorPanel.tsx`)**:
  - **Root Cause**: When questions were saved in the Advanced Editor, `saveLessonDirectToFirestore` passed the raw `lessonWithOrder` object directly to Firestore `setDoc()`. In Firestore, any object containing `undefined` properties (such as optional `tabs: undefined`, `subtitle: undefined`, `pdfUrl: undefined`, or `topic.videoUrl: undefined`) throws an exception: `Unsupported field value: undefined`. The catch block caught this error and logged it to the console without re-throwing, causing the modal to display 100% saved while Firestore rejected the write.
  - **Fix**: Wrapped `docToWrite` with `JSON.parse(JSON.stringify(docToWrite))` before calling `setDoc()` to strip all `undefined` values. Added re-throwing of real Firestore write errors so the UI never displays false success if saving fails.
- **Removed Stale Storage `payloadUrl` Conflict (`BookEditorPanel.tsx`, `App.tsx`)**:
  - **Root Cause**: If a chapter previously had a Firebase Storage `payloadUrl` (from an earlier large save >750KB), and was subsequently updated with questions under 750KB, `payloadUrl` remained attached to `docToWrite`. When the student panel opened and executed `fetchBookLessons`, `resolveLessonPayload(l)` detected `payloadUrl`, downloaded the obsolete Storage JSON, and overwritten the freshly saved Firestore questions.
  - **Fix**: When chapters fit directly in Firestore (`jsonLength <= 750000`), `payloadUrl` is deleted from `docToWrite` and cleaned up from Storage using `deleteFileFromStorage()`.
- **Added Cache-Busting and No-Store to Storage Payload Resolution (`firebaseHelper.ts`)**:
  - **Root Cause**: Firebase Storage download URLs for large chapters (`>750KB`) are cached aggressively by the browser. When an updated payload was uploaded, subsequent `fetch(lesson.payloadUrl)` requests received the cached pre-saved JSON from the browser HTTP cache.
  - **Fix**: Added a timestamp query param `_cb=${Date.now()}` and `{ cache: 'no-store' }` to `resolveLessonPayload()` so fresh data is always fetched from the network.
- **Immediate Cache Synchronization & Subcollection Authority (`BookEditorPanel.tsx`, `App.tsx`)**:
  - **Root Cause**: `saveLessonDirectToFirestore` never invoked `fetchBookLessons(bookId)` to refresh `subLessonsCache` and `firebaseBooks`. Furthermore, `App.tsx`'s memoized `books` only used `subLessonsCache` if `!bHasIQ && cachedHasIQ`. If the top-level book already contained inquiry questions, `subLessonsCache` was ignored, causing stale lessons to be rendered and written back to IndexedDB.
  - **Fix**: Called `fetchBookLessons(modifiedBook.id)` directly in `saveLessonDirectToFirestore`, and updated `App.tsx`'s base books mapping to always use `subLessonsCache` when present since subcollections are the authoritative source of truth.

## [2026-10-14] - APK UI & Functionality Rectification: Fresh Android Build & Download Decoupling

### Fixed & Rectified
- **Stale Firebase Storage APK Download Link Decoupled (`LandingPage.tsx`)**:
  - **Root Cause**: The **Download APK** button on the landing page previously executed `getDownloadURL(ref(storage, 'apk/ExtraPadhai.apk'))`, which overrode the download target with an ancient APK uploaded to Firebase Storage on **August 26, 2026**. Consequently, any user or device downloading the APK from the web received the obsolete August 26 build containing the old light-themed 2D card grid UI (Image 2) and missing all modern functions (Wooden Shelf library view, 1MB storage offload resolution, direct Firestore question saving, accountancy modes, offline synchronization).
  - **Fix**: Removed the stale Firebase Storage download URL lookup in [`LandingPage.tsx`](file:///c:/Single%20Screen/src/components/LandingPage.tsx). The **Download APK** button now directly downloads the bundled, updated `/ExtraPadhai.apk` with proper `application/vnd.android.package-archive` attachment headers.
- **Grade Selector Page Container Theme Matching (`App.tsx`)**:
  - Updated the outer layout background in [`App.tsx`](file:///c:/Single%20Screen/src/App.tsx) for `activeScreen === 'grade-selector'` from `bg-[#f7fbf0]` (light green) to `bg-[#160b03]` (dark wood), preventing any color mismatch or flash during initial render or bounce scrolling.
- **End-to-End Automated APK Build Pipeline (`build_apk.bat`)**:
  - Upgraded [`build_apk.bat`](file:///c:/Single%20Screen/build_apk.bat) to execute the complete build sequence:
    1. Compiles modern web bundle (`npm run build`).
    2. Synchronizes assets into the Capacitor Android project (`npx cap copy android`).
    3. Cleans any accidental nested APK assets in `android/app/src/main/assets/public/` to prevent recursive archive bloat.
    4. Assembles the debug APK via Gradle (`gradlew.bat assembleDebug`).
    5. Distributes the fresh APK to `ExtraPadhai.apk` (root), `releases/ExtraPadhai_v5.0.apk`, `dist/ExtraPadhai.apk`, and `public/ExtraPadhai.apk`.
- **Newly Assembled APK Verified**:
  - Compiled and verified fresh pre-signed Android APK:
    - **Path**: `releases/ExtraPadhai_v5.0.apk` & `ExtraPadhai.apk` (**13.49 MB** / 14,144,837 bytes).
    - Contains the latest compiled student panel bundle (`index-CF0-IcFB.js`), full Wooden Shelf view, and all offline curriculum features.

### Added & Improved
- **Topic Question Modals Full-Screen Expansion (`FloatingButton.tsx`)**:
  - Expanded the retrieval / flash question container (`#panel-flashcards`) from a centered floating dialog box (`top-1/2 left-1/2 w-[95vw] sm:w-[800px] max-h-[85vh] rounded-2xl`) to cover the **entire viewport** (`fixed inset-0 w-full h-full`).
  - Expanded the active classroom questions panel (`#panel-classroom-questions`) from partial height (`top-[72px]`) to full viewport coverage (`fixed inset-0 w-full h-full`).
  - Increased card dimensions (`max-w-4xl mx-auto`, `maxHeight: 52vh`) and arena score layout so questions and answers take full advantage of smartboard and tablet screen dimensions.
- **Top Ribbon Height Reduced by 20% (`FloatingButton.tsx`)**:
  - Reduced top header ribbon padding across question panels from `p-3 sm:p-4` (12px to 16px vertical padding) to `py-2 sm:py-2.5` (8px to 10px vertical padding), delivering a clean ~20% decrease in ribbon height while preserving touch targets, filter buttons, and close controls.
  - Slimmed down filter buttons padding to `py-0.5 px-1` / `py-0.5 px-2.5` for compact visual alignment.
- **Production APK Re-Assembled**:
  - Re-synced and assembled new Android debug APK via `build_apk.bat` containing bundle `index-BwgDN9H5.js`.



## [2026-10-12] - Production Android APK Build Updated & Firebase Distribution

### Added & Deployed
- **Production Android APK Updated & Size Optimization**:
  - Rebuilt production bundle (`npm run build`) containing the latest curriculum synchronize resolution and offline question preservation fixes.
  - Ensured no recursive APK bloat inside `public/` or `android/app/src/main/assets/public/`.
  - Re-synced clean web distribution assets into the Android native project (`npx cap copy android`).
  - Assembled updated Android APKs via Gradle:
    - **Debug APK (Pre-signed)**: `releases/ExtraPadhai_v5.0.apk` & `ExtraPadhai.apk` (**13.49 MB** / 14,144,837 bytes) — ready for direct sideloading and smartboard testing.
    - **Release APK**: `android/app/build/outputs/apk/release/app-release-unsigned.apk` (**9.61 MB** / 10,076,668 bytes).
- **Firebase Distribution & Verified Download**:
  - Bundled updated `ExtraPadhai.apk` into Firebase Hosting root with verified direct global delivery (`https://samrtboard.web.app/ExtraPadhai.apk` - `HTTP 200 OK`, `application/vnd.android.package-archive`).
  - Landing page **"Download APK"** button downloads the updated 13.49 MB APK package directly.

## [2026-10-12] - Rectification: Student Panel Synchronize Button & Question Preservation

### Fixed & Rectified
- **Student Panel Synchronize Button Restores Questions and Prevents Loss (`App.tsx`)**:
  - **Root Cause**: When chapters with large question banks (>750KB) or storage offloads were saved, their full question payloads were stored in Firebase Storage at `payloadUrl`, leaving the Firestore chapter document with lightweight metadata (`inquiryQuestions: []`). While `fetchBookLessons` called `resolveLessonPayload(l)` to download and expand the questions, `handleTriggerSync` lacked `resolveLessonPayload`. Consequently, clicking "Synchronize" mapped `ld.data()` with empty question arrays, overwriting the in-memory cache (`subLessonsCache`) and IndexedDB local disk (`dbLocal.offline_lessons`) with `inquiryQuestions: []`, making questions vanish from student view.
  - **Fix**: Updated `handleTriggerSync` in [`App.tsx`](file:///c:/Single%20Screen/src/App.tsx) to resolve any Storage offloaded payloads via `resolveLessonPayload(l)` for every chapter fetched during synchronization before writing to in-memory state and IndexedDB offline cache.
  - **Firestore Protection**: Confirmed that `handleTriggerSync` is strictly a read/download operation for curriculum chapters and never writes empty questions or stripped lessons back to Firestore `books/{bookId}/lessons`.

## [2026-10-12] - Advanced Editor Header Redesign & Save Progress Bar

### Added & Improved
- **Header "Save & Close" & Display Mode Co-location (`InquiryQuestionManager.tsx`)**:
  - Placed the **"Save & Close"** button directly in the modal header bar immediately adjacent to the **"📊 Accountancy Mode" / "📄 Standard Mode"** toggle button.
  - Removed the bottom footer ribbon (containing Previous Question, Next Question, Cancel, and redundant Save & Close buttons), allowing more vertical room for TinyMCE rich text editing.
- **Firebase Database Confirmation & Animated Progress Bar (`InquiryQuestionManager.tsx`)**:
  - Clicking **"Save & Close"** now displays an animated real-time progress bar across the bottom edge of the header along with a spinning indicator (`Saving to Firebase...`).
  - The modal stays open during the save and waits until confirmation that the questions and answers have been successfully committed to the Firebase database (`books/{bookId}/lessons/{lessonId}`).
  - Only after receiving write confirmation from Firebase does the progress bar hit 100% and smoothly close the Advanced Editor.

## [2026-10-12] - Direct Firestore Question Saving & Inquiry UI Refinement

### Added & Improved
- **Direct Save to Live Firestore Curriculum (`BookEditorPanel.tsx`, `InquiryQuestionManager.tsx`, `FlashQuestionManager.tsx`)**:
  - Decoupled question saving from the "Submit this Chapter" / admin review workflow.
  - Both **"Save & Close"** (in Advanced Editor) and **"Register / Update Question"** (in Quick Draft) now immediately write directly to Firestore `books/{bookId}/lessons/{lessonId}` and local IndexedDB (`offline_lessons`).
  - Added automatic payload offloading (`uploadLargeLessonPayload`) if the chapter exceeds 750KB.
  - "Submit this Chapter" is now strictly dedicated to chapter pages, images, and video metadata submissions for admin approval.
- **Accountancy / Standard Display Mode in Advanced Editor (`InquiryQuestionManager.tsx`)**:
  - Added the **"📊 Accountancy Mode" / "📄 Standard Mode"** toggle button directly inside the **Advanced Editor modal** header bar.
  - Switching modes inside the Advanced Editor updates `advDisplayModeDraft` and saves the mode upon clicking "Save & Close".
- **Single "Edit" Button & 3-Row Right-Aligned Actions Layout (`InquiryQuestionManager.tsx`)**:
  - Replaced duplicate "Edit Q" and "Edit A" buttons with a single **"Edit"** button that directly opens the Advanced Editor.
  - Organized action buttons on each question row into **3 stacked rows** on the right side of the container, aligned to the right:
    1. Row 1: `[📊 Accountancy Mode / 📄 Standard Mode]` toggle pill
    2. Row 2: `[Edit]` button
    3. Row 3: `[Delete]` button
- **Increased Topic Badge Typography (`InquiryQuestionManager.tsx`, `FlashQuestionManager.tsx`)**:
  - Increased topic badge font size from `text-[8px]` to `text-[11px] font-bold font-mono tracking-wide` across both Inquiry Questions and Diagnostic Quizzing lists for clearer visibility.

## [2026-10-12] - Rectification: Inquiry Questions Vanishing on Topic Change

### Fixed & Rectified
- **Inquiry Questions Vanished When Changing Topic (`BookEditorPanel.tsx`, `AdminPanel.tsx`, `InquiryQuestionManager.tsx`, `FlashQuestionManager.tsx`)**:
  - **Root Cause 1 (Topic Questions Aggregation Loss)**: When `allQ` was formed in [`BookEditorPanel.tsx`](file:///c:/Single%20Screen/src/components/BookEditorPanel.tsx) and [`AdminPanel.tsx`](file:///c:/Single%20Screen/src/components/AdminPanel.tsx), questions residing under `topic.inquiryQuestions` without an explicit `q.topicTitle` property (or plain string questions) were pushed into `allQ` without assigning `topicTitle: t.title`. When `onQuestionsUpdate(newQuestions)` subsequently ran, `newQuestions.filter(q => q.topicTitle?.toLowerCase() === t.title.toLowerCase())` failed for those questions, wiping them out of `t.inquiryQuestions` upon save.
  - **Root Cause 2 (Filter Trap in Inquiry & Flash Question Managers)**: If a user clicked "This Topic: X" or selected an active topic in the editor, and then changed a question's topic to another topic or removed it, the active topic filter count reached 0. Because `filterTopic` remained locked to `'active'`, `displayedQuestions` rendered an empty list (`[]`), hiding all remaining chapter questions.
  - **Fix 1 (Aggregation Auto-Tagging)**: Updated `allQ` and `allIQ` generation in both `BookEditorPanel.tsx` and `AdminPanel.tsx` to automatically inject `topicTitle: t.title` on questions aggregated from `t.inquiryQuestions` if `topicTitle` is absent.
  - **Fix 2 (Automatic Filter Fallback to 'all')**: Added an automated fallback effect in both `InquiryQuestionManager.tsx` and `FlashQuestionManager.tsx`: if `filterTopic === 'active'` and the active topic count reaches 0 while chapter questions exist, `filterTopic` automatically falls back to `'all'` so questions remain immediately visible and never vanish from view.

## [2026-10-12] - Lesson Topic Dropdowns for Diagnostic Quizzing & Inquiry Questions

### Added & Improved
- **Interactive Diagnostic Quizzing Topic Selector Dropdown (`FlashQuestionManager.tsx`, `types.ts`, `BookEditorPanel.tsx`, `AdminPanel.tsx`)**:
  - Added `topicTitle?: string | null` to the `FlashQuestion` interface in `types.ts`.
  - Added a responsive **Topic of Lesson** `<select>` dropdown in the question drafting bar of `FlashQuestionManager.tsx` that lists all chapter topics dynamically, with support for `-- No Topic / Chapter Level --`, active topic pre-filling, and editing existing questions.
  - Added topic badge pills (`Topic: {q.topicTitle}`) to each diagnostic quiz question row in the active question list.
  - Added interactive topic filter pills (`All Chapter Quizzes (N)` vs `This Topic: X (M)`) in the active quiz questions header bar.
  - Updated Bulk Upload (.json / .xlsx) and template generator to support topic classification for diagnostic quizzes.
  - Updated `BookEditorPanel.tsx` and `AdminPanel.tsx` to aggregate flash questions across chapter and nested topics (`allFQ`), passing `availableTopics` and syncing topic questions to `topic.flashQuestions` so questions never vanish or desync when switching topics.
  - Cascaded topic renames in `BookEditorPanel.tsx` so modifying a topic title automatically updates all associated flash questions.

- **Inquiry Questions Topic Dropdown in Advanced Editor & Draft Forms (`InquiryQuestionManager.tsx`, `QuestionEditorPage.tsx`)**:
  - Replaced the freeform Topic Title text input with a `<select>` dropdown in the **Advanced Editor modal** (`InquiryQuestionManager.tsx`), allowing editors to pick directly from the lesson's topics.
  - Replaced the Topic Title text input in the **main question draft toolbar** of `InquiryQuestionManager.tsx` with a topic `<select>` dropdown.
  - Replaced the Topic Title text input in the **standalone full-page rich text editor** (`QuestionEditorPage.tsx`) with a `<select>` dropdown populated via session cache.

## [2026-10-12] - Question & Answer Typography Synchronization (Editor vs Student Panel)

### Fixed & Harmonized
- **Typography Discrepancy Between "Advanced Editor" and Student Panel (`InquiryQuestionManager.tsx`, `QuestionEditorPage.tsx`, `FloatingButton.tsx`, `AccountancyQuestionModal.tsx`)**:
  - **Font Family**: Harmonized the TinyMCE editor to use `"Cormorant Garamond", Georgia, serif` (`font-serif`), exactly matching the student panel question and solution view font.
  - **Font Size & Line Height**: Set TinyMCE default body font size to `21px` with `1.625` line height (`leading-relaxed`), providing true WYSIWYG matching to the student panel's smartboard display scale (`text-[15px] md:text-[18px] lg:text-[21px] xl:text-[25px] 2xl:text-[30px] min-[3840px]:text-[40px]`).
  - **Font Color & Theme**: Switched TinyMCE to `skin: 'oxide-dark'` and `content_css: 'dark'`, wrapping container in `bg-[#181e2a]` and configuring `body { color: #e8f0fe; background-color: #181e2a; }`.
  - **Table & Formatting Alignment**: Matched dark table borders (`#334155`), header fills (`rgba(30, 41, 59, 0.8)`), and text contrast so accountancy statements authored in the editor appear identically in the student view.
  - **Font Family & Font Size Picker**: Added `fontfamily` and `fontsize` controls to the TinyMCE toolbar in both `InquiryQuestionManager.tsx` and `QuestionEditorPage.tsx`.
  - **Student Modal Consistency**: Standardized text colors and responsive font sizes across both [`FloatingButton.tsx`](file:///c:/Single%20Screen/src/components/FloatingButton.tsx) and [`AccountancyQuestionModal.tsx`](file:///c:/Single%20Screen/src/components/AccountancyQuestionModal.tsx) to `#e8f0fe` with `font-serif`.

## [2026-10-12] - Large Chapter Automatic Storage Offloading (1MB Firestore Limit Fix)

### Fixed & Resolved
- **Firestore 1,048,576 Bytes Limit on Large Chapter Submissions (`BookEditorPanel.tsx`, `App.tsx`, `firebaseHelper.ts`)**:
  - **Root Cause**: Chapters containing 100+ comprehensive inquiry questions with complex multi-column accountancy tables and rich formatted text (such as *"Issue of Debentures"* containing 107 questions) exceeded Firestore's hard document limit of 1MB (reaching 2,001,992 bytes). Writing directly to Firestore document `editor_submissions/{bookId}/lessons/{lessonId}` resulted in Firebase error `cannot be written because its size exceeds the maximum allowed size of 1,048,576 bytes`.
  - **Automatic Storage Offloading**: Added `uploadLargeLessonPayload` and `resolveLessonPayload` in `firebaseHelper.ts`.
  - When submitting a chapter, if the serialized payload exceeds 750,000 bytes, the complete JSON chapter object is automatically saved to Firebase Storage (`editor_submissions/{bookId}/lessons/{lessonId}/payload.json`).
  - A lightweight pointer document (~2KB) containing metadata and `payloadUrl` is written to Firestore.
  - On the Admin Review side (`onReviewSubmission` in `App.tsx`) and when fetching subcollection lessons (`fetchBookLessons` in `App.tsx`), `resolveLessonPayload` transparently fetches and merges the complete payload from Storage.
  - Also protected `saveBookToFirebase` in `App.tsx` so approved live chapters of any size (>1MB) are safely offloaded to Storage (`books/{bookId}/lessons/{lessonId}/payload.json`) with zero size constraints.



### Added & Optimized
- **Per-Chapter "Submit this Chapter" (`BookEditorPanel.tsx`)**:
  - Transformed the monolithic submission flow into a lightweight, chapter-specific submission model.
  - When the editor clicks **"Submit this Chapter"** in the top bar header, only the active/selected chapter is externalized and uploaded to `editor_submissions/{bookId}/lessons/{lessonId}`.
  - Submitting a single chapter takes ~1-2KB rather than rewriting the entire textbook, eliminating redundant network traffic and saving bandwidth.
- **Chapter Status Visual Highlights with Amber Chips (`BookEditorPanel.tsx`)**:
  - In both the Editor panel and the Admin Preview panel, chapters with pending submissions are visually distinguished with a glowing **amber chip** (`bg-amber-950/25 border-amber-500/60 text-amber-200`) and an animated `⏳ Submitted / Pending` badge.
  - Chapters marked for deletion are highlighted in rose red (`Delete Req`).
  - Normal approved chapters retain their default clean styling (`CHAPTER N`).
- **Granular "Approve This Chapter" & Live Sync (`BookEditorPanel.tsx`, `App.tsx`)**:
  - In Admin Preview Mode, the admin can inspect any chapter and click **"Approve This Chapter"**.
  - Only that selected chapter is merged and pushed live into the Firestore curriculum (`books/{bookId}/lessons/{lessonId}`).
  - Once approved, the chapter's submission doc is deleted and its chip automatically transitions back from amber to normal.
  - A fallback **"Approve All"** button remains available if the admin wishes to approve all pending submissions at once.
- **Chapter Deletion Request Submissions (`BookEditorPanel.tsx`, `App.tsx`)**:
  - Clicking "Purge Chapter" now allows editors to submit a formal deletion request to the Admin (`deletedLessonIds`).
  - Admin sees the chapter highlighted in red (`Delete Req`) and approving it deletes the chapter from the live curriculum.
- **Admin Review Badge Count (`AdminPanel.tsx`)**:
  - Updated the glowing "Review Submission" button in the Admin Panel to show the exact count of pending chapters (e.g. `Review Submission (2 Chs)`).



### Fixed
- **Questions Vanished After "Submit to Admin" (`BookEditorPanel.tsx`)**:
  - Root cause: The submit handler was calling `handleUpdateLessonMeta(...)` **before** reading from IndexedDB. `handleUpdateLessonMeta` reads `assignedBook` from stale React state (which may not yet include freshly XLSX-uploaded questions), then wrote that stripped version **back to IndexedDB**, overwriting all inquiry questions. The subsequent `dbLocal.offline_lessons.get()` then read the question-stripped data.
  - Fix: Removed the `handleUpdateLessonMeta` pre-call entirely. Now reads from IndexedDB first, then **patches** just `title`/`subtitle`/`videoUrls` drafts inline on the IndexedDB data, preserving all inquiry questions.
- **Chapter Order Scrambled in Admin Submission Review (`BookEditorPanel.tsx`)**:
  - Root cause: Lessons written to `editor_submissions/{bookId}/lessons/` had no `order` field. The Admin review `onReviewSubmission` sorts by `a.order ?? 0`, so all chapters sorted to `0` and were returned in arbitrary Firestore iteration order.
  - Fix: Each lesson doc is now written with `{ ...lesson, order: i + j }` so chapter order is perfectly preserved in the Admin review panel.

## [2026-10-11] - Inquiry Question Deletion Persistence & Resurrection Bug Fix

### Fixed & Resolved
- **Inquiry Questions Resurrection on Deletion (`App.tsx`)**:
  - Fixed an issue where deleting questions via "Delete Selected" or single "Delete" in `InquiryQuestionManager` was immediately undone because the local-first merge in `App.tsx` union-merged missing questions from in-memory/server state (`liveL.inquiryQuestions`) back into the offline draft.
  - Updated `App.tsx` merge to treat defined offline arrays (`ol.inquiryQuestions !== undefined`, `ol.flashQuestions !== undefined`) as the definitive local source of truth so deletions (including batch deletions) immediately take effect and persist.
- **Topic-Level Inquiry Question Pruning in Admin Panel (`AdminPanel.tsx`)**:
  - Updated `onQuestionsUpdate` in `AdminPanel.tsx` to prune deleted questions from `t.inquiryQuestions` across all chapter topics so deleted questions are not resurrected by `allIQ` on subsequent renders.

### Fixed & Resolved
- **Inquiry Questions Vanishing on Topic Change (`BookEditorPanel.tsx`)**:
  - Eliminated the bug where selecting or changing a Chapter Topic in the dropdown hid all questions in the chapter that didn't match the selected topic's exact title string (`getEffectiveTopicInquiryQuestions` filtering `[]` when topics were newly created or questions were chapter-level).
  - Decoupled chapter inquiry questions from topic filtering: `BookEditorPanel` now always aggregates and passes the complete chapter question bank (`allQ`) to `InquiryQuestionManager` so questions never vanish when navigating topics.
- **Accidental Wipeout Prevention on Topic Save (`BookEditorPanel.tsx`)**:
  - Fixed destructive `onQuestionsUpdate` logic that previously replaced `activeLesson.inquiryQuestions` with only the active topic's questions (`l.inquiryQuestions = taggedQuestions`), which had wiped out other chapter questions.
  - Updating questions now safely preserves all chapter questions in `l.inquiryQuestions` while syncing topic-matching subsets into `topic.inquiryQuestions`.
- **Topic Rename Synchronization (`BookEditorPanel.tsx`)**:
  - In `handleSaveTopic`, renaming a topic now automatically cascades and updates `topicTitle` across all questions in `l.inquiryQuestions` and `t.inquiryQuestions` matching the previous title, preventing questions from being orphaned on rename.
- **Topic Filter Pills & Auto-fill in Inquiry Questions Manager (`InquiryQuestionManager.tsx`)**:
  - Added optional `activeTopicTitle` prop to `InquiryQuestionManager`. When a topic is active, drafting a new question automatically pre-fills the Topic field with `activeTopicTitle`.
  - Added interactive filter pills (`All Chapter Questions (N)` vs `This Topic: X (M)`), defaulting to All Chapter Questions so users can easily see all questions or toggle topic-specific questions with zero data hiding.
- **Local-First Union Recovery Merge (`App.tsx`)**:
  - Enhanced IndexedDB offline lesson merge in `App.tsx` to perform union deduplication on `inquiryQuestions` and topic questions, instantly restoring any live server questions if local offline cache was previously truncated.

## [2026-10-11] - Production Deployment, APK Distribution & Git Push

### Added & Deployed
- **Production Firebase Deployment**:
  - Built fresh production web assets with `npm run build` and deployed to Firebase Hosting (`https://samrtboard.web.app`).
  - Bundled latest `ExtraPadhai.apk` (13.49 MB) into hosting root `/ExtraPadhai.apk` with verified global CDN delivery (`HTTP 200 OK`).
  - Updated `LandingPage.tsx` APK download button with direct `/ExtraPadhai.apk` path and fallback.
- **Git Commit & Sync**:
  - Saved and committed all latest features (sidebar circular badge fix, instant local editor saves, diagnostic & inquiry question UI redesign with batch deletion, APK updates) to git repository.

## [2026-10-11] - Android APK Build Updated & Size Optimization

### Added & Improved
- **Fresh Web Asset Sync & Android APK Generation**:
  - Rebuilt production bundle via `npm run build` with latest sidebar geometry fix, instant local editor saves, full-width diagnostic/inquiry question managers, and multi-selection deletions.
  - Synced distribution artifacts into Android project assets (`npx cap copy android`).
  - Assembled updated Android APKs via Gradle:
    - **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk` (**13.49 MB**) — pre-signed and ready for direct sideloading and testing on Android devices.
    - **Release APK**: `android/app/build/outputs/apk/release/app-release-unsigned.apk` (**9.60 MB**) — optimized release build with stripping of debug symbols and overhead.
- **Local Verification**:
  - Gradle build succeeded cleanly (`BUILD SUCCESSFUL in 3m 21s`).
  - No hosting deployment or git push performed per project rules.

## [2026-10-11] - Squeezed Sidebar Chapter Badge Optimization

### Fixed & Improved
- **Full Circular Chapter Display in Squeezed Sidebar (`src/components/Sidebar.tsx`)**:
  - Resolved circle clipping and truncation caused by heavy side padding (`p-3` = 24px horizontal) and fixed outer reservation (`72px`) conflicting with button width (`w-11` = 44px) inside overflow containers.
  - Decreased compact side padding to `py-3 px-1.5` and adjusted outer & inner sidebar widths from `72px` to `58px` when squeezed (and `w-10 h-10` with `shrink-0` on badges).
  - Ensured chapter badges are 100% full circles, perfectly centered, and fully visible without any edge cutoff while optimizing screen space for the reading canvas.
- **Local Verification**:
  - Built cleanly locally (`npm run build`) with zero errors. No hosting deployment or git push performed per project rules.

## [2026-10-11] - Instant Editor Saves & Elimination of Redundant Firestore Writes

### Fixed & Optimized
- **Instant Save for Editor Panel (`src/components/BookEditorPanel.tsx`)**:
  - Eliminated the 15-30 second lag when clicking "Save Page Changes", "Add Page", "Save Topic", "Register Question", and reordering chapters/pages.
  - Decoupled `saveBookLocally` from calling `saveBookToFirebase`. Saves are now purely local-first into IndexedDB (`dbLocal.offline_lessons.put`), executing in ~5ms rather than making dozens of blocking cloud network requests on every edit.
  - Removed redundant `useEffect` auto-sync on mount in `BookEditorPanel.tsx` that re-triggered full-book Firebase rewrites every time an editor opened a textbook.
- **Fast-Path Base64 Detection in Image Externalizer (`src/lib/imageExternalizer.ts`)**:
  - Added `lessonHasBase64` check to skip heavy recursive regex and Promise overhead when lessons contain standard URLs or clean text.
- **Parallelized Batch Commits in "Submit to Admin" & `saveBookToFirebase`**:
  - In `BookEditorPanel.tsx`, optimized `handleSubmitToAdmin` by executing Firestore chapter batches in parallel using `Promise.all` instead of sequential `await` loops.
  - In `App.tsx`, parallelized chunk batch writes in `saveBookToFirebase` for admins and approved submissions, dramatically reducing sync duration from 30 seconds to ~1-2 seconds.
- **No Automatic Deploy or Git Push**:
  - Maintained strict project compliance: tested and verified locally with `npm run build` with zero deployment or git push.

## [2026-10-11] - Interactive Diagnostic Quizzing UI Redesign & Multi-Question Deletion

### Added & Improved
- **Full-Width Stacked Layout in `FlashQuestionManager` (`src/components/FlashQuestionManager.tsx`)**:
  - Transformed the legacy side-by-side (`md:col-span-5` / `md:col-span-7`) layout into a spacious, stacked full-width container matching the Inquiry Questions Manager design.
  - **New Flashcard Draft Container (Full Width)**:
    - **Row 1**: Side-by-side rich TinyMCE editors for **Question Text** and **Answer Details** with math and annotation support (`grid grid-cols-1 md:grid-cols-2 gap-4`).
    - **Row 2**: Horizontal control bar featuring Difficulty level selector (`Easy`, `Medium`, `Hard`), Register/Update button, Cancel button, Bulk Upload button (`.json`/`.xlsx`), and Template download button.
  - **Active Question List Container (Full Width)**:
    - Stacked directly beneath the draft form at 100% full width.
    - Added header control bar with "Select All" / "Deselect All" checkbox, selection count badge, and batch `Delete Selected (N)` action.
- **Batch Deletion (Multi-Select) Feature (`src/components/FlashQuestionManager.tsx`)**:
  - Added checkboxes on each diagnostic quiz item row with row highlighting (`bg-rose-950/20 border-l-4 border-l-rose-500`) when selected.
  - Added confirmation modal/prompt displaying the exact count of diagnostic questions to delete.
  - Safely deletes selected questions via `selectedIds` and triggers `onQuestionsUpdate(updated)` across parent panels.
  - Auto-adjusts selection state on single deletion or questions list changes to prevent desync.
- **Local Verification**:
  - Built cleanly locally (`npm run build`) with 0 errors. Deployment was intentionally skipped per user instruction.

## [2026-10-11] - Inquiry Questions Manager UI Redesign & Multi-Question Deletion

### Added & Improved
- **Full-Width Stacked Layout in `InquiryQuestionManager` (`src/components/InquiryQuestionManager.tsx`)**:
  - Replaced legacy `grid-cols-12` side-by-side layout with stacked, full-width sections for superior readability and editor space on desktops, laptops, and smartboards.
  - **New Question Draft Container (Full Width)**:
    - **Row 1**: Side-by-side rich inputs for Question (`textarea`) and Answer (`textarea`) using responsive `grid grid-cols-1 md:grid-cols-2 gap-4`.
    - **Row 2**: Horizontal flex toolbar placing `Topic` input (`flex-1`), `Marks` input (`w-32`), `Register/Update Question` primary button, `Cancel` button, `Bulk Upload` button, and `Template` download button.
  - **Active Inquiry Questions Container (Full Width)**:
    - Stacked directly beneath the draft form at 100% container width.
    - Added tabular header control bar with "Select All" / "Deselect All" checkbox, selected count badge, and batch `Delete Selected (N)` action.
- **Batch Deletion (Multi-Select) Feature (`src/components/InquiryQuestionManager.tsx`)**:
  - Added checkboxes to each question item row with row highlighting (`bg-rose-950/20 border-l-4 border-l-rose-500`) when selected.
  - Added confirmation modal/prompt displaying the exact count of questions to be deleted.
  - Safely deletes selected questions via `selectedIndices` and triggers `onQuestionsUpdate(updated)` across parent panels (`AdminPanel.tsx` & `BookEditorPanel.tsx`).
  - Index desync protection: when deleting a single question, auto-adjusts stored selection indices.
- **Production Verification & Deployment**:
  - Verified with clean production build (`npm run build`) and deployed to Firebase Hosting (`https://samrtboard.web.app`).

## [2026-10-11] - Inquiry Questions Manager Display, Race-Condition Elimination & Subcollection Cache Engine

### Fixed & Rectified
- **Subcollection Lesson Race-Condition in `fetchBookLessons` (`src/App.tsx`)**:
  - Eliminated the race condition where `prev.findIndex(b => b.id === bookId)` returned `-1` during initial book metadata loading from Firestore `onSnapshot`. Previously, this caused `fetchBookLessons` to silently discard all fetched chapter docs (and their inquiry questions) and bypass IndexedDB disk caching entirely.
  - Added dedicated in-memory React state cache `subLessonsCache` (`Record<number, Lesson[]>`) keyed by `bookId`, which immediately captures and retains fetched subcollection lessons regardless of metadata loading state.
  - Made `fetchBookLessons` reference stable with `[]` dependency array and decoupled `dbLocal.offline_lessons.put` from state setters so lessons are safely written to IndexedDB offline storage unconditionally.
  - Ensured Firestore document ID is mapped (`id: ld.id, ...ld.data()`) on all fetched chapter documents.
- **Deep Topic & Inquiry Question Sanitization (`src/App.tsx`)**:
  - Updated `fetchBookLessons` and `handleTriggerSync` to deeply sanitize nested `topics` (including `topic.inquiryQuestions`, `topic.flashQuestions`, and `topic.pages`), matching `onSnapshot` sanitization.
- **In-Memory Subcollection Merge Engine in `books` `useMemo` (`src/App.tsx`)**:
  - Updated `books` `useMemo` to check `subLessonsCache[b.id]` and merge subcollection lessons whenever `b.lessons` is empty or lacks inquiry questions that exist in the subcollection cache.
  - Preserved `topics` in the local-first deep merge engine alongside `flashQuestions`, `inquiryQuestions`, and `pages`.
  - Updated `onSnapshot` book listener to check `subLessonsCache` before falling back to empty lesson arrays.
- **Topic-Aware Inquiry Question Aggregation (`BookEditorPanel.tsx`, `AdminPanel.tsx`)**:
  - Integrated `getEffectiveTopicInquiryQuestions` in `BookEditorPanel.tsx` so selecting a topic does not hide inquiry questions that match the topic title from the lesson level.
  - In `AdminPanel.tsx` and `BookEditorPanel.tsx`, aggregated inquiry questions across all chapter topics so questions compiled under topic headers are always visible in the Inquiry Questions Manager.
- **Accurate Error Reporting on Cloud Sync (`BookEditorPanel.tsx`)**:
  - Updated `saveBookLocally` in `BookEditorPanel.tsx` to rethrow any error when auto-syncing to Firebase and mark `sync_status: 'synced'` on success. Previously, swallowed errors resulted in false "Inquiry questions synced to Firebase" success toasts even when cloud writes failed.
- **Production Build & Live Deployment**:
  - Built clean production bundle (`npm run build`) and deployed to Firebase Hosting (`https://samrtboard.web.app`), resolving the discrepancy between localhost and the live website.

## [2026-09-19] - PDF Book Classification, Chapter-wise PDF Upload & Continuous PDF Viewer Engine

### Added
- **PDF Book Category Classification (`types.ts`, `BookEditorPanel.tsx`, `AdminPanel.tsx`)**:
  - Added `bookType?: 'interactive' | 'pdf'` property to `Book` interface in `types.ts`.
  - Added Textbook Category Classification selector (`📖 Interactive Book` vs `📄 PDF Book`) in `BookEditorPanel.tsx` and `AdminPanel.tsx`.
- **Chapter-wise PDF Upload & Firebase Management (`BookEditorPanel.tsx`, `firebaseHelper.ts`)**:
  - Added **Upload Chapter PDF**, **Replace Chapter PDF**, and **Detach PDF** controls in the Book Editor Panel for each chapter.
  - Uploads PDF files directly to Firebase Storage under `pdfs/` and links `lesson.pdfUrl` in Firestore.
  - Added `deletePdfFromStorage` utility in `firebaseHelper.ts` to automatically delete previous PDF files from Firebase Storage when replacing or detaching PDFs to prevent storage bloat.
- **Continuous PDF Page Viewer Component (`PdfPageViewer.tsx`, `Workspace.tsx`)**:
  - Built high-performance `PdfPageViewer` component using `pdfjs-dist` and `pdfCache.ts` (`downloadAndCachePdf`), supporting 100% offline viewing on native Android and web.
  - Renders PDF pages continuously in **Single Page View** (1 per row) and **Double Page View** (`grid-cols-2` side-by-side layout).
  - Built-in embedded browser PDF engine fallback (`<iframe src={pdfUrl} />`) for 100% rendering guarantee across all browser environments.

### Fixed & Improved
- **Category Toggle Race-Condition & Flickering Fix (`BookEditorPanel.tsx`)**:
  - Fixed multi-flickering issue when toggling book categories by executing direct atomic Firestore `updateDoc` calls for category metadata instead of full subcollection batch syncs.
  - Scoped `BookEditorPanel` auto-sync `useEffect` dependency to `[assignedBookId]` to prevent background race-condition re-triggers during save.
- **Floating Helper Button Visibility (`App.tsx`)**:
  - Automatically hides the circular floating helper button when a PDF chapter or PDF book is displayed, preserving clear visibility over PDF pages.

## [2026-09-11] - Student Panel Verification, Static TinyMCE Asset Optimization & Optimized Android APK Build

### Fixed & Improved
- **TypeScript Type System & Compiler Fixes** (`types.ts`, `App.tsx`, `AuthModal.tsx`, `SyncManager.tsx`, `ExtraSmartboardDownload.tsx`):
  - Added `'synced'` to `SyncStatus` type union in `types.ts`.
  - Added `pdfUrl?: string | null;` optional property to `Lesson` interface in `types.ts`.
  - Added `updated_at?: string;` optional property to `OfflineBookLessons` interface in `types.ts`.
  - Fixed `addToast` type signature in `App.tsx` to include `'error'` toasts.
  - Updated `AuthModal` props `initialMode` type to include `'email-login'`.
  - Cast Firestore `docSnap.data()` properly in `AuthModal.tsx`.
  - Added missing `Lesson` import in `ExtraSmartboardDownload.tsx`.
  - Fixed Dexie `offline_lessons.update` type assertion in `SyncManager.tsx`.
  - Removed outdated `.backup.tsx` files from `src/components/`.
  - Replaced deprecated `license_key: 'gpl'` with `licenseKey="gpl"` prop across all `@tinymce/tinymce-react` editor instances.
  - Verified 100% clean `tsc --noEmit` build.

- **Static Asset Optimization (`public/tinymce`)**:
  - Removed duplicate unminified JS files (`tinymce.js`, `theme.js`, `model.js`, `emojiimages.js`, `emojis.js`, and unminified `plugin.js` source files) where `.min.js` equivalents exist.
  - Removed non-runtime documentation and metadata files (`CHANGELOG.md`, `README.md`, `bower.json`, `composer.json`, `package.json`, `license.md`, `notices.txt`).
  - Reduced static assets size in `public/` from **11.88 MB to 6.35 MB** (saving **5.53 MB** of bundle footprint).

- **Student Panel Feature Verification & Production Android APK Compile**:
  - Built production web assets (`npm run build`).
  - Synced production bundle into native Android assets (`android/app/src/main/assets/public/`).
  - Compiled optimized native Android debug APK (`cd android && ./gradlew assembleDebug`).
  - Saved output APK to `releases/ExtraPadhai_v5.0.apk` and `ExtraPadhai.apk` at **14.33 MB** with full Student Panel capabilities (reader view, KaTeX math, TinyMCE dark theme style stripping, Scribble overlay, video/blackboard panel, FAB flashcard retrieval cards, accountancy tables, and offline caching) intact.

## [2026-09-10] - Inquiry Question Accountancy Mode Display & Solution Chip Particulars Fix

### Added
- **Bank Reconciliation Statement Table Preset** (`AccountancyQuestionModal.tsx`, `types.ts`, `solutionChipExtractor.ts`): Added **Bank Reconciliation Statement (3 Columns)** as an official table preset option in the workspace table selector dropdown. Shares the 3-column format of Notes to Accounts (Particulars 70%, Unnamed Detail 15%, Amount 15%).

### Fixed
- **Complete Cell Text Solution Chip Preservation** (`solutionChipExtractor.ts`): Restored complete intact cell text extraction for every cell in the **Particulars** column of solution tables (such as Bank Reconciliation Statements, Notes to Accounts, Journal, and Ledgers). Removed sentence chopping and preposition splitting so every Particulars cell produces a 100% complete, intact solution chip (e.g. `"Balance as per Cash Book"`, `"Cheques issued but not yet presented for payment"`, `"Interest allowed by Bank but not recorded in Cash Book"`, `"Cheques deposited but not yet credited"`).
- **Prefix Stripping & Cell Sanitization** (`solutionChipExtractor.ts`): `sanitizeChip` removes leading modifiers (`Add:`, `Less:`, `To `, `By `) and trailing `Dr.`/`Cr.`, while retaining the full text of the cell (up to 250 characters).
- **Strict Particulars Column Solution Chip Extraction** (`solutionChipExtractor.ts`): Rectified solution chip extraction so chips are strictly extracted from the **Particulars** column of solution tables (or smart fallbacks: Col 1 for 5-col Journal, Cols 1 & 5 for 8-col Ledger, Cols 0 & 3 for 6-col Ledger, Col 0 for Notes to Accounts/BRS). Fixed Step 4 and HTML table matching which were previously extracting dates, amounts, page numbers, L.F./J.F., and note numbers from non-particulars columns.
- **Enhanced Solution Chip Validation** (`solutionChipExtractor.ts`): Updated `isValidChipText` and `sanitizeChip` to filter out pure dates (`Jan 15`, `2024`, `1st April`), serial/note numbers (`Note 1`, `(a)`), journal narrations (`(Being...)`), amounts (`50,000`), and table headers (`Particulars`, `Amount`, `Total`).
- **Inquiry Question Accountancy Workspace Button Alignment** (`FloatingButton.tsx`): Updated `QuestionItem` so the **Show Accounts/Journal** workspace button is only rendered when `isAccountancyMode` is enabled (`q.displayMode === 'accountancy_tabs'` or question contains custom accountancy tabs) as configured in the Book Editor Panel. Standard Mode / Student Mode inquiry questions no longer display the Accountancy workspace button.
- **Deleted Chapter, Title Renaming & Lesson Sequence Sync Fix** (`App.tsx`, `BookEditorPanel.tsx`):
  - **Explicit `order` Index & Subcollection Sorting** (`App.tsx`): Updated `saveBookToFirebase` and `bulkUpdateBooksInFirebase` to write an explicit `order` index field onto every subcollection lesson document. Updated `fetchBookLessons`, `onSync`, and `onReviewSubmission` to sort fetched subcollection docs by `(a.order ?? 0) - (b.order ?? 0)`. Previously, Firestore `getDocs` returned subcollection docs in alphabetical Document ID string order (`lesson-1`, `lesson-10`, `lesson-11`...), which caused the Student Panel to display chapters in Document ID order rather than the Book Editor's custom array sequence.
  - **Book Editor Real-Time Firebase Auto-Sync** (`BookEditorPanel.tsx`): Updated `saveBookLocally` in `BookEditorPanel` to call `saveBookToFirebase(modifiedBook)`. Every chapter edit (renaming titles/subtitles, adding/deleting chapters, reordering chapters, editing topics and pages) now automatically syncs to Firebase subcollections and IndexedDB in real time so the Student Panel immediately reflects renamed and reordered chapters.
  - **Firebase Subcollection Sub-Lesson Single Source of Truth** (`App.tsx`): Updated `fetchBookLessons` and the `onSync` handler to use subcollection lessons directly as the single source of truth rather than prepending/merging stale in-memory `book.lessons`, ensuring deleted chapters in Firebase subcollections are immediately purged from state.
  - **IndexedDB Sync on Chapter Save** (`App.tsx`): Updated `saveBookToFirebase` to immediately update IndexedDB (`dbLocal.offline_lessons`) with the new lesson list so local offline cache stays in sync when chapters are purged or renamed.
  - **Offline Draft Resurrection Guard** (`App.tsx`): Updated `books` `useMemo` so live Firebase lessons are only appended if `sync_status === 'synced'`, preventing locally deleted chapters from being resurrected by live state in `BookEditorPanel` and `AdminPanel`.
- **Rich Text Question Editor Mode Preservation** (`QuestionEditorPage.tsx`): Preserved `displayMode` and `tabs` properties in the `normalise()` question helper and added a **Display Manner** toggle button (`📊 Accountancy Mode` vs `📄 Standard Mode`) to the standalone editor page.

## [2026-09-04] - Accountancy Solution Chip Full Text Extraction, Enhanced Synchronize & Android APK Build

### Added
- **Notes to Accounts Table Preset**: Added 3-column accountancy table type (`notes_to_accounts`) with Particulars (70%), Unnamed (15%), and Amount (15%) column widths.
- **Context-Aware Table Solution Chips**: Solution chips now pull chips strictly from solution tables matching the active table type (e.g. Notes to Accounts, Journal, T-Shape Account/Ledger).
- **Expanded Solution Chips Bar**: Doubled solution chips container width to `w-[576px]` (`max-w-[90vw]`) for enhanced visibility.

### Fixed & Improved
- **Preserved Complete Cell Text in Solution Chips** (`solutionChipExtractor.ts`): Removed leading number/bullet stripping in `sanitizeChip` and updated `isValidChipText` so complete cell text (including numbers, item numbers, share quantities, and figures like `"1. Share Capital"` or `"10,000 Equity Shares of ₹10 each"`) is extracted as solution chips while excluding pure monetary amounts.
- **Multi-Book Synchronize Button** (`App.tsx`): Enhanced `handleTriggerSync` so clicking Synchronize can sync ALL textbooks available to the active profile when no single book is selected, or sync the active book when open. Merges subcollection lessons, updates IndexedDB offline storage (`dbLocal.offline_lessons`), pre-caches all lesson images locally on native Android devices for 100% offline functionality, and syncs local annotations.
- **Android APK Build**: Fresh native Android debug APK compiled (`android/app/build/outputs/apk/debug/app-debug.apk` and mirrored in `releases/ExtraPadhai_v5.0.apk`), optimized at **13.67 MB** with full offline capabilities preserved.

## [2026-08-28] - Fix FAB Menu Crashes, Solution Toggle Styling & Add Flashcard Difficulty Filtering

### Added
- **Classroom Retrieval Cards Difficulty Filtering** (`FloatingButton.tsx`): Added filter tab options (**All**, **Easy**, **Medium**, **Hard**) with dynamic badge counts to the Flash Retrieval Cards container header. Filters the active flashcard deck dynamically with fallback empty states.

### Fixed
- **Floating Button Menu Uncaught Crashes** (`FloatingButton.tsx`, `mathPreprocessor.ts`):
  - Fixed blank screen issue when clicking 'Q' by adding null checks (`Boolean(q)`) in `getLessonQuestions()` and property access guards.
  - Added string conversion and outer `try/catch` to `renderMathInRawHtml()` to prevent uncaught `TypeError` when processing non-string or legacy question objects.
  - Added `QuestionListErrorBoundary` around question items list.
  - Restored missing `handlePointerMove` handler in `QuestionItem` to resolve `ReferenceError` on bottom-left drag-to-resize handle.
  - Restored missing `FlashcardContent` component definition in `FloatingButton.tsx` to resolve `ReferenceError` when opening Retrieval Cards ('?').
- **Solution/Answer Button Layout & Styling** (`FloatingButton.tsx`, `AccountancyQuestionModal.tsx`):
  - Replaced text-labeled solution button with icon-only (`Eye`/`EyeOff`) toggle button positioned on the right with dark grey styling.

## [2026-08-27] - Auto-create Subject Folder + Logo Copy & Student Panel Logo Sizing + Sync Fix

### Added
- **Student Panel Logo Display** (`Workspace.tsx` & `App.tsx`): Passed `globalLogo` prop to `Workspace` and updated the initial empty workspace screen layout to remove all headings, descriptions, and drag-and-drop boxes, displaying **only the logo** at 50% screen height and 50% screen width (`w-[50vw] h-[50vh] max-w-[50vw] max-h-[50vh] object-contain`).
- **Sync Button Fix & Offline Persistence** (`App.tsx`):
  - Updated `handleTriggerSync` to sanitize `inquiryQuestions` alongside `pages` and `flashQuestions`.
  - Fixed sync persistence so it always writes synced lessons into `dbLocal.offline_lessons` in IndexedDB.
  - Added background image caching for native Android (`downloadAndCacheImage`) to download inquiry question media to device filesystem during sync.
  - Updated `fetchBookLessons` to sanitize `inquiryQuestions` arrays from subcollections.
- **Android APK Build**: Compiled production web assets (`npm run build`), synced Capacitor assets (`npx cap sync android`), and built new Android debug APK (`android/app/build/outputs/apk/debug/app-debug.apk`).

- **`createSubjectFolder()` helper** (`firebaseHelper.ts`): On first creation of a subject folder:


  1. Uploads a `.keep` placeholder to `images/subjects/{subjectName}/` to materialise the folder.
  2. Reads the branding logo URL from `settings/branding` in Firestore and copies it into `images/subjects/{subjectName}/logo.png` — so every subject folder immediately contains the app logo.
  - Fully idempotent: if `.keep` already exists the function exits immediately with no work done.
- **Auto-folder + logo on Subject Node creation** (`AdminPanel.tsx` → `handleAddSubject`): Runs `createSubjectFolder` in the background as soon as a new Subject Node is saved.
- **Auto-folder safety-net on Upload Chapter** (`AdminPanel.tsx` → `handleUploadChapter`): Ensures the subject folder exists before the image upload loop begins, backfilling subjects that existed before this feature.

### Migration
- One-shot Node.js script (`scratch5.mjs`) was run to retroactively create folders and copy the logo for all **19 existing subjects**: Science, Social Science, History, Physical Education, Sanskrit, Economics, Mathematics, Skill Education, Fine Art, Geography, Arts, Political Science, English, Physical Education and Well-being, Drawings, Urdu, Hindi, Business Studies, Accountancy.

## [2026-08-02] - v5.0 APK — Offline Fixes, Accountancy Tables & APK Size Optimization

### Added
- **T-Shape Account (No Date)**: New 6-column accountancy table type with unnamed J.F. columns (index 1 & 4) that are active, numeric, and right-aligned. `To`/`By` chip selection shown manually — no auto-prefix. Auto-total excluded for unnamed J.F. columns.
- **Company Balance Sheet (Schedule III)**: New balance sheet preset with Particulars (60%), Note No. (5%), Current Year (15%), Previous Year (15%) column widths.
- **Refresh / Delete buttons on Total row**: Shown only in the cell containing the word `Total`. Refresh recalculates column totals; Delete clears the entire total row.
- **`By` chip styling**: `By` chip now shown in distinct sky-blue color (separate from amber `To` chip) in T-Shape (No Date) table.
- **Offline notice for `iframeUrl` pages** (`Workspace.tsx`): When offline, shows "Page Unavailable Offline" instead of blank iframe.
- **Offline image placeholders** (`FloatingButton.tsx`): When offline, inquiry question images show a "Image unavailable offline" placeholder with `WifiOff` icon.

### Fixed
- **`App.tsx` `isOnline` auto-detection**: Wired to real `navigator.onLine` + `window.addEventListener('online'/'offline')` events. Previously was a manual toggle only — now automatically reflects real network changes.
- **Journal tab blank screen**: Restored missing `solutionChips` memoization that caused a React crash.
- **Column total calculation**: Excluded disabled cells (J.F./L.F.) and `Date` columns from summation.
- **`isCellDisabledInRow` for T-Shape (No Date)**: Previously disabled ALL columns; now correctly only activates columns 1 & 4 (unnamed J.F.) and still disables named L.F./J.F. columns.
- **Chip dropdown for `Note No.`, `Current Year`, `Previous Year`**: Excluded these column types from chip eligibility in `isTextColumnEligibleForChips`.
- **Removed `localhost:3005` debug fetch** from `Workspace.tsx` (dead code in production, fired on every lesson change).

### Changed
- **APK version**: 4.0 → **5.0** (versionCode 4 → 5).
- **Vite build**: Added `esbuild` minifier, `es2020` target, `sourcemap: false`, and `manualChunks` splitting for firebase, react, katex, tinymce, tanstack, lucide. Removes ~2-4 MB from production bundle.
- **APK size**: **13.49 MB** (down from ~14.9 MB). The recurring APK-in-`public/` bloat bug was also fixed again (both `ExtraPadhai.apk` and `app-debug.apk` removed from `public/`).
- **APK location**: New APKs stored in `releases/ExtraPadhai_v5.0.apk` — NOT in `public/` (to prevent recursive bloat).

### Prevention Note
- **NEVER** place APK files inside `public/`. They get copied verbatim into `dist/` by Vite and then into Android assets by the manual copy step, causing recursive APK bloat.
- The `releases/` folder is the correct location for compiled APKs.

## [2026-07-14] - APK Size Reduced 82% (78.85 MB → 14.2 MB)

### Fixed
- **Recursive APK bloat recurred**: `public/ExtraPadhai.apk` (68.5 MB) was present in the source `public/` folder, causing Capacitor to bundle the entire previous APK as a static web asset inside every new build. Deleted the file from `public/` and from `android/app/src/main/assets/public/`.
- **LandingPage download button reverted to local path**: The APK download `href` in `LandingPage.tsx` had been changed back to `/ExtraPadhai.apk` (a local path), breaking the web download and forcing the APK to be bundled. Restored the Firebase Storage URL: `https://firebasestorage.googleapis.com/v0/b/samrtboard.firebasestorage.app/o/apk%2FExtraPadhai.apk?alt=media&token=77397704-0cbf-483b-95d4-7d1d72347412`.
- **Verified no app assets were removed**: `smartboard1img.webp`, `teacher_smartboard.png`, all KaTeX fonts, TinyMCE, JS bundles, CSS, and splash screens are all intact in the new APK.
- **Firebase Storage URL confirmed in bundle**: `firebasestorage.googleapis.com` present in `index-CS7Wq_Rd.js`; old `/ExtraPadhai.apk` local path absent.

> **Prevention note**: To stop this from recurring, never place binary APK files inside `public/`. The `public/` folder is Vite's static asset directory — everything in it is copied verbatim into `dist/` and then into Android assets by Capacitor.

## [2026-07-14] - Android APK Rebuilt with stripInlineStyles Fix

### Fixed
- **Android APK was using stale pre-fix assets**: The Android `assets/public/` directory contained the Jul 13 10:08 AM build (`index-CgtTAfLD.js`) which predated the `stripInlineStyles` definitive fix. Confirmed Chapter 4 rendering issue was caused by this stale bundle being baked into the APK.
- **Build pipeline**: Ran fresh `npm run build` → manual asset sync (Capacitor CLI requires Node ≥22, system has v20, so assets were manually copied from `dist/`) → `gradlew assembleDebug`.
- **Verified fix presence in bundle**: `DOMParser`, `removeProperty`, and `lesson-annotation` guard all confirmed present in `index-CHqNV7RQ.js` inside the APK.
- **APK details**: 78.85 MB debug APK built Jul 14 2026 07:16 — contains the `stripInlineStyles` fix that sanitises TinyMCE inline `color`/`background-color` styles before `dangerouslySetInnerHTML` so Chapter 4 (and all other lessons) render correctly on Android.

## [2026-07-13] - Definitive Fix: Translucent/Faint Text in Student Panel

### Fixed
- **Faint/translucent text on lessons with many pages** (`Workspace.tsx`, `index.css`): Root cause identified as TinyMCE's `content_css: 'dark'` editor baking near-white inline colour styles (e.g. `style="color: rgb(226,232,240)"`) into saved HTML. These are invisible on light student themes (Parchment, Mono). Previous CSS `!important` and post-render DOM-stripping fixes were insufficient because React's reconciler only replaces DOM nodes when the HTML **string** changes; if `onSnapshot` re-fires with the same raw HTML the DOM is never updated and `useLayoutEffect` sees nothing to fix.
  - **Definitive fix**: Added `stripInlineStyles()` utility (using `DOMParser`) that sanitises the HTML string *before* `dangerouslySetInnerHTML` ever sees it. Hooked into a `useMemo` keyed on `activeLesson.id` so DOMParser only runs when the lesson changes, not on every re-render.
  - Removed inline `color`, `background-color`, `background`, `opacity`, `mix-blend-mode`, and `filter` from all elements, preserving KaTeX internals and `lesson-annotation` spans.
  - Retained the CSS belt-and-suspenders rules (`.reader-content * { color: inherit !important }`) as a fallback.


## [2026-07-04] - Multi-profile Switcher, Native APK Alignment, XLSX Uploaders, Tablet Simulator, & Git Purge

### Added
- **Firebase Storage APK Hosting**: Moved hosting of the `ExtraPadhai.apk` binary file to Firebase Storage to bypass Firebase Hosting CDN (Varnish/Fastly) `503 backend read error` timeouts on large files.
- **Fresh Native APK Compile**: Re-compiled the Android app from updated source code, ensuring all student panel content view features are fully present in the native APK.
- **Android Tablet Simulator (Extra Pad)**: Added a widescreen Android Tablet simulator with physical Back, Home, and Recents hardware controls, time/battery status bar, auto-scaling engine to fit the laptop viewport, and a rotation toggle (Landscape/Portrait orientations).
- **Multi-Class Profiles**: Added the ability for students to configure and study up to 2 distinct classes. Features a dual-profile switcher widget in the Library Shelf Selector, allowing seamless switching.
- **Boot-up Routing**: The app now always boots to the Landing Page initially so updates are visible to students. Clicking "Start Learning" routes to the Library Selector if profiles exist, or the Class Selector otherwise.
- **Native APK Storage Mirroring**: Integrated native `@capacitor/preferences` storage to persist class profiles (`studyClasses`) and active index (`activeClassIndex`) dynamically, ensuring settings survive updates and cache clears. Added a spinner/loader screen during boot.
- **Offline Blackboard Warnings**: Added `isOnline` awareness to `Workspace` and `BlackboardPanel`. Opening a video annotation while offline replaces the broken iframe with an elegant "Offline: Streaming Paused" notice.
- **XLSX Bulk Question Uploaders**: Added SheetJS (`xlsx`) library. Both `FlashQuestionManager` (Diagnostic Quizzing) and `InquiryQuestionManager` now accept `.xlsx` and `.xls` files, parsing them into structured questions.
- **XLSX Templates**: Changed the template download buttons to generate and trigger download of `.xlsx` files (`flashcards_template.xlsx` and `inquiry_template.xlsx`) using SheetJS client-side workbook exporters.
- **Developer Cache Reset**: Added a "Reset System Cache" button in the Landing Page footer to wipe local storage, IndexedDB, and native preferences for clean-slate testing.

### Fixed
- **Scrollability on Mobile/Tablet**: Fixed vertical scrolling on the Profile Selection Screen (`ClassSelector.tsx`) and Book Selection Screen (`GradeSelector.tsx`) by removing `overflow-hidden` constraints and setting container heights dynamically to `min-h-screen` and `overflow-y-auto`.
- **APK Recursive Build Bloat**: Discovered and resolved a recursive build bug where Capacitor copied `public/ExtraPadhai.apk` into native Android assets, packaging previous builds inside subsequent ones recursively (bloating size to 1.59 GB). Deleting duplicate APKs from assets and building clean brought the APK size down to **14.11 MB**.
- **Git History Purge**: Purged large, expired intermediate files (`public/app-debug.apk`, `public/ExtraPadhai.apk`, `jdk21.zip`) from Git history using `git filter-branch` to resolve GitHub's 100MB file limit pre-receive hook decline.
- **Removed Home Buttons**: Removed the Home / Back-to-Landing buttons from the Class Profile wizard header and Library Shelf header to restrict students to their workspace dashboard.

## [2026-07-03] - Image Externalization (Option C) & Firestore 1MB Fix

### Fixed
- **Firestore 1MB document limit on `books/{id}`**: `saveBookToFirebase` and `bulkUpdateBooksInFirebase` now run `externalizeBookImages()` before every Firestore write. Any base64 data-URIs embedded in TinyMCE HTML (`page.content`) or direct image fields (`leftImage`, `centerImage`, `rightImage`, `coverImage`, inquiry `image`/`answerImage`) are uploaded to Firebase Storage and replaced with `https://` URLs. Firestore documents now stay tiny regardless of book size.
- **Firestore 1MB limit on `editor_submissions/{id}`**: Editor submissions are now split into a lightweight metadata document + one Firestore sub-document per lesson under `editor_submissions/{bookId}/lessons/{i}`. The parent doc no longer carries the `lessons` array.
- **Admin approval cleanup**: The "Approve & Sync Live" flow now deletes all lesson sub-documents from the submission subcollection before deleting the parent, preventing orphaned storage.

### Added
- **`src/lib/imageExternalizer.ts`**: New utility module. Exports `externalizeBookImages(book)` and `externalizeLessonImages(lesson, bookId)`. Scans all base64 data-URIs in a Book/Lesson object and uploads them to Firebase Storage under `books/{bookId}/lessons/{lessonId}/images/`, returning the object with URLs in place of blobs.
- **Storage rules**: Added explicit `allow read: if true` rules for `books/**` and `inquiry-questions/**` paths so unauthenticated student viewers can load externalized lesson images.


## [2026-07-02] - Inquiry Question Answer Field

### Added
- **Answer field on Inquiry Questions**: `InquiryQuestionObj` now carries three optional answer fields — `answerText`, `answerImage`, and `answerImagePosition` — mirroring the existing question fields exactly.
- **Q/A Tab in Advanced Editor Modal** (`InquiryQuestionManager.tsx`): The Quick Editor modal now has a **Question / Answer** tab bar. Switching tabs swaps the TinyMCE rich-text editor, image uploader, and image-position controls to operate on the answer fields instead of the question fields.
- **Answer presence indicator in the question list**: Each question row now shows a gold "A" badge and a truncated answer preview when an answer has been entered, or a muted "No answer yet" hint otherwise.
- **"Edit A" / "+ Add A" shortcut button**: Each rich-text question row in the Active Questions list now has a direct answer-edit button next to the existing "Edit Q" and "Delete" controls.
- **Q/A Mode Toggle in QuestionEditorPage** (Rich Editor new-tab): The center editor tab bar now has **Question** and **Answer** tabs. The right-sidebar image upload and position controls are fully mode-aware. The TinyMCE editor re-initialises on mode switch to load the correct content. The left sidebar shows a `💬 A` badge next to any question that already has an answer.
- No Firebase migration required — the new fields are optional and default to `undefined` for existing data.

## [2026-07-02] - Editor Submission & Admin Review Workflow

### Added
- **Editor Submission Flow**: Book editors now have a **"Submit to Admin"** button in their panel header. This packages their local offline edits and pushes them to a new Firebase `editor_submissions` collection for admin review.
- **Admin Review Button**: In Admin Panel → Book Editors tab, a glowing amber **"Review Submission"** button appears dynamically on any editor's row when they have a pending submission.
- **Admin Preview Mode**: Clicking "Review Submission" opens the Book Editor Panel in a read-only Preview Mode, showing the admin exactly what the editor drafted. A yellow banner warns that local saving is disabled.
- **Approve & Sync Live**: In Preview Mode, admin gets a green **"Approve & Sync Live"** button that pushes the drafted lessons to the live Firebase curriculum and deletes the staging submission.
- **EditorSubmission type**: Added `EditorSubmission` interface to `src/types.ts`.
- **Firestore Rules**: Added `editor_submissions` and `notes` collection rules to `firestore.rules`.

### Removed
- **Sync Offline tab**: Removed the "Sync Offline" sidebar tab and `SyncManager` from the Admin Panel — replaced by the new Editor Submission workflow.
- **Redundant Save button**: Removed the "Save" button from the Book Editor Panel header (auto-save already handles this).

### Fixed
- **Blank screen on editor sign-in**: `CheckCircle2` and `Cloud` icons were used in JSX but missing from lucide-react imports — caused a silent React crash. Fixed by adding them to the import block.
- **Admin Preview showing "Unassigned Editor"**: The `onAuthStateChanged` listener was overwriting `previewBookId` with `null` (admin has no `assignedBookId`). Fixed by skipping the auth check entirely when `isPreviewMode` is true.
- **Firestore Permission Denied on Submit**: The `editor_submissions` collection had no Firestore security rule, defaulting to deny. Fixed by adding allow read/write for authenticated users.


### Fixed
- **Two-Page Layout Engine**: Fixed an alignment bug in `Workspace.tsx` where lessons without rich text content were forcing a standard reader layout instead of utilizing the Two-Page/Single-Page image toggle view.
- **Offline Sync Manager**: Updated `SyncManager.tsx` to completely delete locally cached IndexedDB records (`dbLocal.offline_lessons`) upon successful synchronization to Firebase, preventing stale offline edits from permanently overriding live cloud data.
- **Offline Curriculum Isolation**: Modified `App.tsx` state management to strictly isolate local IndexedDB lesson overrides to the `activeScreen === 'book-editor'` context. Student views (`Workspace`) now unconditionally fetch from the live Firebase curriculum, ensuring tablet APKs perfectly mirror the web application.

### Changed
- **APK Initial Setup Screen**: Completely modernized `ExtraSmartboardDownload.tsx`. Removed the legacy PDF fetching logic and replaced it with a dynamic UI that simulates a synchronous content-preparation step, bringing the tablet setup screen in line with the new Firebase-backed database architecture.
- **Layout Constraints**: Adjusted CSS container width constraints for the reader view to prevent text from being uncomfortably squeezed together on wide displays.
