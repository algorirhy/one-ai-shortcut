// Content script for supported AI assistant pages.
// Handles unified shortcuts and site-specific prompt entry/submission.

(() => {
  'use strict';

  const LOG_PREFIX = '[One Shortcut for AI Chat]';
  const IS_MAC = navigator.platform.toUpperCase().includes('MAC');

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
    const selectors = ['a', 'button', '[role="button"]'];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const text = (element.textContent || '').trim();
        if (texts.includes(text) && isVisible(element)) {
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

  function clickWithPointerSequence(button) {
    const rect = button.getBoundingClientRect();
    const eventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      buttons: 1,
      detail: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };

    button.focus();
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const EventConstructor = type.startsWith('pointer') && typeof PointerEvent === 'function'
        ? PointerEvent
        : MouseEvent;
      const isDown = type === 'pointerdown' || type === 'mousedown';
      button.dispatchEvent(new EventConstructor(type, {
        ...eventInit,
        buttons: isDown ? 1 : 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      }));
    }
  }

  async function waitForPromptToClear(editor, prompt, timeoutMs = 2500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!editor.isConnected || !readEditorText(editor).trim()) return true;
      await delay(100);
    }
    return readEditorText(editor).trim() !== prompt.trim();
  }

  async function sendPrompt(site, editor, prompt) {
    const sendButton = await waitForSendButton(site);
    if (sendButton) {
      if (site.id === 'doubao') {
        // Doubao ignores HTMLElement.click(), so dispatch the pointer/mouse
        // sequence used by its send-button handler.
        clickWithPointerSequence(sendButton);
        if (await waitForPromptToClear(editor, prompt)) return 'pointer-sequence';

        submitWithEnter(editor);
        if (await waitForPromptToClear(editor, prompt)) return 'enter-fallback';

        throw new Error('Doubao kept the prompt in the input after submission.');
      }

      sendButton.click();
      return 'button';
    }

    const form = editor.closest('form');
    if (form?.requestSubmit) {
      form.requestSubmit();
      return 'form';
    }

    submitWithEnter(editor);
    return 'enter';
  }

  async function submitPrompt(prompt) {
    const site = currentSite();
    if (!site) throw new Error('This page is not a supported AI assistant.');
    if (typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('The prompt is empty.');
    }

    const editor = await waitForPromptEditor(site);
    await fillPrompt(editor, prompt);
    await delay(150);
    const method = await sendPrompt(site, editor, prompt);

    console.log(`${LOG_PREFIX} Sent a prompt to ${site.name} using ${method}.`);
    return { ok: true, siteId: site.id, method };
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
      submitPrompt(message.prompt)
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
