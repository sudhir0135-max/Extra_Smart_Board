# Changelog

All notable changes to this project will be documented in this file.

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
