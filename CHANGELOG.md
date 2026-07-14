# Changelog

All notable changes to this project will be documented in this file.

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
