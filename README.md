<p align="center">
  <img src="./icons/icon.svg" width="104" height="104" alt="One AI Shortcut logo" />
</p>

<h1 align="center">One AI Shortcut</h1>

<p align="center">Make every AI chat work your way.</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="#install">Install</a> ·
  <a href="./PRIVACY.md">Privacy</a> ·
  <a href="./CHANGELOG.md">Changelog</a>
</p>

## What it does

One AI Shortcut is a personal Chrome extension for improving everyday workflows across AI chat websites. Its current tools broadcast prompts and attachments, open fresh conversations, and provide consistent chat shortcuts.

- Broadcast text, images, and files to any combination of six supported chatbots.
- Start every delivery in a fresh conversation.
- Add up to five attachments by file picker or drag and drop; text is optional.
- Reuse an existing service tab when possible, or open an inactive tab when needed.
- Deliver to each service independently, retry unconfirmed submissions, and notify only when something fails or needs manual action.
- Keep a consistent new-chat shortcut across supported websites.

The extension has no runtime dependencies, backend, analytics, or separate account system.

## Supported chatbots

| Chatbot | Website | Message | Attachments | Fresh chat |
| --- | --- | :---: | :---: | :---: |
| ChatGPT | `chatgpt.com` | ✓ | ✓ | ✓ |
| Claude | `claude.ai` | ✓ | ✓ | ✓ |
| Gemini | `gemini.google.com` | ✓ | ✓ | ✓ |
| Grok | `grok.com` | ✓ | ✓ | ✓ |
| DeepSeek | `chat.deepseek.com` | ✓ | ✓ | ✓ |
| Doubao | `doubao.com` | ✓ | ✓ | ✓ |

Attachment availability still depends on each service's current product, account, region, supported formats, and upload limits.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder.

After updating the source, reload the extension and refresh any already-open chatbot pages.

## Use

1. Sign in to the services you want to use.
2. Open the extension popup.
3. Enter a prompt, add attachments, and choose the destinations.
4. Click **Send**, or press `Command+Enter` / `Ctrl+Enter`.

The popup closes once Chrome accepts the background job. The extension then prepares a fresh chat for every selected service, uploads the shared attachments, submits the prompt, and verifies page-level evidence of submission. Successful broadcasts stay silent.

Existing tabs in the current window are preferred. A reused tab is navigated to a new chat; if no matching tab exists, an inactive tab is created. One service failing does not stop the others.

### Doubao fallback

Doubao may occasionally prepare the prompt and attachments but reject automated submission. In that case, the extension activates the prepared tab and asks you to press Enter. This is a deliberate fallback for a third-party page that does not expose a stable submission API.

## Shortcuts

- `Shift+Command+O` / `Ctrl+Shift+O`: start a new chat on the current supported website.
- `Command+K` / `Ctrl+K`: search chats using each website's search command; the extension maps Gemini to this common shortcut.

Change the new-chat shortcut at `chrome://extensions/shortcuts` if it conflicts with another extension.

## Privacy and permissions

Messages and attachments are processed locally in memory and sent only to the services selected in the popup. The extension does not store content or usage data, intercept chatbot responses, or send anything to a developer-controlled server.

| Permission | Purpose |
| --- | --- |
| `tabs` | Find, reuse, navigate, or create supported service tabs. |
| `notifications` | Report failed deliveries or a required manual submission. |

Each selected service processes the content under its own terms and privacy policy. See [PRIVACY.md](./PRIVACY.md) for details.

## Limits

- Up to 5 attachments, 10 MB per file, and 20 MB total per broadcast.
- You must already be signed in to each selected service.
- Supported file types and account features are determined by each chatbot.
- Delivery depends on third-party page structure and may need maintenance after website updates.
- Reusing a tab replaces its current page with a fresh chat; conversation history remains subject to the service's own behavior.

## Development

No build step or runtime dependencies are required. Run the Node.js test suite from the repository root:

```bash
node --test tests/*.test.js
```

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for architecture, site-specific integration notes, manual testing, and the release checklist.

## License

[MIT](./LICENSE) · [GitHub repository](https://github.com/algorirhy/one-ai-shortcut)
