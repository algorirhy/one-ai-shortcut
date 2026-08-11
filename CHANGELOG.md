# Changelog

Notable changes to One AI Shortcut are documented here. Versions follow the Chrome extension version in `manifest.json`.

## Unreleased

### Changed

- Shorten the product name to **One AI Shortcut** and introduce the broader slogan **“Make every AI chat work your way.”**
- Reframe the English and Chinese documentation around an extensible personal AI chat workflow while keeping broadcasting, attachments, and unified shortcuts equally visible.

## 1.4.1 — 2026-08-10

### Improved

- Close the popup after a fast background-job acknowledgement while delivery continues independently.
- Confirm page submission, reacquire live controls, and retry instead of treating every click as success.
- Reduce DeepSeek attachment failures by allowing its upload and send control more time to become ready.
- Increase Doubao success probability by waiting for stable attachment previews and controls, then using staged form, button, pointer/framework, keyboard, and final live-control attempts.
- Keep successful broadcasts silent; notify only failed deliveries or Doubao's manual-Enter fallback.
- Standardize customer-facing terminology on “AI chatbot” in English and “AI 聊天服务” in Chinese.
- Expand English and Chinese documentation with architecture, platform differences, privacy behavior, and known limitations.

### Fixed

- Prevent stale Doubao upload state from affecting a later delivery.
- Avoid starting attachment file reads before the user sends, so read failures are handled by the popup instead of becoming unhandled promises.
- Correct notification grammar when more than one prepared tab requires manual submission.

## 1.4.0 — 2026-08-10

### Added

- Send images and general files, with optional message text, to all six supported chatbots.
- Attachment picker, drag and drop, image previews, file metadata, removal controls, and shared size validation.
- Site-specific attachment selectors and a shared main-world bridge for Gemini and Doubao.
- Automated tests for attachment validation, background acknowledgement, failure isolation, submission retry, and silent success.

## Earlier releases

- **1.3.1** — Restored the circular three-dot logo.
- **1.3.0** — Added the circular three-dot branding and reorganized project documentation.
- **1.2.1** — Improved Doubao's framework-level submission path.
- **1.2.0** — Added failure notifications and the first Doubao main-world integration.
- **1.1.1** — Fixed Doubao prompt submission.
- **1.1.0** — Added multi-chatbot message broadcasting.
- **1.0.0** — Initial shortcut-focused release.
