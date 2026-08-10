(() => {
  'use strict';

  const form = document.getElementById('prompt-form');
  const composerPanel = document.getElementById('composer-panel');
  const promptInput = document.getElementById('prompt-input');
  const attachmentButton = document.getElementById('attachment-button');
  const attachmentInput = document.getElementById('attachment-input');
  const attachmentList = document.getElementById('attachment-list');
  const attachmentLimit = document.getElementById('attachment-limit');
  const siteList = document.getElementById('site-list');
  const selectionCount = document.getElementById('selection-count');
  const toggleAllButton = document.getElementById('toggle-all');
  const sendButton = document.getElementById('send-button');
  const sendButtonText = document.getElementById('send-button-text');
  const status = document.getElementById('status');
  const shortcutLink = document.getElementById('shortcut-link');
  const githubLink = document.getElementById('github-link');
  const limits = OneAIShortcut.attachmentLimits;

  let busy = false;
  let nextAttachmentId = 1;
  const attachments = [];

  function siteCheckboxes() {
    return [...siteList.querySelectorAll('input[type="checkbox"]')];
  }

  function selectedSiteIds() {
    return siteCheckboxes()
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
  }

  function chatbotLabel(count) {
    return `${count} chatbot${count === 1 ? '' : 's'}`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    const megabytes = bytes / (1024 * 1024);
    return `${megabytes.toFixed(Number.isInteger(megabytes) ? 0 : 1)} MB`;
  }

  function setStatus(message = '', type = '') {
    status.textContent = message;
    status.className = message ? `visible ${type}` : '';
  }

  function totalAttachmentSize() {
    return attachments.reduce((total, attachment) => total + attachment.file.size, 0);
  }

  function updateControls() {
    const checkboxes = siteCheckboxes();
    const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
    const hasContent = Boolean(promptInput.value.trim()) || attachments.length > 0;
    const attachmentSize = totalAttachmentSize();

    selectionCount.textContent = `${selectedCount} selected`;
    toggleAllButton.textContent = selectedCount === checkboxes.length
      ? 'Deselect all'
      : 'Select all';
    attachmentLimit.textContent = attachments.length
      ? `${attachments.length}/${limits.maxFiles} files · ${formatBytes(attachmentSize)}/${formatBytes(limits.maxTotalSizeBytes)}`
      : `Up to ${limits.maxFiles} files · ${formatBytes(limits.maxFileSizeBytes)} each · ${formatBytes(limits.maxTotalSizeBytes)} total`;
    sendButtonText.textContent = busy
      ? (attachments.length ? 'Preparing files and sending...' : 'Sending...')
      : `Send to ${chatbotLabel(selectedCount)}`;

    sendButton.disabled = busy || !hasContent || selectedCount === 0;
    attachmentButton.disabled = busy || attachments.length >= limits.maxFiles;
    toggleAllButton.disabled = busy;
    promptInput.disabled = busy;
    attachmentInput.disabled = busy;

    for (const checkbox of checkboxes) checkbox.disabled = busy;
    for (const button of attachmentList.querySelectorAll('.remove-attachment')) {
      button.disabled = busy;
    }
  }

  function renderSites() {
    const fragment = document.createDocumentFragment();

    for (const site of OneAIShortcut.sites) {
      const label = document.createElement('label');
      label.className = 'site-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'site';
      checkbox.value = site.id;
      checkbox.checked = true;
      checkbox.setAttribute('aria-label', `${site.name} ${site.displayUrl}`);
      checkbox.addEventListener('change', () => {
        setStatus();
        updateControls();
      });

      const dot = document.createElement('span');
      dot.className = 'site-dot';
      dot.style.backgroundColor = site.color;

      const name = document.createElement('span');
      name.className = 'site-name';
      name.textContent = site.name;

      const url = document.createElement('span');
      url.className = 'site-url';
      url.textContent = site.displayUrl;

      label.append(checkbox, dot, name, url);
      fragment.append(label);
    }

    siteList.replaceChildren(fragment);
  }

  function attachmentTypeLabel(file) {
    if (file.type.startsWith('image/')) return 'IMG';
    const parts = file.name.split('.');
    if (parts.length > 1) return parts.at(-1).slice(0, 4).toUpperCase();
    return 'FILE';
  }

  function removeAttachment(id) {
    const index = attachments.findIndex((attachment) => attachment.id === id);
    if (index < 0) return;
    const [removed] = attachments.splice(index, 1);
    if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    setStatus();
    renderAttachments();
  }

  function renderAttachments() {
    const fragment = document.createDocumentFragment();

    for (const attachment of attachments) {
      const item = document.createElement('div');
      item.className = 'attachment-item';

      const preview = document.createElement('span');
      preview.className = 'attachment-preview';
      if (attachment.previewUrl) {
        const image = document.createElement('img');
        image.src = attachment.previewUrl;
        image.alt = '';
        preview.append(image);
      } else {
        preview.textContent = attachmentTypeLabel(attachment.file);
      }

      const details = document.createElement('span');
      details.className = 'attachment-details';
      const name = document.createElement('span');
      name.className = 'attachment-name';
      name.textContent = attachment.file.name;
      name.title = attachment.file.name;
      const size = document.createElement('span');
      size.className = 'attachment-size';
      size.textContent = formatBytes(attachment.file.size);
      details.append(name, size);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-attachment';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${attachment.file.name}`);
      remove.addEventListener('click', () => removeAttachment(attachment.id));

      item.append(preview, details, remove);
      fragment.append(item);
    }

    attachmentList.replaceChildren(fragment);
    attachmentList.classList.toggle('visible', attachments.length > 0);
    updateControls();
  }

  function validateNewFiles(files) {
    if (attachments.length + files.length > limits.maxFiles) {
      return `You can attach up to ${limits.maxFiles} files.`;
    }

    for (const file of files) {
      if (file.size > limits.maxFileSizeBytes) {
        return `${file.name} is larger than ${formatBytes(limits.maxFileSizeBytes)}.`;
      }
    }

    const incomingSize = files.reduce((total, file) => total + file.size, 0);
    if (totalAttachmentSize() + incomingSize > limits.maxTotalSizeBytes) {
      return `Attachments can total up to ${formatBytes(limits.maxTotalSizeBytes)}.`;
    }
    return '';
  }

  function addFiles(fileList) {
    const incomingFiles = [...fileList];
    const files = incomingFiles.filter((file) => (
      !attachments.some((attachment) => (
        attachment.file.name === file.name &&
        attachment.file.size === file.size &&
        attachment.file.lastModified === file.lastModified
      ))
    ));
    if (!files.length) {
      if (incomingFiles.length) setStatus('Those files are already attached.', 'info');
      return;
    }

    const validationError = validateNewFiles(files);
    if (validationError) {
      setStatus(validationError, 'error');
      return;
    }

    for (const file of files) {
      attachments.push({
        id: nextAttachmentId++,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      });
    }

    setStatus();
    renderAttachments();
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), { once: true });
      reader.addEventListener('error', () => reject(new Error(`Could not read ${file.name}.`)), { once: true });
      reader.readAsDataURL(file);
    });
  }

  async function serializeAttachments() {
    return Promise.all(attachments.map(async ({ file }) => ({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: file.lastModified,
      dataUrl: await fileToDataUrl(file),
    })));
  }

  async function preferredWindowId() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return Number.isInteger(activeTab?.windowId) ? activeTab.windowId : undefined;
  }

  async function sendMessage() {
    if (busy) return;

    const prompt = promptInput.value;
    const siteIds = selectedSiteIds();
    if ((!prompt.trim() && !attachments.length) || !siteIds.length) return;

    busy = true;
    sendButton.classList.add('busy');
    setStatus(attachments.length ? `Preparing ${attachments.length} attachment${attachments.length === 1 ? '' : 's'}...` : 'Opening new chats...', 'info');
    updateControls();

    try {
      const serializedAttachments = await serializeAttachments();
      setStatus(`Opening new chats and sending to ${chatbotLabel(siteIds.length)}...`, 'info');

      const acknowledgement = await chrome.runtime.sendMessage({
        action: 'broadcast-prompt',
        prompt,
        attachments: serializedAttachments,
        siteIds,
        preferredWindowId: await preferredWindowId(),
      });
      if (!acknowledgement?.accepted) {
        throw new Error('The background worker did not accept the delivery task.');
      }
      window.close();
      return;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      busy = false;
      sendButton.classList.remove('busy');
      updateControls();
    }
  }

  renderSites();
  renderAttachments();

  promptInput.addEventListener('input', () => {
    setStatus();
    updateControls();
  });

  promptInput.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  attachmentButton.addEventListener('click', () => attachmentInput.click());
  attachmentInput.addEventListener('change', () => {
    addFiles(attachmentInput.files);
    attachmentInput.value = '';
  });

  for (const eventName of ['dragenter', 'dragover']) {
    composerPanel.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (!busy) composerPanel.classList.add('dragover');
    });
  }
  composerPanel.addEventListener('dragleave', (event) => {
    if (!composerPanel.contains(event.relatedTarget)) composerPanel.classList.remove('dragover');
  });
  composerPanel.addEventListener('drop', (event) => {
    event.preventDefault();
    composerPanel.classList.remove('dragover');
    if (!busy && event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
  });

  toggleAllButton.addEventListener('click', () => {
    const checkboxes = siteCheckboxes();
    const shouldSelect = !checkboxes.every((checkbox) => checkbox.checked);
    for (const checkbox of checkboxes) checkbox.checked = shouldSelect;
    setStatus();
    updateControls();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendMessage();
  });

  shortcutLink.addEventListener('click', (event) => {
    event.preventDefault();
    void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  githubLink.addEventListener('click', (event) => {
    event.preventDefault();
    void chrome.tabs.create({ url: githubLink.href });
  });

  window.addEventListener('unload', () => {
    for (const attachment of attachments) {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    }
  });
})();
