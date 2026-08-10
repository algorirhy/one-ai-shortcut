// Runs in Doubao's MAIN world so its page framework receives the send action
// in the same JavaScript world as its own event handlers.

(() => {
  'use strict';

  const INSTALL_FLAG = '__oneAIShortcutDoubaoMainInstalled';
  const SUBMIT_EVENT = 'one-ai-shortcut:doubao-submit';

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

  function dispatchPointerSequence(button) {
    const rect = button.getBoundingClientRect();
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
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
        ...base,
        buttons: isDown ? 1 : 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      }));
    }
  }

  function dispatchEnter(editor) {
    const eventInit = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      charCode: 13,
      bubbles: true,
      cancelable: true,
      composed: true,
    };

    editor.focus();
    editor.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    editor.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    editor.dispatchEvent(new KeyboardEvent('keyup', eventInit));
  }

  window.addEventListener(SUBMIT_EVENT, () => {
    const composer = findComposer();
    if (!composer?.editor || !composer.sendButton) return;

    composer.sendButton.click();

    window.setTimeout(() => {
      if (!composer.editor.value.trim()) return;
      dispatchPointerSequence(composer.sendButton);

      window.setTimeout(() => {
        if (!composer.editor.value.trim()) return;
        dispatchEnter(composer.editor);
      }, 800);
    }, 800);
  });
})();
