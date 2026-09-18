# Changelog

All notable changes to this project will be documented in this file.

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
