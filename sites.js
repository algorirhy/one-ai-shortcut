// Shared site catalog used by the popup, background worker, and content script.

(() => {
  'use strict';

  const freezeList = (items) => Object.freeze([...items]);

  const attachmentLimits = Object.freeze({
    maxFiles: 5,
    maxFileSizeBytes: 10 * 1024 * 1024,
    maxTotalSizeBytes: 20 * 1024 * 1024,
  });

  const sites = [
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      displayUrl: 'chatgpt.com',
      color: '#10b981',
      hosts: ['chatgpt.com'],
      tabPatterns: ['https://chatgpt.com/*'],
      newChatUrl: 'https://chatgpt.com/',
      newChatSelectors: [
        'a[data-testid="create-new-chat-button"]',
        'button[data-testid="create-new-chat-button"]',
        'a[href="/"][aria-label*="chat" i]',
      ],
      newChatTexts: ['New chat', 'New Chat', '新建聊天', '新しいチャット'],
      inputSelectors: [
        '#prompt-textarea',
        'textarea[data-testid="prompt-textarea"]',
        'div[data-testid="composer-text-input"][contenteditable="true"]',
        'div.ProseMirror[contenteditable="true"]',
        'textarea[placeholder*="Message" i]',
      ],
      sendSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Send message"]',
        'button[aria-label*="send" i]',
        'form button[type="submit"]',
      ],
      fileInputSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"]',
      ],
      attachmentButtonSelectors: [
        'button[data-testid="composer-plus-btn"]',
        'button[aria-label*="attach" i]',
        'button[aria-label*="file" i]',
        'button[aria-label*="upload" i]',
        'button[aria-label*="添加" i]',
      ],
      attachmentButtonTexts: ['Attach files', 'Add photos & files', 'Upload from computer', '添加照片和文件'],
    },
    {
      id: 'claude',
      name: 'Claude',
      displayUrl: 'claude.ai',
      color: '#f59e0b',
      hosts: ['claude.ai'],
      tabPatterns: ['https://claude.ai/*'],
      newChatUrl: 'https://claude.ai/new',
      newChatSelectors: [
        'a[href="/new"]',
        'a[data-testid="new-chat"]',
        'button[aria-label*="New chat" i]',
        'a[aria-label*="New chat" i]',
      ],
      newChatTexts: ['New chat', 'Start new chat', '新しいチャット'],
      inputSelectors: [
        'div.ProseMirror[contenteditable="true"]',
        '[data-testid="chat-input"] [contenteditable="true"]',
        'div[contenteditable="true"][data-placeholder]',
        'textarea[placeholder]',
      ],
      sendSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label="Send message"]',
        'button[aria-label*="send" i]',
        'form button[type="submit"]',
      ],
      fileInputSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"]',
      ],
      attachmentButtonSelectors: [
        'button[data-testid*="file" i]',
        'button[aria-label*="attach" i]',
        'button[aria-label*="file" i]',
        'button[aria-label*="upload" i]',
        'button[aria-label*="添加" i]',
      ],
      attachmentButtonTexts: ['Attach files', 'Upload file', 'Add content', '添加文件'],
    },
    {
      id: 'gemini',
      name: 'Gemini',
      displayUrl: 'gemini.google.com',
      color: '#8b5cf6',
      hosts: ['gemini.google.com'],
      tabPatterns: ['https://gemini.google.com/*'],
      newChatUrl: 'https://gemini.google.com/app',
      preserveGoogleAccountPath: true,
      newChatSelectors: [
        'button[aria-label*="New chat" i]',
        'a[aria-label*="New chat" i]',
        'button[data-test-id="new-chat"]',
      ],
      newChatTexts: ['New chat', '新しいチャット'],
      inputSelectors: [
        'rich-textarea .ql-editor[contenteditable="true"]',
        'rich-textarea [contenteditable="true"]',
        '.input-area [contenteditable="true"]',
        'textarea[placeholder]',
      ],
      sendSelectors: [
        'button.send-button',
        'button[aria-label="Send message"]',
        'button[aria-label*="send" i]',
        'form button[type="submit"]',
      ],
      fileInputSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"]',
      ],
      attachmentButtonSelectors: [
        'button[aria-label="Upload & tools"]',
        'button[aria-label*="upload" i]',
        'button[aria-label*="add file" i]',
        'button[aria-label*="attach" i]',
        'button[data-test-id="local-images-files-uploader-button"]',
        'button[data-test-id*="upload" i]',
      ],
      attachmentButtonTexts: ['Upload files', 'Upload file', 'Files', '上传文件'],
    },
    {
      id: 'grok',
      name: 'Grok',
      displayUrl: 'grok.com',
      color: '#f43f5e',
      hosts: ['grok.com'],
      tabPatterns: ['https://grok.com/*'],
      newChatUrl: 'https://grok.com/',
      newChatSelectors: [
        'a[aria-label*="New chat" i]',
        'button[aria-label*="New chat" i]',
      ],
      newChatTexts: ['New chat'],
      inputSelectors: [
        'textarea[placeholder*="Ask" i]',
        'textarea[placeholder]',
        'div[contenteditable="true"]',
      ],
      sendSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label*="submit" i]',
        'button[aria-label*="send" i]',
        'button[class*="send" i]',
        'form button[type="submit"]',
      ],
      fileInputSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"]',
      ],
      attachmentButtonSelectors: [
        'button[aria-label*="attach" i]',
        'button[aria-label*="upload" i]',
        'button[data-testid*="upload" i]',
        'button[data-testid*="attach" i]',
      ],
      attachmentButtonTexts: ['Attach', 'Attach files', 'Upload file', '添加文件'],
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      displayUrl: 'chat.deepseek.com',
      color: '#06b6d4',
      hosts: ['deepseek.com'],
      tabPatterns: [
        'https://chat.deepseek.com/*',
        'https://www.deepseek.com/*',
      ],
      newChatUrl: 'https://chat.deepseek.com/',
      newChatSelectors: [
        '[data-testid="new-chat"]',
        '[class*="new-chat"]',
      ],
      newChatTexts: ['New chat', '新建对话', '新对话'],
      inputSelectors: [
        'textarea#chat-input',
        'textarea[placeholder*="Message" i]',
        'textarea[placeholder]',
        'div[contenteditable="true"]',
      ],
      sendSelectors: [
        'div[role="button"].ds-button--primary.ds-button--filled.ds-button--circle',
        'button[data-testid="send-button"]',
        'button[aria-label*="send" i]',
        'div[role="button"][aria-label*="send" i]',
        'button[aria-label*="发送"]',
        'button[class*="send" i]',
        'div[role="button"][class*="send" i]',
        'form button[type="submit"]',
      ],
      fileInputSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"]',
      ],
      attachmentButtonSelectors: [
        'button[aria-label*="upload" i]',
        'button[aria-label*="attach" i]',
        'div[role="button"][aria-label*="upload" i]',
        '[data-testid*="upload" i]',
      ],
      attachmentButtonTexts: ['Upload files', 'Upload file', '上传文件', '添加文件'],
    },
    {
      id: 'doubao',
      name: 'Doubao',
      displayUrl: 'doubao.com',
      color: '#3b82f6',
      hosts: ['doubao.com'],
      tabPatterns: [
        'https://www.doubao.com/*',
        'https://doubao.com/*',
      ],
      newChatUrl: 'https://www.doubao.com/chat/',
      newChatSelectors: [
        '[data-testid="new-chat"]',
        'a[href="/chat/new"]',
        'a[href="/chat"]',
      ],
      newChatTexts: ['新对话', '新建对话'],
      inputSelectors: [
        'textarea[data-testid*="chat_input"]',
        'textarea[placeholder]',
        'div[contenteditable="true"]',
      ],
      sendSelectors: [
        '#flow-end-msg-send',
        'button:has(svg.text-g-send-msg-btn-text)',
        'button:has(svg[class*="g-send-msg-btn"])',
        'button[data-testid="send-button"]',
        'button[aria-label*="发送"]',
        'button[aria-label*="send" i]',
        'div[role="button"][aria-label*="发送"]',
        'button[class*="send" i]',
        'div[role="button"][class*="send" i]',
        'form button[type="submit"]',
      ],
      fileInputSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"]',
      ],
      attachmentButtonSelectors: [
        'button[aria-label*="upload" i]',
        'button[aria-label*="attach" i]',
        'button[aria-label*="file" i]',
        '[data-testid*="upload" i]',
        '[data-testid*="file" i]',
      ],
      attachmentButtonTexts: ['Upload file', 'Upload files', '上传文件', '添加文件', '文件'],
    },
  ].map((site) => Object.freeze({
    ...site,
    hosts: freezeList(site.hosts),
    tabPatterns: freezeList(site.tabPatterns),
    newChatSelectors: freezeList(site.newChatSelectors),
    newChatTexts: freezeList(site.newChatTexts),
    inputSelectors: freezeList(site.inputSelectors),
    sendSelectors: freezeList(site.sendSelectors),
    fileInputSelectors: freezeList(site.fileInputSelectors),
    attachmentButtonSelectors: freezeList(site.attachmentButtonSelectors),
    attachmentButtonTexts: freezeList(site.attachmentButtonTexts),
  }));

  const frozenSites = Object.freeze(sites);

  function getSite(siteId) {
    return frozenSites.find((site) => site.id === siteId) || null;
  }

  function findSiteByUrl(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return frozenSites.find((site) => site.hosts.some(
        (host) => hostname === host || hostname.endsWith(`.${host}`),
      )) || null;
    } catch (_error) {
      return null;
    }
  }

  function getNewChatUrl(siteId, currentUrl = '') {
    const site = getSite(siteId);
    if (!site) return null;

    if (site.preserveGoogleAccountPath) {
      try {
        const current = new URL(currentUrl);
        const accountPath = current.pathname.match(/^\/u\/\d+/)?.[0];
        if (accountPath) {
          return `https://gemini.google.com${accountPath}/app`;
        }
      } catch (_error) {
        // Use the default Gemini URL when the existing URL cannot be parsed.
      }
    }

    return site.newChatUrl;
  }

  globalThis.OneAIShortcut = Object.freeze({
    sites: frozenSites,
    getSite,
    findSiteByUrl,
    getNewChatUrl,
    attachmentLimits,
  });
})();
