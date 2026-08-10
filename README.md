<p align="center">
  <img src="./icons/icon.svg" width="104" height="104" alt="One Shortcut for AI Chat logo" />
</p>

<h1 align="center">One Shortcut for AI Chat</h1>

<p align="center">One message. Shared attachments. Six fresh AI chats.</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./docs/DEVELOPMENT.md">Development guide</a> ·
  <a href="./PRIVACY.md">Privacy</a> ·
  <a href="./CHANGELOG.md">Changelog</a>
</p>

## Overview

One Shortcut for AI Chat is a lightweight, dependency-free Chrome extension that sends the same message, images, and files to new conversations across multiple AI chatbots. It also gives supported sites a consistent new-chat shortcut and preserves their native chat-search shortcut.

The extension runs entirely in Chrome. It has no backend, analytics, or account system.

## Features

- Send one message with images and files to any combination of six AI chatbots.
- Add attachments with the file picker or drag and drop; image thumbnails and file metadata are shown before sending.
- Select all chatbots by default, then opt out of individual services when needed.
- Reuse the first matching tab, with tabs in the current window taking priority.
- Open a background tab when a selected service is not already open.
- Start a fresh conversation before every broadcast delivery.
- Keep deliveries independent so one failed site does not block the others.
- Close the popup as soon as the background worker accepts the job; confirm each site submission, apply site-specific retries when needed, and notify only failures or required manual action.
- Use one new-chat shortcut across every supported site.

## Supported AI chatbots

| Chatbot | Website | Broadcast | Attachments | New chat | Search chats |
| --- | --- | :---: | :---: | :---: | :---: |
| ChatGPT | `chatgpt.com` | ✓ | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Claude | `claude.ai` | ✓ | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Gemini | `gemini.google.com` | ✓ | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Grok | `grok.com` | ✓ | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| DeepSeek | `chat.deepseek.com` | ✓ | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Doubao | `doubao.com` | ✓ | ✓ | ✓ | `Command+K` / `Ctrl+K` |

Gemini normally uses a different search shortcut; the extension remaps it so the same shortcut works on all six sites.

The attachment checkmark means that an automated upload path is implemented. Actual file types, sizes, account eligibility, and processing time still depend on each service.

## How delivery works

1. The popup validates and reads the selected files locally, then asks the background worker to start a delivery job.
2. The background worker acknowledges the job immediately, allowing the popup to close while delivery continues.
3. For each selected chatbot, the extension reuses the earliest matching tab—preferring the current Chrome window—or creates an inactive tab, then opens a fresh chat.
4. The content script attaches files, enters the message, submits it, and waits for page evidence such as a URL change, a cleared editor, a new user message, or a sustained send-button state change.
5. Standard integrations reacquire the current editor and send control and retry once when no evidence appears. Successful jobs remain silent; only failures or required manual action produce a Chrome notification.

## Platform implementation notes

The six websites do not expose one shared API, so their automation paths are intentionally different:

| Chatbot | Attachment path | Submission path | Operational note |
| --- | --- | --- | --- |
| ChatGPT | Standard page file input via `DataTransfer` | Native send control, submission evidence, one retry | Usually confirms immediately. |
| Claude | Standard page file input via `DataTransfer` | Native send control, submission evidence, one retry | File availability depends on the current Claude account and product UI. |
| Gemini | File input and change event in the page's main JavaScript world | Native send control, submission evidence, one retry | Preserves `/u/<account>` URLs when reusing a signed-in Google account. |
| Grok | Standard page file input via `DataTransfer` | Native send control, submission evidence, one retry | The editor can be replaced after upload, so it is reacquired before sending. |
| DeepSeek | Standard page file input via `DataTransfer` | Wait for the send control, then submit with evidence and one retry | Attachment processing can be noticeably slower; the extension waits longer instead of clicking early. |
| Doubao | File input and framework events in the page's main JavaScript world | Wait for a stable attachment preview and live controls; try form, button, pointer/framework, keyboard, then a final stable-control retry | The most defensive integration, but also the least deterministic. |

### Doubao limitation

Doubao can occasionally prepare the message and attachments without accepting an automated submit action, especially after an attachment upload or a composer re-render. The extension reacquires the latest input and send button, waits for stable state, tries several page-level submission paths, and only reports success after observing submission evidence. If those paths still fail, it activates the Doubao tab and sends a notification asking you to press Enter; the content should already be prepared.

This fallback is deliberate. Chrome extension-generated DOM events are not trusted user events, and Doubao does not expose a stable public submission API. Guaranteeing 100% automatic submission would require broader browser-control permissions, which this extension does not request.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project folder.

After pulling an update, click **Reload** on the extension card and refresh any already-open AI pages so the new content scripts take effect.

## Usage

1. Sign in to the AI services you want to use.
2. Click the extension icon.
3. Enter a message, add images or files, or use attachments without text.
4. Keep all chatbots selected or choose a subset.
5. Click **Send**, or press `Command+Enter` / `Ctrl+Enter`.

For each selected chatbot, the extension navigates the first matching tab to a new-chat page. If no matching tab exists, it creates an inactive tab. When multiple matching pages are open, the earliest tab in the current window is preferred.

## Shortcuts

- `Shift+Command+O` / `Ctrl+Shift+O`: start a new chat on the current supported site.
- `Command+K` / `Ctrl+K`: search chats on all six supported sites.

Change the new-chat shortcut at `chrome://extensions/shortcuts` if it conflicts with another extension.

## Privacy and permissions

Messages and attachments are held in memory only long enough to deliver them to the chatbots selected in the popup. The extension does not store this content, collect usage data, or send information to a developer-controlled server. Each selected AI service receives the content and processes it under its own privacy policy.

| Permission | Why it is needed |
| --- | --- |
| `tabs` | Find and reuse existing AI service tabs or create new background tabs. |
| `notifications` | Report the names of chatbots whose delivery failed. Nothing is shown when every delivery succeeds. |

See [PRIVACY.md](./PRIVACY.md) for the complete privacy statement.

## Limitations

- A broadcast supports up to 5 attachments, 10 MB per file, and 20 MB in total.
- Individual AI services may reject file types or sizes that their current product, account tier, or region does not support. That site is reported as a failed delivery without stopping the others.
- You must already be signed in to each selected service.
- Delivery depends on the current page structure of third-party AI websites. Site updates may require selector or event-handling changes.
- Doubao automatic submission is best effort. A notification may ask you to press Enter when the page ignores extension-generated submission events.
- A reused tab is navigated to a new chat. The previous conversation remains in that service's history, subject to the service's own behavior.

## Development

There are no runtime dependencies or build step. The automated tests use Node.js built-in modules:

```bash
node --test tests/*.test.js
```

The project follows Chrome Manifest V3 and keeps popup scripts external for Content Security Policy compatibility. See the [development guide](./docs/DEVELOPMENT.md) for architecture, site integration notes, and the release checklist.

## License

Released under the [MIT License](./LICENSE).

Repository: [algorirhy/one-ai-shortcut](https://github.com/algorirhy/one-ai-shortcut)
