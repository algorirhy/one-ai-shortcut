# One Shortcut for AI Chat

[English](./README.md)

一个轻量的 Chrome 扩展，用于把同一段文字发送到多个 AI 助手的新对话，并统一常用的对话快捷键。

## 向多个 AI 助手发送同一段内容

1. 点击扩展图标。
2. 输入文字内容。
3. 保持默认全选，或手动选择要发送的 AI 助手。
4. 点击 `Send`，或按 `Command+Enter` / `Ctrl+Enter`。

对于每个选中的 AI 助手，扩展会优先复用当前窗口中第一个匹配的标签页。如果没有已打开的页面，则在后台创建新标签页。随后进入新对话、填入内容并发送。单个网站失败不会中断其他网站。

## 快捷键

- `Shift+Command+O` / `Ctrl+Shift+O`：在当前支持的网站中新建对话
- `Command+K` / `Ctrl+K`：在 ChatGPT、Claude、Gemini 和 Grok 中搜索对话

## 支持的 AI 助手

- ChatGPT
- Claude
- Gemini
- Grok
- DeepSeek
- Doubao

## 安装

1. 下载或克隆本仓库。
2. 打开 `chrome://extensions`。
3. 开启 `Developer mode`。
4. 点击 `Load unpacked`。
5. 选择当前项目文件夹。

## 说明

- 目前仅支持文字，不支持图片和文件附件。
- 需要事先登录每个选中的 AI 助手。
- AI 网站可能随时修改页面结构，届时可能需要更新扩展中的选择器。
- 扩展只会将内容发送到手动选中的 AI 助手，不会保存输入内容。
- 新建对话使用 `Shift+Command+O`（macOS）或 `Ctrl+Shift+O`（Windows/Linux）。
- 搜索对话在 ChatGPT、Claude、Gemini 和 Grok 中统一使用 `Command+K` / `Ctrl+K`。
- DeepSeek 和 Doubao 暂不支持搜索对话。
- “新建对话”快捷键可以在 `chrome://extensions/shortcuts` 中修改。

## 权限说明

`tabs` 权限仅用于查找已打开的 AI 网站标签页、复用第一个匹配页面，或在没有匹配页面时创建新标签页。

## License

本项目采用 MIT License。详情见 [LICENSE](./LICENSE)。

## 仓库地址

GitHub：[algorirhy/one-ai-shortcut](https://github.com/algorirhy/one-ai-shortcut)
