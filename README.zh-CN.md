<p align="center">
  <img src="./icons/icon.svg" width="104" height="104" alt="One Shortcut for AI Chat 标志" />
</p>

<h1 align="center">One Shortcut for AI Chat</h1>

<p align="center">一次输入，同时开启六个 AI 助手的新对话。</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./docs/DEVELOPMENT.md">开发说明</a> ·
  <a href="./PRIVACY.md">隐私说明</a>
</p>

## 项目简介

One Shortcut for AI Chat 是一个轻量、无运行时依赖的 Chrome 扩展。它可以把同一段文字发送到多个 AI 助手的新对话，并为所支持的网站统一“新建对话”快捷键，同时保留统一的对话搜索体验。

扩展完全在 Chrome 本地运行，不包含后端服务、数据分析或独立账号系统。

## 主要功能

- 将同一段文字发送给六个 AI 助手的任意组合。
- 默认全选所有助手，也可以逐个取消选择。
- 优先复用当前窗口中第一个匹配的标签页。
- 没有打开相应网站时，在后台创建新标签页。
- 每次发送前进入新的对话页面。
- 各网站独立执行，单个网站失败不会中断其他网站。
- 处理结束后自动关闭弹窗；存在失败时通过 Chrome 系统通知列出失败的网站。
- 在所有支持的网站上使用统一的新建对话快捷键。

## 支持的 AI 助手

| AI 助手 | 网站 | 批量发送 | 新建对话 | 搜索对话 |
| --- | --- | :---: | :---: | :---: |
| ChatGPT | `chatgpt.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Claude | `claude.ai` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Gemini | `gemini.google.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Grok | `grok.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| DeepSeek | `chat.deepseek.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |
| Doubao | `doubao.com` | ✓ | ✓ | `Command+K` / `Ctrl+K` |

Gemini 原本使用不同的搜索快捷键，扩展会进行映射，因此六个网站均可使用同一组快捷键。

## 安装方法

1. 下载或克隆本仓库。
2. 在 Chrome 中打开 `chrome://extensions`。
3. 开启右上角的 **开发者模式**。
4. 点击 **加载已解压的扩展程序**。
5. 选择本项目文件夹。

拉取新版本后，需要在扩展卡片上点击 **重新加载**，并刷新已经打开的 AI 网站页面，使新的内容脚本生效。

## 使用方法

1. 预先登录准备使用的 AI 服务。
2. 点击 Chrome 工具栏中的扩展图标。
3. 输入要发送的文字。
4. 保持全部选中，或只选择需要的助手。
5. 点击 **Send**，也可以按 `Command+Enter` / `Ctrl+Enter`。

对于每个选中的助手，扩展会把第一个匹配的标签页导航到新对话页面。没有匹配页面时，会创建一个非活动标签页。如果同时打开了多个匹配页面，优先使用当前窗口中位置最靠前的标签页。

## 快捷键

- `Shift+Command+O` / `Ctrl+Shift+O`：在当前支持的网站中新建对话。
- `Command+K` / `Ctrl+K`：在六个支持的网站中搜索对话。

如果新建对话快捷键与其他扩展冲突，可以在 `chrome://extensions/shortcuts` 中修改。

## 隐私与权限

输入内容只会在发送过程中短暂保留，并发送给弹窗中选中的 AI 服务。扩展不会保存提示词、收集使用数据，也不会把信息发送到开发者控制的服务器。被选中的 AI 服务会按照各自的隐私政策处理收到的内容。

| 权限 | 用途 |
| --- | --- |
| `tabs` | 查找并复用已经打开的 AI 网站标签页，或创建新的后台标签页。 |
| `notifications` | 发送失败时列出失败的 AI 助手；全部成功时不显示通知。 |

完整说明见 [PRIVACY.md](./PRIVACY.md)。

## 当前限制

- 目前仅支持文字，不支持图片或文件附件。
- 必须事先登录准备使用的 AI 服务。
- 发送功能依赖第三方网站当前的页面结构；网站更新后可能需要调整选择器或事件处理方式。
- 被复用的标签页会进入新对话；原对话是否保留在历史记录中由对应 AI 服务决定。

## 开发与测试

项目没有运行时依赖，也不需要构建。自动化测试仅使用 Node.js 内置模块：

```bash
node --test tests/*.test.js
```

项目采用 Chrome Manifest V3，并将弹窗脚本全部放在外部文件中，以符合内容安全策略。架构、网站适配方法和发布检查清单见[开发说明](./docs/DEVELOPMENT.md)。

## 开源许可

本项目采用 [MIT License](./LICENSE)。

GitHub：[algorirhy/one-ai-shortcut](https://github.com/algorirhy/one-ai-shortcut)
