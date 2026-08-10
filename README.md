# One Shortcut for AI Chat

[简体中文](./README.zh-CN.md)

A lightweight Chrome extension for sending one text prompt to new chats across multiple AI assistants and unifying common chat shortcuts.

## Send One Prompt to Multiple Assistants

1. Click the extension icon.
2. Enter a text prompt.
3. Keep all six assistants selected, or choose only the ones you want.
4. Click `Send` or press `Command+Enter` / `Ctrl+Enter`.

For each selected assistant, the extension reuses the first matching tab in the current window. If none is open, it creates a background tab. It then opens a new chat, fills in the prompt, and sends it. Failures on one site do not stop the other sites.

## Shortcuts

- `Shift+Command+O` / `Ctrl+Shift+O`: start a new chat on the current supported site
- `Command+K` / `Ctrl+K`: search chats on all six supported AI assistants

## Supported AI Assistants

- ChatGPT
- Claude
- Gemini
- Grok
- DeepSeek
- Doubao

## Install

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select this folder.

## Notes

- Only text prompts are supported. Images and file attachments are not supported yet.
- You must already be signed in to each selected AI assistant.
- AI websites can change their page structure at any time, which may require selector updates in this extension.
- Prompts are sent only to the assistants you select and are not stored by the extension.
- New chat uses `Shift+Command+O` on macOS and `Ctrl+Shift+O` on Windows/Linux.
- Search chats uses `Command+K` / `Ctrl+K` on all six supported AI assistants.
- The new-chat shortcut can be changed in `chrome://extensions/shortcuts`.

## Permissions

The `tabs` permission is used only to find an existing supported AI tab, reuse the first matching tab, or create a new one when needed.
