# Privacy / 隐私说明

## English

One AI Shortcut does not collect, sell, or retain personal information, messages, attachments, browsing history, or usage analytics. It has no developer-operated backend.

When you send a message, the extension processes its text and attachments in memory and sends them only to the AI chatbots selected in the popup. Attachment bytes are encoded locally for transfer between extension components and remain in memory only while the background delivery job is running; the extension does not write them to persistent storage. Selected services receive and process the content according to their own terms and privacy policies. The extension does not intercept or store chatbot responses.

The extension requests only these Chrome permissions:

- `tabs`: locate an existing supported AI service tab, navigate it to a new chat, or create a background tab.
- `notifications`: show a local system notification naming chatbots whose delivery failed.

Website access is limited by the manifest to the six supported AI services. The extension does not use remote code, advertising, tracking pixels, or third-party analytics.

Questions or reports can be submitted through [GitHub Issues](https://github.com/algorirhy/one-ai-shortcut/issues).

## 简体中文

One AI Shortcut 不会收集、出售或保留个人信息、消息、附件、浏览记录或使用分析数据，也没有由开发者运营的后端服务。

发送消息时，扩展只在内存中处理文字和附件，并仅发送给弹窗中选中的 AI 聊天服务。附件数据会在本地编码，用于扩展组件之间的传输，并且只在后台发送任务运行期间保留在内存中；扩展不会把附件写入持久化存储。被选中的服务会按照各自的条款和隐私政策处理收到的内容。扩展不会截取或保存这些服务生成的回复。

扩展仅申请以下 Chrome 权限：

- `tabs`：查找已打开的受支持网站标签页，将其导航到新对话，或创建后台标签页。
- `notifications`：发送失败时，通过本地系统通知列出失败的 AI 聊天服务。

网站访问范围通过扩展清单限制在六个受支持的 AI 服务。扩展不使用远程代码、广告、跟踪像素或第三方分析工具。

如有问题，可以通过 [GitHub Issues](https://github.com/algorirhy/one-ai-shortcut/issues) 提交。
