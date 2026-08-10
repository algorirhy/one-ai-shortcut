# Development Guide / 开发说明

## Architecture

The extension is intentionally small and uses plain JavaScript with Chrome Manifest V3.

| File | Responsibility |
| --- | --- |
| `manifest.json` | Permissions, keyboard command, icons, background worker, and content-script registration. |
| `sites.js` | Shared site catalog: URLs, colors, selectors, and new-chat behavior. |
| `popup.html` / `popup.js` | Message input, attachment validation/encoding, previews, service selection, and acknowledged broadcast requests. |
| `background.js` | Fast job acknowledgement, attachment validation, tab selection/creation, concurrent delivery, and failure notifications. |
| `content.js` | Site detection, generic attachment injection, message entry, submission evidence, standard retry, and page-level shortcuts. |
| `page-main.js` | Restricted main-world bridge for Gemini file events and Doubao file/submission handling. |
| `tests/` | Node.js tests for the site catalog, manifest/CSP contract, terminology, background coordinator, acknowledgement behavior, attachment validation, notifications, and generic submission retry. |
| `README.md` / `README.zh-CN.md` / `PRIVACY.md` / `CHANGELOG.md` | User documentation, privacy disclosure, known limitations, and release history. |

## Delivery flow

1. The popup validates selected files and keeps the original `File` objects for previews. It encodes them locally as data URLs only when the user sends, then passes the message, attachments, selected site IDs, and preferred Chrome window ID to the background worker.
2. The background worker returns a fast job acknowledgement; only then does the popup close. Delivery continues independently of the popup.
3. The background worker processes selected sites concurrently while serializing repeated work for the same site.
4. It prefers the earliest matching tab in the current window, then other matching tabs. If none exists, it creates an inactive tab.
5. The tab is navigated to the site's new-chat URL and the worker waits for both page load and content-script readiness.
6. The content script reconstructs `File` objects, assigns them to a compatible page file input through `DataTransfer` (or delegates to `page-main.js`), inserts optional text, and waits for an enabled send control.
7. After submission it requires page evidence such as a cleared/replaced editor, URL change, user-message insertion, attachment removal, or a sustained send-button state change. Standard integrations reacquire live controls and retry once when no evidence appears.
8. Gemini and Doubao use site-specific main-world paths because isolated-world DOM events do not reliably reach their current framework upload handlers. Doubao additionally uses staged submission fallbacks and may return `requiresUserAction`.
9. Failures are collected without cancelling other sites. Successful broadcasts stay silent; a Chrome notification reports failures or required manual action.

## Site-specific strategies / 各站点实现

| Site | Attachment integration | Submission integration |
| --- | --- | --- |
| ChatGPT | Generic content-script `DataTransfer` path. | Native send control, evidence wait, one live-control retry. |
| Claude | Generic content-script `DataTransfer` path. | Native send control, evidence wait, one live-control retry. |
| Gemini | Main-world file input discovery and change event; includes Angular uploader fallbacks. | Generic content-script send path; preserves the current `/u/<account>` URL when opening a new chat. |
| Grok | Generic content-script `DataTransfer` path. | Reacquires the editor after upload, then uses the standard evidence/retry path. |
| DeepSeek | Generic content-script `DataTransfer` path. | Uses its current primary send-control selector and waits up to 60 seconds for attachment processing before the standard retry. |
| Doubao | Main-world file input and framework-change path. | Waits for decoded previews, upload-idle state, and stable live controls; tries `requestSubmit`, native click, pointer/framework/keyboard paths, then one final stable-control click. |

Doubao is explicitly best effort. A synthetic event dispatched by an extension has `Event.isTrusted === false`, and the current page exposes no stable public submission API. `page-main.js` therefore observes the page after every attempt and reports success only when it sees submission evidence. If all automatic paths fail, it focuses and activates the prepared tab, clears extension-side pending state, and returns `requiresUserAction`; the background notification asks the user to press Enter. Do not report that fallback as a successful delivery.

The main-world bridge only accepts the two declared actions (`page-attach` and `page-submit`), verifies the current supported host and same-window origin, and returns request-scoped results. It has no Chrome extension API access. Page content remains untrusted and all browser permissions stay in isolated extension contexts.

## 网站适配原则

新增或维护网站时，优先修改 `sites.js` 中的声明式配置：

- `hosts` 和 `tabPatterns` 决定网站识别与标签页查找范围。
- `newChatUrl`、`newChatSelectors` 和 `newChatTexts` 决定如何进入新对话。
- `inputSelectors` 与 `sendSelectors` 应按“最稳定、最明确”到“通用回退”的顺序排列。
- `fileInputSelectors`、`attachmentButtonSelectors` 与 `attachmentButtonTexts` 用于定位或唤起附件上传控件。优先使用稳定的 `data-testid` 和无障碍属性。
- 选择器必须限制在对应网站的 manifest 匹配范围内，避免扩大扩展权限。

只有页面框架无法通过普通 DOM 事件正确提交时，才增加站点专用逻辑。Gemini 的文件事件和 Doubao 的文件/发送事件需要在 `MAIN` world 中触发，因此统一由 `page-main.js` 处理。Doubao 提交前还会等待附件预览和控件稳定，失败时重新获取最新输入框与发送按钮，并用完整的指针事件序列和最终原生点击重试；仍无提交证据时才要求手动按 Enter。

## Local testing / 本地测试

Run all automated tests from the repository root:

```bash
node --test tests/*.test.js
```

Then load the project with `chrome://extensions` → **Developer mode** → **Load unpacked**. After changing `manifest.json`, a content script, or an icon, reload the extension and refresh the affected service pages.

Manual smoke test checklist:

1. Open the popup and confirm all six services are selected by default.
2. Send to each service individually and verify that a new chat is created and the input clears.
3. Test an image, a general document, multiple attachments, and an attachment-only message on every service.
4. Send to all services and verify independent delivery and attachment presence.
5. Keep two tabs open for one service and confirm the first tab in the current window is reused.
6. Test `Shift+Command+O` / `Ctrl+Shift+O` and `Command+K` / `Ctrl+K`.
7. Simulate a signed-out, unsupported-file, or structurally changed page and confirm a failure notification appears after the automatic retry.
8. On DeepSeek, verify that a slow attachment upload is allowed to finish before submission rather than being reported as an immediate failure.
9. On Doubao, verify both automatic submission and the manual-Enter notification path; do not treat a populated editor as proof of submission.

## Release checklist / 发布检查

1. Update the version in `manifest.json` and its assertion in `tests/project.test.js`.
2. Run `node --check` on JavaScript files and run the complete test suite.
3. Reload the unpacked extension and complete the manual smoke tests.
4. Confirm `README.md`, `README.zh-CN.md`, `PRIVACY.md`, and `CHANGELOG.md` still describe actual behavior, limitations, and permissions.
5. Search customer-facing copy for obsolete product terminology.
6. Inspect `git diff --check` and the final staged diff before committing.

## Security constraints

- Keep permissions minimal and host access limited to supported services.
- Do not add remote executable code or inline popup scripts.
- Do not persist messages or attachment bytes unless the product explicitly introduces and documents that behavior.
- Treat third-party page content as untrusted and avoid exposing extension APIs to arbitrary page messages.
