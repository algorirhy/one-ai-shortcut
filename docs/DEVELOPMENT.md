# Development Guide / 开发说明

## Architecture

The extension is intentionally small and uses plain JavaScript with Chrome Manifest V3.

| File | Responsibility |
| --- | --- |
| `manifest.json` | Permissions, keyboard command, icons, background worker, and content-script registration. |
| `sites.js` | Shared site catalog: URLs, colors, selectors, and new-chat behavior. |
| `popup.html` / `popup.js` | Prompt input, assistant selection, progress state, and broadcast request. |
| `background.js` | Tab selection/creation, new-chat navigation, concurrent delivery, and failure notifications. |
| `content.js` | Site detection, prompt entry, submission, and page-level shortcuts. |
| `doubao-main.js` | Doubao-only main-world bridge for its React submission handler. |
| `tests/` | Node.js tests for the site catalog, manifest, and background delivery coordinator. |

## Delivery flow

1. The popup sends the prompt, selected site IDs, and preferred Chrome window ID to the background worker.
2. The background worker processes selected sites concurrently while serializing repeated work for the same site.
3. It prefers the earliest matching tab in the current window, then other matching tabs. If none exists, it creates an inactive tab.
4. The tab is navigated to the site's new-chat URL and the worker waits for both page load and content-script readiness.
5. The content script locates the visible editor, inserts the prompt, submits it, and returns a site-level result.
6. Failures are collected without cancelling other sites. A Chrome notification summarizes failed assistants.

## 网站适配原则

新增或维护网站时，优先修改 `sites.js` 中的声明式配置：

- `hosts` 和 `tabPatterns` 决定网站识别与标签页查找范围。
- `newChatUrl`、`newChatSelectors` 和 `newChatTexts` 决定如何进入新对话。
- `inputSelectors` 与 `sendSelectors` 应按“最稳定、最明确”到“通用回退”的顺序排列。
- 选择器必须限制在对应网站的 manifest 匹配范围内，避免扩大扩展权限。

只有页面框架无法通过普通 DOM 事件正确提交时，才增加站点专用逻辑。豆包目前需要在 `MAIN` world 中调用其 React 事件处理器，因此由 `doubao-main.js` 单独处理。

## Local testing / 本地测试

Run all automated tests from the repository root:

```bash
node --test tests/*.test.js
```

Then load the project with `chrome://extensions` → **Developer mode** → **Load unpacked**. After changing `manifest.json`, a content script, or an icon, reload the extension and refresh the affected assistant pages.

Manual smoke test checklist:

1. Open the popup and confirm all six assistants are selected by default.
2. Send to each assistant individually and verify that a new chat is created and the input clears.
3. Send to all assistants and verify independent delivery.
4. Keep two tabs open for one assistant and confirm the first tab in the current window is reused.
5. Test `Shift+Command+O` / `Ctrl+Shift+O` and `Command+K` / `Ctrl+K`.
6. Simulate a signed-out or structurally changed page and confirm a failure notification appears.

## Release checklist / 发布检查

1. Update the version in `manifest.json` and its assertion in `tests/project.test.js`.
2. Run `node --check` on JavaScript files and run the complete test suite.
3. Reload the unpacked extension and complete the manual smoke tests.
4. Confirm `README.md`, `README.zh-CN.md`, and `PRIVACY.md` still describe actual behavior and permissions.
5. Inspect `git diff --check` before committing.

## Security constraints

- Keep permissions minimal and host access limited to supported assistants.
- Do not add remote executable code or inline popup scripts.
- Do not persist prompts unless the product explicitly introduces and documents that behavior.
- Treat third-party page content as untrusted and avoid exposing extension APIs to arbitrary page messages.
