(() => {
  'use strict';

  const form = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const siteList = document.getElementById('site-list');
  const selectionCount = document.getElementById('selection-count');
  const toggleAllButton = document.getElementById('toggle-all');
  const sendButton = document.getElementById('send-button');
  const sendButtonText = document.getElementById('send-button-text');
  const status = document.getElementById('status');
  const shortcutLink = document.getElementById('shortcut-link');
  let busy = false;

  function siteCheckboxes() {
    return [...siteList.querySelectorAll('input[type="checkbox"]')];
  }

  function selectedSiteIds() {
    return siteCheckboxes()
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
  }

  function assistantLabel(count) {
    return `${count} assistant${count === 1 ? '' : 's'}`;
  }

  function setStatus(message = '', type = '') {
    status.textContent = message;
    status.className = message ? `visible ${type}` : '';
  }

  function updateControls() {
    const checkboxes = siteCheckboxes();
    const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
    const hasPrompt = Boolean(promptInput.value.trim());

    selectionCount.textContent = `${selectedCount} selected`;
    toggleAllButton.textContent = selectedCount === checkboxes.length
      ? 'Deselect all'
      : 'Select all';
    sendButtonText.textContent = busy
      ? 'Sending...'
      : `Send to ${assistantLabel(selectedCount)}`;
    sendButton.disabled = busy || !hasPrompt || selectedCount === 0;
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
      checkbox.addEventListener('change', updateControls);

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

  async function preferredWindowId() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return Number.isInteger(activeTab?.windowId) ? activeTab.windowId : undefined;
  }

  async function sendPrompt() {
    if (busy) return;

    const prompt = promptInput.value;
    const siteIds = selectedSiteIds();
    if (!prompt.trim() || !siteIds.length) return;

    busy = true;
    sendButton.classList.add('busy');
    setStatus(`Opening new chats and sending to ${assistantLabel(siteIds.length)}...`, 'warning');
    updateControls();

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'broadcast-prompt',
        prompt,
        siteIds,
        preferredWindowId: await preferredWindowId(),
      });

      if (response?.error && !response.results?.length) {
        throw new Error(response.error);
      }

      const failures = (response?.results || []).filter((result) => !result.ok);
      if (!failures.length) {
        setStatus(`Sent to ${assistantLabel(response.successCount)}.`, 'success');
        promptInput.value = '';
      } else {
        const names = failures.map((result) => result.name).join(', ');
        setStatus(
          `Sent to ${response.successCount}; failed on ${names}. Open those tabs to check login or page changes.`,
          response.successCount ? 'warning' : 'error',
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      busy = false;
      sendButton.classList.remove('busy');
      updateControls();
    }
  }

  renderSites();
  updateControls();

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

  toggleAllButton.addEventListener('click', () => {
    const checkboxes = siteCheckboxes();
    const shouldSelect = !checkboxes.every((checkbox) => checkbox.checked);
    for (const checkbox of checkboxes) checkbox.checked = shouldSelect;
    updateControls();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendPrompt();
  });

  shortcutLink.addEventListener('click', (event) => {
    event.preventDefault();
    void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
})();
