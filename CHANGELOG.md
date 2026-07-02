# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
