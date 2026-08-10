<p align="center">
  <img src="./icons/icon.svg" width="104" height="104" alt="One Shortcut for AI Chat logo" />
</p>

<h1 align="center">One Shortcut for AI Chat</h1>

<p align="center">One prompt. Six assistants. Fresh chats.</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./docs/DEVELOPMENT.md">Development guide</a> ·
  <a href="./PRIVACY.md">Privacy</a>
</p>

## Overview

One Shortcut for AI Chat is a lightweight, dependency-free Chrome extension that sends the same text prompt to new conversations across multiple AI assistants. It also gives supported sites a consistent new-chat shortcut and preserves their native chat-search shortcut.

The extension runs entirely in Chrome. It has no backend, analytics, or account system.

## Features

- Send one text prompt to any combination of six AI assistants.
- Select all assistants by default, then opt out of individual services when needed.
- Reuse the first matching tab, with tabs in the current window taking priority.
- Open a background tab when an assistant is not already open.
- Start a fresh conversation before every broadcast delivery.
- Keep deliveries independent so one failed site does not block the others.
- Close the popup automatically when processing finishes and show a Chrome notification if any delivery fails.
- Use one new-chat shortcut across every supported site.

## Supported assistants

| Assistant | Website | Broadcast | New chat | Search chats |
| --- | --- | :---: | :---: | :---: |
| ChatGPT | `chatgpt.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Claude | `claude.ai` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Gemini | `gemini.google.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Grok | `grok.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| DeepSeek | `chat.deepseek.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Doubao | `doubao.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |

Gemini normally uses a different search shortcut; the extension remaps it so the same shortcut works on all six sites.

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
3. Enter a text prompt.
4. Keep all assistants selected or choose a subset.
5. Click **Send**, or press `Command+Enter` / `Ctrl+Enter`.

For each selected assistant, the extension navigates the first matching tab to a new-chat page. If no matching tab exists, it creates an inactive tab. When multiple matching pages are open, the first tab in the current window is preferred.

## Shortcuts

- `Shift+Command+O` / `Ctrl+Shift+O`: start a new chat on the current supported site.
- `Command+K` / `Ctrl+K`: search chats on all six supported sites.

Change the new-chat shortcut at `chrome://extensions/shortcuts` if it conflicts with another extension.

## Privacy and permissions

Prompts are held only long enough to deliver them to the assistants selected in the popup. The extension does not store prompts, collect usage data, or send information to a developer-controlled server. Each selected AI service receives the prompt and processes it under its own privacy policy.

| Permission | Why it is needed |
| --- | --- |
| `tabs` | Find and reuse existing assistant tabs or create new background tabs. |
| `notifications` | Report the names of assistants whose delivery failed. Nothing is shown when every delivery succeeds. |

See [PRIVACY.md](./PRIVACY.md) for the complete privacy statement.

## Limitations

- Only text prompts are supported; images and file attachments are not yet supported.
- You must already be signed in to each selected service.
- Delivery depends on the current page structure of third-party AI websites. Site updates may require selector or event-handling changes.
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
