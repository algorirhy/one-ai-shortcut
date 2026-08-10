// Background service worker.
// Coordinates keyboard shortcuts and prompt delivery across supported AI sites.

importScripts('sites.js');

const LOG_PREFIX = '[One Shortcut for AI Chat]';
const siteLocks = new Map();

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sortTabs(tabs, preferredWindowId) {
  return [...tabs].sort((left, right) => {
    const leftPreferred = left.windowId === preferredWindowId ? 0 : 1;
    const rightPreferred = right.windowId === preferredWindowId ? 0 : 1;

    return (
      leftPreferred - rightPreferred ||
      (left.windowId ?? 0) - (right.windowId ?? 0) ||
      (left.index ?? 0) - (right.index ?? 0) ||
      (left.id ?? 0) - (right.id ?? 0)
    );
  });
}

async function findFirstSiteTab(site, preferredWindowId) {
  const tabs = await chrome.tabs.query({ url: site.tabPatterns });
  return sortTabs(
    tabs.filter((tab) => Number.isInteger(tab.id)),
    preferredWindowId,
  )[0] || null;
}

async function waitForTabComplete(tabId, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return tab;
    await delay(250);
  }

  throw new Error('Timed out while waiting for the page to load.');
}

async function waitForContentScript(tabId, siteId, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response?.ok && response.siteId === siteId) return;
    } catch (_error) {
      // The content script is not ready yet.
    }

    await delay(400);
  }

  throw new Error('The page loaded, but its automation script did not become ready.');
}

async function createSiteTab(site, preferredWindowId) {
  const createOptions = {
    url: OneAIShortcut.getNewChatUrl(site.id),
    active: false,
  };

  if (Number.isInteger(preferredWindowId)) {
    createOptions.windowId = preferredWindowId;
  }

  try {
    return await chrome.tabs.create(createOptions);
  } catch (error) {
    if (!('windowId' in createOptions)) throw error;
    delete createOptions.windowId;
    return chrome.tabs.create(createOptions);
  }
}

async function prepareNewChat(site, preferredWindowId) {
  const existingTab = await findFirstSiteTab(site, preferredWindowId);
  let tab;
  let reused;

  if (existingTab) {
    const newChatUrl = OneAIShortcut.getNewChatUrl(site.id, existingTab.url);
    tab = await chrome.tabs.update(existingTab.id, { url: newChatUrl });
    reused = true;
  } else {
    tab = await createSiteTab(site, preferredWindowId);
    reused = false;
  }

  if (!Number.isInteger(tab?.id)) {
    throw new Error('Chrome did not return a usable tab.');
  }

  await waitForTabComplete(tab.id);
  await waitForContentScript(tab.id, site.id);
  return { tabId: tab.id, reused };
}

async function deliverPrompt(site, prompt, preferredWindowId) {
  const { tabId, reused } = await prepareNewChat(site, preferredWindowId);
  const response = await chrome.tabs.sendMessage(tabId, {
    action: 'submit-prompt',
    prompt,
  });

  if (!response?.ok) {
    throw new Error(response?.error || 'The site did not confirm that the prompt was sent.');
  }

  return {
    siteId: site.id,
    name: site.name,
    ok: true,
    tabId,
    reused,
    method: response.method,
  };
}

function runWithSiteLock(siteId, task) {
  const previous = siteLocks.get(siteId) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  siteLocks.set(siteId, current);

  return current.finally(() => {
    if (siteLocks.get(siteId) === current) {
      siteLocks.delete(siteId);
    }
  });
}

async function notifyFailures(results) {
  const failures = results.filter((result) => !result.ok);
  if (!failures.length || !chrome.notifications?.create) return;

  const successCount = results.length - failures.length;
  const failedNames = failures.map((result) => result.name).join(', ');
  const message = successCount
    ? `Sent to ${successCount} of ${results.length}. Failed: ${failedNames}.`
    : `No prompts were sent. Failed: ${failedNames}.`;

  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Some prompts were not sent',
      message,
      priority: 1,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to show a notification:`, error);
  }
}

async function broadcastPrompt(message) {
  const prompt = typeof message.prompt === 'string' ? message.prompt : '';
  if (!prompt.trim()) {
    throw new Error('Enter a message before sending.');
  }

  const requestedIds = new Set(
    Array.isArray(message.siteIds) ? message.siteIds : [],
  );
  const selectedSites = OneAIShortcut.sites.filter((site) => requestedIds.has(site.id));

  if (!selectedSites.length) {
    throw new Error('Select at least one AI assistant.');
  }

  const results = await Promise.all(selectedSites.map((site) => (
    runWithSiteLock(site.id, async () => {
      try {
        return await deliverPrompt(site, prompt, message.preferredWindowId);
      } catch (error) {
        console.error(`${LOG_PREFIX} ${site.name}:`, error);
        return {
          siteId: site.id,
          name: site.name,
          ok: false,
          error: errorMessage(error),
        };
      }
    })
  )));

  await notifyFailures(results);

  return {
    ok: results.every((result) => result.ok),
    successCount: results.filter((result) => result.ok).length,
    failureCount: results.filter((result) => !result.ok).length,
    results,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action !== 'broadcast-prompt') return false;

  broadcastPrompt(message)
    .then(sendResponse)
    .catch((error) => sendResponse({
      ok: false,
      successCount: 0,
      failureCount: 0,
      results: [],
      error: errorMessage(error),
    }));

  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'new-chat') return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (Number.isInteger(tab?.id)) {
      await chrome.tabs.sendMessage(tab.id, { action: 'new-chat' });
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to start a new chat:`, error);
  }
});
