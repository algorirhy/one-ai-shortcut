// Content script for supported AI chatbot pages.
// Handles unified shortcuts and site-specific prompt entry/submission.

(() => {
  'use strict';

  const LOG_PREFIX = '[One AI Shortcut]';
  const IS_MAC = navigator.platform.toUpperCase().includes('MAC');
  const USER_MESSAGE_SELECTORS = [
    '[data-message-author-role="user"]',
    '[data-testid="user-message"]',
    '[data-testid*="user-message" i]',
    'user-query',
    '.user-query',
    '[class*="user-message" i]',
    '[class*="userMessage"]',
  ];

  function currentSite() {
    return OneAIShortcut.findSiteByUrl(window.location.href);
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.getClientRects().length > 0
    );
  }

  function isEnabled(element) {
    if (!element || !isVisible(element)) return false;
    if (element.matches(':disabled')) return false;
    if (element.getAttribute('aria-disabled') === 'true') return false;
    if (element.getAttribute('data-disabled') === 'true') return false;
    if (element.classList.contains('ds-button--disabled')) return false;
    return window.getComputedStyle(element).pointerEvents !== 'none';
  }

  function findVisibleElement(selectors, predicate = isVisible) {
    for (const selector of selectors) {
      try {
        const matches = [...document.querySelectorAll(selector)]
          .filter(predicate)
          .sort((left, right) => (
            right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom
          ));
        if (matches.length) return matches[0];
      } catch (_error) {
        // Ignore a selector if a site update makes it invalid.
      }
    }
    return null;
  }

  function tryClickSelectors(selectors) {
    const element = findVisibleElement(selectors);
    if (!element) return false;
    element.click();
    return true;
  }

  function tryClickByText(texts) {
    const selectors = ['a', 'button', '[role="button"]', '[role="menuitem"]', 'label'];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const text = (element.textContent || '').trim();
        const matches = texts.some((candidate) => (
          text.toLocaleLowerCase() === candidate.toLocaleLowerCase() ||
          text.toLocaleLowerCase().startsWith(candidate.toLocaleLowerCase())
        ));
        if (matches && isVisible(element)) {
          element.click();
          return true;
        }
      }
    }
    return false;
  }

  function isPrimaryModifierPressed(event) {
    return IS_MAC ? event.metaKey : event.ctrlKey;
  }

  function matchesShortcut(event, key, { shiftKey = false } = {}) {
    return (
      isPrimaryModifierPressed(event) &&
      event.key.toLowerCase() === key &&
      event.shiftKey === shiftKey &&
      !event.altKey &&
      !event.repeat
    );
  }

  function navigateToNewChat(site) {
    const url = OneAIShortcut.getNewChatUrl(site.id, window.location.href);
    if (url) window.location.href = url;
  }

  function handleNewChat() {
    const site = currentSite();
    if (!site) return false;

    if (tryClickSelectors(site.newChatSelectors)) return true;
    if (tryClickByText(site.newChatTexts)) return true;

    navigateToNewChat(site);
    return true;
  }

  function openGeminiSearchChats() {
    const searchSelectors = [
      'button[aria-label*="Search" i]',
      'a[aria-label*="Search" i]',
      '[data-test-id="search"]',
    ];

    if (tryClickSelectors(searchSelectors)) return true;
    if (tryClickByText(['Search chats', 'Search'])) return true;

    const eventInit = {
      key: 'K',
      code: 'KeyK',
      bubbles: true,
      cancelable: true,
      composed: true,
      shiftKey: true,
      metaKey: IS_MAC,
      ctrlKey: !IS_MAC,
    };

    document.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    document.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    return true;
  }

  function handleNewChatShortcut(event) {
    if (!matchesShortcut(event, 'o', { shiftKey: true })) return;
    event.preventDefault();
    event.stopPropagation();
    handleNewChat();
  }

  function handleGeminiSearchShortcut(event) {
    if (currentSite()?.id !== 'gemini' || !matchesShortcut(event, 'k')) return;
    event.preventDefault();
    event.stopPropagation();
    openGeminiSearchChats();
  }

  function isPromptEditor(element) {
    if (!isEnabled(element)) return false;
    return (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement ||
      element.isContentEditable ||
      element.getAttribute('contenteditable') === 'true'
    );
  }

  async function waitForPromptEditor(site, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const editor = findVisibleElement(site.inputSelectors, isPromptEditor);
      if (editor) return editor;
      await delay(250);
    }
    throw new Error(`Could not find the ${site.name} message input.`);
  }

  function dispatchInputEvents(element, text) {
    try {
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        data: text,
        inputType: 'insertText',
      }));
    } catch (_error) {
      element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setNativeInputValue(element, text) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    element.focus();
    if (setter) setter.call(element, text);
    else element.value = text;
    dispatchInputEvents(element, text);
  }

  function replaceContentEditableValue(element, text) {
    const fragment = document.createDocumentFragment();
    for (const line of text.split('\n')) {
      const paragraph = document.createElement('p');
      if (line) paragraph.textContent = line;
      else paragraph.append(document.createElement('br'));
      fragment.append(paragraph);
    }
    element.replaceChildren(fragment);
  }

  function setContentEditableValue(element, text) {
    element.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch (_error) {
      inserted = false;
    }

    selection.removeAllRanges();
    if (!inserted || readEditorText(element).trim() !== text.trim()) {
      replaceContentEditableValue(element, text);
    }
    dispatchInputEvents(element, text);
  }

  function readEditorText(element) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return element.value;
    }
    return element.innerText || element.textContent || '';
  }

  async function fillPrompt(editor, prompt) {
    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      setNativeInputValue(editor, prompt);
    } else {
      setContentEditableValue(editor, prompt);
    }

    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      if (readEditorText(editor).trim() === prompt.trim()) return;
      await delay(100);
    }

    throw new Error('The message input did not accept the prompt.');
  }

  async function waitForSendButton(site, timeoutMs = 6000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const button = findVisibleElement(site.sendSelectors, isEnabled);
      if (button) return button;
      await delay(150);
    }
    return null;
  }

  function attachmentFileName(name) {
    const normalized = typeof name === 'string' ? name.trim() : '';
    return (normalized || 'attachment').replace(/[\\/\0]/g, '_');
  }

  function decodeAttachment(attachment) {
    if (!attachment || typeof attachment.dataUrl !== 'string') {
      throw new Error('An attachment could not be read.');
    }

    const match = attachment.dataUrl.match(/^data:([^;,]*)(?:;[^,]*)?;base64,(.*)$/s);
    if (!match) throw new Error(`Could not decode ${attachmentFileName(attachment.name)}.`);

    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], attachmentFileName(attachment.name), {
      type: attachment.type || match[1] || 'application/octet-stream',
      lastModified: Number.isFinite(attachment.lastModified)
        ? attachment.lastModified
        : Date.now(),
    });
  }

  function inputAcceptsFile(input, file) {
    const rules = input.accept
      .split(',')
      .map((rule) => rule.trim().toLowerCase())
      .filter(Boolean);
    if (!rules.length) return true;

    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    return rules.some((rule) => (
      rule === '*/*' ||
      (rule.endsWith('/*') && type.startsWith(rule.slice(0, -1))) ||
      (rule.startsWith('.') && name.endsWith(rule)) ||
      (!rule.includes('/') && !rule.startsWith('.') && name.endsWith(`.${rule}`)) ||
      rule === type
    ));
  }

  function findFileInput(site, files) {
    const candidates = [];
    for (const selector of site.fileInputSelectors) {
      try {
        for (const element of document.querySelectorAll(selector)) {
          if (
            element instanceof HTMLInputElement &&
            element.type === 'file' &&
            !element.disabled &&
            files.every((file) => inputAcceptsFile(element, file))
          ) {
            candidates.push(element);
          }
        }
      } catch (_error) {
        // Ignore invalid selectors after a site update.
      }
    }

    return candidates.sort((left, right) => (
      Number(right.multiple) - Number(left.multiple) ||
      Number(!right.accept) - Number(!left.accept)
    ))[0] || null;
  }

  function matchesAnySelector(element, selectors) {
    return selectors.some((selector) => {
      try {
        return element.matches(selector);
      } catch (_error) {
        return false;
      }
    });
  }

  function tryClickNearbyAttachmentButton(editor, site) {
    const editorRect = editor.getBoundingClientRect();
    let container = editor.parentElement;
    const candidates = [];

    for (let depth = 0; container && depth < 7; depth += 1) {
      for (const element of container.querySelectorAll('button, [role="button"]')) {
        if (!isEnabled(element) || matchesAnySelector(element, site.sendSelectors)) continue;

        const label = [
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.getAttribute('data-testid'),
          element.className,
          element.textContent,
        ].filter((value) => typeof value === 'string').join(' ').toLowerCase();
        if (/send|submit|发送|停止|stop/.test(label)) continue;

        const rect = element.getBoundingClientRect();
        let score = 0;
        if (/attach|upload|file|image|photo|add|plus|附件|上传|文件|图片|照片/.test(label)) score += 8;
        if (element.getAttribute('aria-haspopup')) score += 2;
        if (rect.left < editorRect.left + Math.min(120, editorRect.width * 0.35)) score += 3;
        if (rect.bottom >= editorRect.top - 24 && rect.top <= editorRect.bottom + 48) score += 2;
        if (!(element.textContent || '').trim()) score += 1;
        candidates.push({ element, score, depth });
      }
      container = container.parentElement;
    }

    const candidate = candidates.sort((left, right) => (
      right.score - left.score || left.depth - right.depth
    ))[0];
    if (!candidate || candidate.score < 5) return false;
    candidate.element.click();
    return true;
  }

  async function waitForFileInput(site, files, editor, timeoutMs = 6000) {
    let input = findFileInput(site, files);
    if (input) return input;

    const clickedKnownControl = tryClickSelectors(site.attachmentButtonSelectors);
    if (!clickedKnownControl) tryClickNearbyAttachmentButton(editor, site);
    await delay(350);
    input = findFileInput(site, files);
    if (input) return input;

    tryClickByText(site.attachmentButtonTexts);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      input = findFileInput(site, files);
      if (input) return input;
      await delay(150);
    }

    return null;
  }

  function setInputFiles(input, files) {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
    if (setter) setter.call(input, transfer.files);
    else input.files = transfer.files;

    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  async function attachFiles(site, attachments, editor) {
    if (!attachments.length) return 0;
    const files = attachments.map(decodeAttachment);

    // Gemini and Doubao bind their upload controls in the page's MAIN world.
    // Let the bridge discover and drive those controls directly; requiring an
    // isolated-world input first made valid, dynamically-created inputs look
    // unavailable.
    if (site.id === 'doubao' || site.id === 'gemini') {
      await requestPageMainWorld(site.id, 'page-attach', attachments, 30000);
      await delay(site.id === 'gemini' ? 1800 : 300);
      return files.length;
    }

    let input = await waitForFileInput(site, files, editor);

    if (!input && files.length > 1) {
      input = await waitForFileInput(site, [files[0]], editor);
    }
    if (!input) {
      throw new Error(`${site.name} did not expose a compatible file upload control.`);
    }

    if (input.multiple || files.length === 1) {
      setInputFiles(input, files);
      await delay(500);
      return files.length;
    }

    for (const file of files) {
      const singleInput = await waitForFileInput(site, [file], editor);
      if (!singleInput) {
        throw new Error(`${site.name} stopped accepting files after the first attachment.`);
      }
      setInputFiles(singleInput, [file]);
      await delay(500);
    }
    return files.length;
  }

  function submitWithEnter(editor) {
    const eventInit = {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
      composed: true,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      keyCode: 13,
      which: 13,
      charCode: 13,
    };

    editor.focus();
    editor.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    editor.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    editor.dispatchEvent(new KeyboardEvent('keyup', eventInit));
  }

  function requestPageMainWorld(siteId, action, attachments = [], timeoutMs = 10000, prompt = '') {
    const requestId = `${action}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resultAction = `${action}-result`;

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', handleResult);
        reject(new Error(`${siteId} did not confirm the ${action === 'page-attach' ? 'attachments' : 'submission'}.`));
      }, timeoutMs);

      function handleResult(event) {
        if (
          event.source !== window ||
          event.origin !== window.location.origin ||
          event.data?.source !== 'one-ai-shortcut-page' ||
          event.data?.action !== resultAction ||
          event.data?.requestId !== requestId
        ) {
          return;
        }

        window.clearTimeout(timeout);
        window.removeEventListener('message', handleResult);
        if (event.data.ok) resolve(event.data);
        else reject(new Error(event.data.error || `${siteId} rejected the request.`));
      }

      window.addEventListener('message', handleResult);
      window.postMessage({
        source: 'one-ai-shortcut',
        action,
        siteId,
        requestId,
        attachments,
        prompt,
      }, window.location.origin);
    });
  }

  async function waitForPromptToClear(editor, prompt, timeoutMs = 2500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!editor.isConnected || !readEditorText(editor).trim()) return true;
      await delay(100);
    }
    return readEditorText(editor).trim() !== prompt.trim();
  }

  function userMessageCount() {
    const messages = new Set();
    for (const selector of USER_MESSAGE_SELECTORS) {
      try {
        for (const element of document.querySelectorAll(selector)) messages.add(element);
      } catch (_error) {
        // Ignore selectors that become invalid after a site update.
      }
    }
    return messages.size;
  }

  function createSubmissionSnapshot(editor, sendButton) {
    return {
      url: window.location.href,
      editor,
      sendButton,
      editorText: readEditorText(editor),
      userMessageCount: userMessageCount(),
    };
  }

  async function waitForSubmissionEvidence(snapshot, timeoutMs = 6000) {
    const deadline = Date.now() + timeoutMs;
    let disabledSince = 0;

    while (Date.now() < deadline) {
      if (window.location.href !== snapshot.url) return true;
      if (!snapshot.editor.isConnected) return true;
      if (snapshot.sendButton && !snapshot.sendButton.isConnected) return true;
      if (userMessageCount() > snapshot.userMessageCount) return true;

      const currentText = readEditorText(snapshot.editor).trim();
      if (snapshot.editorText.trim() && currentText !== snapshot.editorText.trim()) return true;

      if (snapshot.sendButton && !isEnabled(snapshot.sendButton)) {
        if (!disabledSince) disabledSince = Date.now();
        if (Date.now() - disabledSince >= 200) return true;
      } else {
        disabledSince = 0;
      }
      await delay(100);
    }

    return false;
  }

  async function performSubmissionAttempt(site, editor, attachmentCount, timeoutMs) {
    const sendButton = await waitForSendButton(site, timeoutMs);
    const snapshot = createSubmissionSnapshot(editor, sendButton);
    let method;

    if (sendButton) {
      sendButton.click();
      method = 'button';
    } else {
      const form = editor.closest('form');
      if (form?.requestSubmit) {
        form.requestSubmit();
        method = 'form';
      } else {
        submitWithEnter(editor);
        method = 'enter';
      }
    }

    return {
      confirmed: await waitForSubmissionEvidence(snapshot, attachmentCount ? 8000 : 6000),
      method,
    };
  }

  async function sendPrompt(site, editor, prompt, attachmentCount) {
    if (site.id === 'doubao') {
      const sendButton = await waitForSendButton(site, attachmentCount ? 60000 : 6000);
      if (!sendButton) throw new Error('Doubao did not expose an enabled send control.');

      const result = await requestPageMainWorld('doubao', 'page-submit', [], 70000, prompt);
      if (result.requiresUserAction) {
        return { method: 'manual-enter', requiresUserAction: true };
      }
      if (prompt.trim()) await waitForPromptToClear(editor, prompt, 8000);
      return result.method || 'main-world';
    }

    let liveEditor = editor;
    let lastAttemptError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        await delay(300);
        liveEditor = await waitForPromptEditor(site, 6000);
        if (prompt.trim() && readEditorText(liveEditor).trim() !== prompt.trim()) {
          await fillPrompt(liveEditor, prompt);
        }
      }

      try {
        const result = await performSubmissionAttempt(
          site,
          liveEditor,
          attachmentCount,
          attempt === 0 ? (attachmentCount ? 60000 : 6000) : 6000,
        );
        if (result.confirmed) return result.method;
      } catch (error) {
        lastAttemptError = error;
      }
    }

    if (lastAttemptError) throw lastAttemptError;
    throw new Error(`${site.name} did not confirm that the message was submitted.`);
  }

  async function submitPrompt(prompt, serializedAttachments = []) {
    const site = currentSite();
    if (!site) throw new Error('This page is not a supported AI chatbot.');
    const normalizedPrompt = typeof prompt === 'string' ? prompt : '';
    const attachments = Array.isArray(serializedAttachments) ? serializedAttachments : [];
    if (!normalizedPrompt.trim() && !attachments.length) {
      throw new Error('The message and attachment list are empty.');
    }

    let editor = await waitForPromptEditor(site);
    const attachmentCount = await attachFiles(site, attachments, editor);
    if (attachmentCount) {
      // Upload widgets on sites such as Grok can replace the composer node.
      // Always reacquire the live editor before inserting the prompt.
      editor = await waitForPromptEditor(site);
    }
    if (normalizedPrompt.trim()) {
      await fillPrompt(editor, normalizedPrompt);
    }
    await delay(150);
    const delivery = await sendPrompt(site, editor, normalizedPrompt, attachmentCount);
    const method = typeof delivery === 'string' ? delivery : delivery.method;
    const requiresUserAction = Boolean(delivery?.requiresUserAction);

    const outcome = requiresUserAction ? 'Prepared' : 'Submitted';
    console.log(`${LOG_PREFIX} ${outcome} a message for ${site.name} using ${method}.`);
    return { ok: true, siteId: site.id, method, attachmentCount, requiresUserAction };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'ping') {
      const site = currentSite();
      sendResponse({ ok: Boolean(site), siteId: site?.id || null });
      return false;
    }

    if (message?.action === 'new-chat') {
      sendResponse({ ok: handleNewChat() });
      return false;
    }

    if (message?.action === 'submit-prompt') {
      submitPrompt(message.prompt, message.attachments)
        .then(sendResponse)
        .catch((error) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      return true;
    }

    return false;
  });

  document.addEventListener('keydown', handleNewChatShortcut, true);
  document.addEventListener('keydown', handleGeminiSearchShortcut, true);
})();
