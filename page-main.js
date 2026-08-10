// Runs in the page's MAIN world when a framework ignores isolated-world file events.

(() => {
  'use strict';

  const INSTALL_FLAG = '__oneAIShortcutPageMainInstalled';
  const REQUEST_SOURCE = 'one-ai-shortcut';
  const RESPONSE_SOURCE = 'one-ai-shortcut-page';
  let pendingDoubaoUpload = null;

  if (window[INSTALL_FLAG]) return;
  Object.defineProperty(window, INSTALL_FLAG, { value: true });

  function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function currentSiteId() {
    if (location.hostname.endsWith('doubao.com')) return 'doubao';
    if (location.hostname === 'gemini.google.com') return 'gemini';
    return null;
  }

  function isVisible(element) {
    if (!element?.isConnected) return false;
    const style = getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.getClientRects().length > 0
    );
  }

  function isEnabled(element) {
    return Boolean(
      isVisible(element) &&
      !element.matches(':disabled') &&
      element.getAttribute('aria-disabled') !== 'true' &&
      element.getAttribute('data-disabled') !== 'true'
    );
  }

  function findReactHandler(element, handlerName) {
    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
      for (const key of Object.keys(current)) {
        if (!key.startsWith('__reactProps$') && !key.startsWith('__reactEventHandlers$')) {
          continue;
        }

        const handler = current[key]?.[handlerName];
        if (typeof handler === 'function') return { element: current, handler };
      }
      current = current.parentElement;
    }
    return null;
  }

  function normalizeFrameworkHandler(candidate) {
    const value = candidate?.value ?? candidate;
    if (typeof value === 'function') return value;
    if (Array.isArray(value) && value.some((handler) => typeof handler === 'function')) {
      return (event) => {
        for (const handler of value) {
          if (typeof handler === 'function') handler(event);
        }
      };
    }
    return null;
  }

  function findFrameworkHandler(element, handlerName, eventName) {
    const reactHandler = findReactHandler(element, handlerName);
    if (reactHandler) return reactHandler;

    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
      const vueListeners = current._vei;
      const vueHandler = normalizeFrameworkHandler(
        vueListeners?.[handlerName] || vueListeners?.[eventName] || vueListeners?.[`on${eventName}`],
      );
      if (vueHandler) return { element: current, handler: vueHandler };

      for (const key of [`$$${eventName}`, `__${eventName}`, `_${eventName}`]) {
        const handler = normalizeFrameworkHandler(current[key]);
        if (handler) return { element: current, handler };
      }
      current = current.parentElement;
    }
    return null;
  }

  function createFrameworkEvent(element, overrides = {}) {
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

  function attachmentFileName(name) {
    const normalized = typeof name === 'string' ? name.trim() : '';
    return (normalized || 'attachment').replace(/[\\/\0]/g, '_');
  }

  function decodeAttachment(attachment) {
    const match = attachment?.dataUrl?.match(/^data:([^;,]*)(?:;[^,]*)?;base64,(.*)$/s);
    if (!match) throw new Error(`Could not decode ${attachmentFileName(attachment?.name)}.`);

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

  function findFileInput(siteId, files) {
    const inputs = [...document.querySelectorAll('input[type="file"]')]
      .filter((input) => (
        !input.disabled && files.every((file) => inputAcceptsFile(input, file))
      ));

    return inputs.sort((left, right) => (
      Number(siteId === 'gemini' && right.classList.contains('hidden-file-input')) -
        Number(siteId === 'gemini' && left.classList.contains('hidden-file-input')) ||
      Number(siteId === 'doubao' && right.classList.contains('hidden')) -
        Number(siteId === 'doubao' && left.classList.contains('hidden')) ||
      Number(right.multiple) - Number(left.multiple) ||
      Number(!right.accept) - Number(!left.accept)
    ))[0] || null;
  }

  async function prepareGeminiInput(files) {
    const startedAt = Date.now();
    const deadline = startedAt + 20000;
    const imagesOnly = files.every((file) => file.type.startsWith('image/'));
    let lastTriggerClick = 0;

    while (Date.now() < deadline) {
      const compatibleInput = findFileInput('gemini', files);
      if (compatibleInput) return compatibleInput;

      const uploadMenuButton = document.querySelector('button[aria-label="Upload & tools"]');
      if (isEnabled(uploadMenuButton) && uploadMenuButton.getAttribute('aria-expanded') !== 'true') {
        uploadMenuButton.click();
      }

      if (Date.now() - lastTriggerClick > 500) {
        const trigger = document.querySelector(imagesOnly
          ? 'button[data-test-id="hidden-local-image-upload-button"], button.hidden-local-file-image-selector-button'
          : 'button[data-test-id="hidden-local-file-upload-button"], button.hidden-local-file-upload-button');
        trigger?.click();
        lastTriggerClick = Date.now();
      }

      // Gemini's current Angular uploader exposes one shared file input whose
      // `accept` list can lag behind the formats handled by its image trigger.
      // The page still performs its own validation after the change event.
      if (Date.now() - startedAt > 1500) {
        const sharedInput = [...document.querySelectorAll('input[type="file"]')].find((candidate) => (
          !candidate.disabled && candidate.multiple
        ));
        if (sharedInput) return sharedInput;
      }

      await delay(150);
    }
    return null;
  }

  async function waitForDoubaoInput(files, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const input = findFileInput('doubao', files);
      if (input) return input;
      await delay(150);
    }
    return null;
  }

  async function setFiles(siteId, attachments) {
    const files = attachments.map(decodeAttachment);
    const input = siteId === 'gemini'
      ? await prepareGeminiInput(files)
      : await waitForDoubaoInput(files);
    if (!input) throw new Error(`${siteId} file input is not available.`);

    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
    if (setter) setter.call(input, transfer.files);
    else input.files = transfer.files;

    const frameworkChange = siteId === 'doubao'
      ? findFrameworkHandler(input, 'onChange', 'change')
      : null;
    if (frameworkChange) {
      frameworkChange.handler(createFrameworkEvent(frameworkChange.element, {
        type: 'change',
        target: input,
        currentTarget: frameworkChange.element,
        nativeEvent: { isTrusted: true, target: input, type: 'change' },
      }));
    } else {
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }

    if (input.files.length !== files.length) {
      throw new Error(`${siteId} did not retain the selected files.`);
    }

    if (siteId === 'doubao') {
      pendingDoubaoUpload = {
        names: files.map((file) => file.name),
        startedAt: Date.now(),
        input,
      };
    }
  }

  function findDoubaoComposer() {
    const editor = [...document.querySelectorAll('textarea')].find((element) => (
      isVisible(element) && (element.placeholder || '').includes('发消息')
    ));
    if (!editor) return null;

    const currentSendButton = document.querySelector('#flow-end-msg-send');
    if (isEnabled(currentSendButton)) {
      return { editor, sendButton: currentSendButton };
    }

    let container = editor;
    for (let depth = 0; container && depth < 10; depth += 1) {
      const sendButton = [...container.querySelectorAll('button')].find((button) => (
        isEnabled(button) && (
          button.className.includes('g-send-msg-btn') ||
          button.querySelector('svg.text-g-send-msg-btn-text, svg[class*="g-send-msg-btn"]')
        )
      ));
      if (sendButton) return { editor, sendButton };
      container = container.parentElement;
    }

    const sendButton = [...document.querySelectorAll('button')].find((button) => (
      isEnabled(button) &&
      button.querySelector('svg.text-g-send-msg-btn-text, svg[class*="g-send-msg-btn"]')
    ));
    return { editor, sendButton: sendButton || null };
  }

  function doubaoComposerRoot(editor) {
    return editor.closest('#input-engine-container') || editor.parentElement;
  }

  function doubaoUploadIsBusy(root) {
    if (!root) return false;

    const explicitBusy = root.querySelector(
      '[aria-busy="true"], [role="progressbar"], [data-loading="true"], '
        + '[data-uploading="true"], [data-state="uploading"]',
    );
    if (explicitBusy && isVisible(explicitBusy)) return true;

    return [...root.querySelectorAll('[class]')].some((element) => (
      isVisible(element) && /(^|\s|[-_])(uploading|loading|progress|spinner|spinning)(\s|[-_]|$)/i
        .test(String(element.className || ''))
    ));
  }

  function doubaoUploadEvidence(root, upload) {
    if (!upload?.names?.length) return true;
    if (!root) return false;

    // Retaining File objects only proves that the input accepted them. Doubao can
    // still be rendering or uploading the preview, during which a send click is
    // frequently ignored. Prefer visible, fully decoded previews or file names.
    if (upload.input?.files?.length < upload.names.length) return false;

    const blobImages = [...root.querySelectorAll('img[src^="blob:"]')];
    if (blobImages.length >= upload.names.length && blobImages.every((image) => (
      image.complete && image.naturalWidth > 0
    ))) {
      return true;
    }

    const searchable = [root.textContent || ''];
    for (const element of root.querySelectorAll(
      '[title], [aria-label], [data-file-name], [data-filename], img[alt]',
    )) {
      searchable.push(
        element.getAttribute('title') || '',
        element.getAttribute('aria-label') || '',
        element.getAttribute('data-file-name') || '',
        element.getAttribute('data-filename') || '',
        element.getAttribute('alt') || '',
      );
    }
    const haystack = searchable.join('\n').toLocaleLowerCase();
    if (upload.names.every((name) => haystack.includes(name.toLocaleLowerCase()))) return true;

    const previewCount = root.querySelectorAll(
      '[class*="image-container" i], [data-file-name], [data-filename]',
    ).length;
    return previewCount >= upload.names.length;
  }

  function doubaoReadyFingerprint(composer, upload) {
    const root = doubaoComposerRoot(composer.editor);
    return JSON.stringify({
      busy: doubaoUploadIsBusy(root),
      evidence: doubaoUploadEvidence(root, upload),
      fileNodes: root?.querySelectorAll(
        'img, [data-file-name], [data-filename], [class*="attachment" i], [class*="upload" i]',
      ).length || 0,
      prompt: composer.editor.value,
      sendButton: composer.sendButton?.id || composer.sendButton?.className || '',
    });
  }

  async function waitForDoubaoReady(timeoutMs = 30000) {
    const upload = pendingDoubaoUpload;
    const deadline = Date.now() + timeoutMs;
    const minimumReadyAt = upload ? upload.startedAt + 2500 : Date.now();
    const stableDuration = upload ? 1500 : 350;
    let lastFingerprint = '';
    let stableSince = 0;

    while (Date.now() < deadline) {
      const composer = findDoubaoComposer();
      if (composer?.editor && composer.sendButton) {
        const root = doubaoComposerRoot(composer.editor);
        const busy = doubaoUploadIsBusy(root);
        const hasEvidence = doubaoUploadEvidence(root, upload);
        const enoughTimePassed = Date.now() >= minimumReadyAt;
        const canUseTimeFallback = upload && Date.now() >= upload.startedAt + 8000;
        const fingerprint = doubaoReadyFingerprint(composer, upload);

        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint;
          stableSince = Date.now();
        }

        if (
          !busy &&
          enoughTimePassed &&
          (hasEvidence || canUseTimeFallback) &&
          Date.now() - stableSince >= stableDuration
        ) {
          return composer;
        }
      }
      await delay(150);
    }

    throw new Error('Doubao attachments did not become ready in time.');
  }

  async function waitForStableDoubaoComposer(timeoutMs = 5000, stableDuration = 600) {
    const deadline = Date.now() + timeoutMs;
    let stableEditor = null;
    let stableButton = null;
    let stableValue = '';
    let stableSince = 0;

    while (Date.now() < deadline) {
      const composer = findDoubaoComposer();
      const root = composer?.editor ? doubaoComposerRoot(composer.editor) : null;
      const usable = Boolean(
        composer?.editor &&
        isEnabled(composer.sendButton) &&
        !doubaoUploadIsBusy(root)
      );
      const value = composer?.editor?.value || '';

      if (
        usable &&
        composer.editor === stableEditor &&
        composer.sendButton === stableButton &&
        value === stableValue
      ) {
        if (Date.now() - stableSince >= stableDuration) return composer;
      } else {
        stableEditor = usable ? composer.editor : null;
        stableButton = usable ? composer.sendButton : null;
        stableValue = usable ? value : '';
        stableSince = Date.now();
      }
      await delay(100);
    }

    return null;
  }

  async function prepareStableDoubaoComposer(prompt, timeoutMs = 5000, stableDuration = 600) {
    let composer = await waitForStableDoubaoComposer(timeoutMs, stableDuration);
    if (!composer) return null;

    if (prompt.trim() && composer.editor.value !== prompt) {
      setDoubaoPrompt(composer.editor, prompt);
      composer = await waitForStableDoubaoComposer(timeoutMs, stableDuration);
    }
    return composer;
  }

  function invokeFrameworkSubmit(composer) {
    let invoked = false;
    const clickHandler = composer.sendButton
      ? findFrameworkHandler(composer.sendButton, 'onClick', 'click')
      : null;
    if (clickHandler) {
      try {
        clickHandler.handler(createFrameworkEvent(clickHandler.element));
        invoked = true;
      } catch (_error) {
        // Continue to the keyboard path when Doubao changes handler internals.
      }
    }

    const keyHandler = findFrameworkHandler(composer.editor, 'onKeyDown', 'keydown');
    if (keyHandler) {
      try {
        keyHandler.handler(createFrameworkEvent(keyHandler.element, {
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
        invoked = true;
      } catch (_error) {
        // Synthetic DOM events and the manual fallback remain available.
      }
    }
    return invoked;
  }

  function dispatchDoubaoPointerSequence(button) {
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const common = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      button: 0,
      buttons: 1,
      view: window,
    };

    button.focus({ preventScroll: true });
    if (typeof PointerEvent === 'function') {
      for (const type of ['pointerover', 'pointerenter', 'pointermove', 'pointerdown']) {
        button.dispatchEvent(new PointerEvent(type, {
          ...common,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        }));
      }
    }
    for (const type of ['mouseover', 'mouseenter', 'mousemove', 'mousedown']) {
      button.dispatchEvent(new MouseEvent(type, common));
    }

    const released = { ...common, buttons: 0 };
    if (typeof PointerEvent === 'function') {
      button.dispatchEvent(new PointerEvent('pointerup', {
        ...released,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      }));
    }
    button.dispatchEvent(new MouseEvent('mouseup', released));
    button.dispatchEvent(new MouseEvent('click', released));
  }

  function dispatchDoubaoEnter(editor) {
    const init = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true,
    };
    editor.focus();
    editor.dispatchEvent(new KeyboardEvent('keydown', init));
    editor.dispatchEvent(new KeyboardEvent('keypress', init));
    editor.dispatchEvent(new KeyboardEvent('keyup', init));
  }

  function doubaoAttachmentCount(editor) {
    const root = doubaoComposerRoot(editor);
    if (!root) return 0;
    return root.querySelectorAll(
      'img[src^="blob:"], [data-file-name], [data-filename], [class*="image-container" i]',
    ).length;
  }

  function createDoubaoSubmissionSnapshot(composer) {
    return {
      editor: composer.editor,
      sendButton: composer.sendButton,
      initialUrl: location.href,
      initialValue: composer.editor.value.trim(),
      attachmentCount: doubaoAttachmentCount(composer.editor),
    };
  }

  async function waitForDoubaoSubmission(snapshot, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let disabledSince = 0;
    let missingSince = 0;
    while (Date.now() < deadline) {
      if (location.href !== snapshot.initialUrl) return true;

      const liveComposer = findDoubaoComposer();
      const liveEditor = liveComposer?.editor;
      const liveValue = liveEditor?.value?.trim() || '';
      const liveAttachmentCount = liveEditor ? doubaoAttachmentCount(liveEditor) : 0;

      if (snapshot.initialValue && liveValue !== snapshot.initialValue) return true;
      if (snapshot.attachmentCount && liveAttachmentCount < snapshot.attachmentCount) return true;

      // A replaced composer is only evidence when its state also changed. Upload
      // completion itself can replace the nodes without submitting the message.
      if (!snapshot.editor.isConnected || !snapshot.sendButton?.isConnected) {
        if (liveEditor && liveValue !== snapshot.initialValue) return true;
        if (!liveEditor) {
          if (!missingSince) missingSince = Date.now();
          if (Date.now() - missingSince >= 500) return true;
        } else {
          missingSince = 0;
        }
      } else {
        missingSince = 0;
      }

      const liveButton = liveComposer?.sendButton;
      if (liveButton && !isEnabled(liveButton)) {
        if (!disabledSince) disabledSince = Date.now();
        if (Date.now() - disabledSince >= 250) return true;
      } else {
        disabledSince = 0;
      }
      await delay(100);
    }
    return false;
  }

  function requestDoubaoFormSubmit(composer) {
    const form = composer.editor.closest('form') || composer.sendButton?.form || null;
    if (!form?.requestSubmit) return false;

    try {
      if (composer.sendButton?.form === form && composer.sendButton.matches(
        'button[type="submit"], input[type="submit"], input[type="image"]',
      )) {
        form.requestSubmit(composer.sendButton);
      } else {
        form.requestSubmit();
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  function setDoubaoPrompt(editor, prompt) {
    if (!prompt.trim()) return;

    editor.focus();
    editor.select();
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, prompt);
    } catch (_error) {
      inserted = false;
    }

    if (!inserted || editor.value !== prompt) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(editor, prompt);
      else editor.value = prompt;
    }

    const changeHandler = findFrameworkHandler(editor, 'onChange', 'change');
    if (changeHandler) {
      try {
        changeHandler.handler(createFrameworkEvent(changeHandler.element, {
          type: 'change',
          target: editor,
          currentTarget: changeHandler.element,
          nativeEvent: { isTrusted: true, target: editor, type: 'input' },
        }));
      } catch (_error) {
        // Native input/change events below keep the editor state in sync.
      }
    }
    editor.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: prompt,
      inputType: 'insertText',
    }));
    editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  async function submitDoubao(prompt = '') {
    let composer = findDoubaoComposer();
    if (!composer?.editor) throw new Error('Doubao message input is not available.');

    setDoubaoPrompt(composer.editor, prompt);
    composer = await waitForDoubaoReady();

    composer = await prepareStableDoubaoComposer(prompt) || composer;
    if (!composer?.editor?.isConnected || !isEnabled(composer.sendButton)) {
      throw new Error('Doubao message input disappeared before submission.');
    }
    const formSnapshot = createDoubaoSubmissionSnapshot(composer);
    if (requestDoubaoFormSubmit(composer)) {
      if (await waitForDoubaoSubmission(formSnapshot, 2500)) {
        pendingDoubaoUpload = null;
        return { submitted: true, method: 'form' };
      }
    }

    // Doubao's current composer is not a form. Clicking its own send control
    // invokes the page's delegated submit action without fabricating a key.
    const buttonSnapshot = createDoubaoSubmissionSnapshot(composer);
    try {
      composer.sendButton?.click();
    } catch (_error) {
      // Continue to the page handler and keyboard fallbacks.
    }
    if (await waitForDoubaoSubmission(buttonSnapshot, 3500)) {
      pendingDoubaoUpload = null;
      return { submitted: true, method: 'button' };
    }

    // Upload completion can replace the composer after the first click. Wait for
    // the latest controls to settle, then emit the pointer/mouse sequence that a
    // delegated Doubao click listener normally receives.
    composer = await prepareStableDoubaoComposer(prompt) || composer;
    const pointerSnapshot = createDoubaoSubmissionSnapshot(composer);
    dispatchDoubaoPointerSequence(composer.sendButton);
    if (await waitForDoubaoSubmission(pointerSnapshot, 3500)) {
      pendingDoubaoUpload = null;
      return { submitted: true, method: 'pointer' };
    }

    composer = await prepareStableDoubaoComposer(prompt) || composer;
    const frameworkSnapshot = createDoubaoSubmissionSnapshot(composer);
    invokeFrameworkSubmit(composer);
    dispatchDoubaoEnter(composer.editor);
    if (await waitForDoubaoSubmission(frameworkSnapshot, 4000)) {
      pendingDoubaoUpload = null;
      return { submitted: true, method: 'framework' };
    }

    // Final retry: reacquire the newest live controls and require them to remain
    // stable before clicking Doubao's own button once more.
    const retryComposer = await prepareStableDoubaoComposer(prompt, 6000, 800);
    if (retryComposer?.editor && retryComposer.sendButton) {
      const retrySnapshot = createDoubaoSubmissionSnapshot(retryComposer);
      try {
        retryComposer.sendButton.click();
      } catch (_error) {
        // Fall through to the explicit manual action below.
      }
      if (await waitForDoubaoSubmission(retrySnapshot, 3500)) {
        pendingDoubaoUpload = null;
        return { submitted: true, method: 'button-retry' };
      }
      retryComposer.editor.focus();
    } else {
      composer.editor.focus();
    }

    pendingDoubaoUpload = null;
    return {
      submitted: false,
      method: 'manual-enter',
      requiresUserAction: true,
    };
  }

  function postResult(action, requestId, ok, error = '', details = {}) {
    window.postMessage({
      source: RESPONSE_SOURCE,
      action,
      requestId,
      ok,
      error,
      ...details,
    }, window.location.origin);
  }

  window.addEventListener('message', async (event) => {
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      event.data?.source !== REQUEST_SOURCE ||
      !['page-submit', 'page-attach'].includes(event.data?.action)
    ) {
      return;
    }

    const siteId = currentSiteId();
    if (!siteId || event.data.siteId !== siteId) return;

    if (event.data.action === 'page-attach') {
      try {
        const attachments = Array.isArray(event.data.attachments) ? event.data.attachments : [];
        if (!attachments.length) throw new Error('No attachments were provided.');
        await setFiles(siteId, attachments);
        window.setTimeout(() => postResult('page-attach-result', event.data.requestId, true), 50);
      } catch (error) {
        postResult(
          'page-attach-result',
          event.data.requestId,
          false,
          error instanceof Error ? error.message : String(error),
        );
      }
      return;
    }

    if (siteId !== 'doubao') return;
    try {
      const result = await submitDoubao(
        typeof event.data.prompt === 'string' ? event.data.prompt : '',
      );
      postResult('page-submit-result', event.data.requestId, true, '', result);
    } catch (error) {
      pendingDoubaoUpload = null;
      postResult(
        'page-submit-result',
        event.data.requestId,
        false,
        error instanceof Error ? error.message : String(error),
      );
    }
  });
})();
