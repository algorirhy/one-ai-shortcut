// Runs in Doubao's MAIN world so its React handlers can be invoked directly.

(() => {
  'use strict';

  const INSTALL_FLAG = '__oneAIShortcutDoubaoMainInstalled';
  const MESSAGE_SOURCE = 'one-ai-shortcut';

  if (window[INSTALL_FLAG]) return;
  Object.defineProperty(window, INSTALL_FLAG, { value: true });

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

  function findComposer() {
    const editor = [...document.querySelectorAll('textarea')].find((element) => (
      isVisible(element) &&
      (element.placeholder || '').includes('发消息')
    ));
    if (!editor) return null;

    let container = editor;
    for (let depth = 0; container && depth < 8; depth += 1) {
      const buttons = [...container.querySelectorAll('button')].filter(isVisible);
      const sendButton = buttons.find((button) => (
        button.className.includes('g-send-msg-btn') ||
        button.className.toLowerCase().includes('send-msg')
      ));
      if (sendButton) return { editor, sendButton };
      container = container.parentElement;
    }

    return { editor, sendButton: null };
  }

  function findReactHandler(element, handlerName) {
    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
      for (const key of Object.keys(current)) {
        if (!key.startsWith('__reactProps$') && !key.startsWith('__reactEventHandlers$')) {
          continue;
        }

        const handler = current[key]?.[handlerName];
        if (typeof handler === 'function') {
          return { element: current, handler };
        }
      }
      current = current.parentElement;
    }
    return null;
  }

  function createReactEvent(element, overrides = {}) {
    return {
      isTrusted: true,
      target: element,
      currentTarget: element,
      nativeEvent: { isTrusted: true },
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
      persist() {},
      ...overrides,
    };
  }

  function invokeReactSubmit(composer) {
    const clickHandler = findReactHandler(composer.sendButton, 'onClick');
    if (clickHandler) {
      clickHandler.handler(createReactEvent(clickHandler.element));
      return 'react-click';
    }

    const keyHandler = findReactHandler(composer.editor, 'onKeyDown');
    if (keyHandler) {
      keyHandler.handler(createReactEvent(keyHandler.element, {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        nativeEvent: {
          isTrusted: true,
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
        },
      }));
      return 'react-keydown';
    }

    return null;
  }

  window.addEventListener('message', (event) => {
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      event.data?.source !== MESSAGE_SOURCE ||
      event.data?.action !== 'doubao-submit'
    ) {
      return;
    }

    const composer = findComposer();
    if (!composer?.editor || !composer.sendButton) return;

    composer.sendButton.click();

    window.setTimeout(() => {
      if (!composer.editor.isConnected || !composer.editor.value.trim()) return;
      invokeReactSubmit(composer);
    }, 250);
  });
})();
