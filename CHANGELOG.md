# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- **Two-Page Layout Engine**: Fixed an alignment bug in `Workspace.tsx` where lessons without rich text content were forcing a standard reader layout instead of utilizing the Two-Page/Single-Page image toggle view.
- **Offline Sync Manager**: Updated `SyncManager.tsx` to completely delete locally cached IndexedDB records (`dbLocal.offline_lessons`) upon successful synchronization to Firebase, preventing stale offline edits from permanently overriding live cloud data.
- **Offline Curriculum Isolation**: Modified `App.tsx` state management to strictly isolate local IndexedDB lesson overrides to the `activeScreen === 'book-editor'` context. Student views (`Workspace`) now unconditionally fetch from the live Firebase curriculum, ensuring tablet APKs perfectly mirror the web application.

### Changed
- **APK Initial Setup Screen**: Completely modernized `ExtraSmartboardDownload.tsx`. Removed the legacy PDF fetching logic and replaced it with a dynamic UI that simulates a synchronous content-preparation step, bringing the tablet setup screen in line with the new Firebase-backed database architecture.
- **Layout Constraints**: Adjusted CSS container width constraints for the reader view to prevent text from being uncomfortably squeezed together on wide displays.
