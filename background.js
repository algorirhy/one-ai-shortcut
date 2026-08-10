// Background service worker.
// Coordinates keyboard shortcuts and prompt delivery across supported AI sites.

importScripts('sites.js');

const LOG_PREFIX = '[One Shortcut for AI Chat]';
const siteLocks = new Map();
const broadcastJobs = new Map();
let nextBroadcastJobId = 1;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function notifyBroadcastError(error) {
  if (!chrome.notifications?.create) return;

  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Message was not sent',
      message: errorMessage(error),
      priority: 1,
    });
  } catch (notificationError) {
    console.error(`${LOG_PREFIX} Failed to show a notification:`, notificationError);
  }
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

async function deliverPrompt(site, prompt, attachments, preferredWindowId) {
  const { tabId, reused } = await prepareNewChat(site, preferredWindowId);
  const response = await chrome.tabs.sendMessage(tabId, {
    action: 'submit-prompt',
    prompt,
    attachments,
  });

  if (!response?.ok) {
    throw new Error(response?.error || 'The site did not confirm that the prompt was sent.');
  }

  if (response.requiresUserAction) {
    await chrome.tabs.update(tabId, { active: true });
    return {
      siteId: site.id,
      name: site.name,
      ok: false,
      requiresUserAction: true,
      tabId,
      reused,
      method: response.method,
      attachmentCount: response.attachmentCount || 0,
    };
  }

  return {
    siteId: site.id,
    name: site.name,
    ok: true,
    tabId,
    reused,
    method: response.method,
    attachmentCount: response.attachmentCount || 0,
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

async function notifyResults(results) {
  const manualSubmissions = results.filter((result) => result.requiresUserAction);
  const failures = results.filter((result) => !result.ok && !result.requiresUserAction);
  if (!manualSubmissions.length && !failures.length) return;
  if (!chrome.notifications?.create) return;

  const successCount = results.filter((result) => result.ok).length;
  let title;
  let message;

  if (manualSubmissions.length && !failures.length) {
    const names = manualSubmissions.map((result) => result.name).join(', ');
    title = `${names} ${manualSubmissions.length === 1 ? 'is' : 'are'} ready`;
    message = `The message and attachments are prepared in ${names}. Press Enter to send.`;
  } else {
    const failedNames = failures.map((result) => result.name).join(', ');
    title = 'Some messages were not sent';
    const manualNames = manualSubmissions.map((result) => result.name).join(', ');
    message = manualSubmissions.length
      ? `Sent to ${successCount}; press Enter in ${manualNames}. Failed: ${failedNames}.`
      : successCount
      ? `Sent to ${successCount} of ${results.length}. Failed: ${failedNames}.`
      : `No messages were sent. Failed: ${failedNames}.`;
  }

  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title,
      message,
      priority: 1,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to show a notification:`, error);
  }
}

async function broadcastPrompt(message) {
  const prompt = typeof message.prompt === 'string' ? message.prompt : '';
  const attachments = normalizeAttachments(message.attachments);
  if (!prompt.trim() && !attachments.length) {
    throw new Error('Enter a message or add an attachment before sending.');
  }

  const requestedIds = new Set(
    Array.isArray(message.siteIds) ? message.siteIds : [],
  );
  const selectedSites = OneAIShortcut.sites.filter((site) => requestedIds.has(site.id));

  if (!selectedSites.length) {
    throw new Error('Select at least one AI chatbot.');
  }

  const results = await Promise.all(selectedSites.map((site) => (
    runWithSiteLock(site.id, async () => {
      try {
        return await deliverPrompt(site, prompt, attachments, message.preferredWindowId);
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

  await notifyResults(results);

  return {
    ok: results.every((result) => result.ok),
    successCount: results.filter((result) => result.ok).length,
    failureCount: results.filter((result) => !result.ok).length,
    results,
  };
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  const limits = OneAIShortcut.attachmentLimits;

  if (value.length > limits.maxFiles) {
    throw new Error(`You can send up to ${limits.maxFiles} attachments at once.`);
  }

  let totalSize = 0;
  return value.map((attachment, index) => {
    const name = typeof attachment?.name === 'string' && attachment.name.trim()
      ? attachment.name.trim()
      : `attachment-${index + 1}`;
    const type = typeof attachment?.type === 'string'
      ? attachment.type
      : 'application/octet-stream';
    const size = Number(attachment?.size);
    const dataUrl = typeof attachment?.dataUrl === 'string' ? attachment.dataUrl : '';

    if (!Number.isFinite(size) || size < 0 || size > limits.maxFileSizeBytes) {
      throw new Error(`${name} exceeds the per-file size limit.`);
    }
    if (!/^data:[^,]*;base64,/i.test(dataUrl)) {
      throw new Error(`${name} does not contain valid attachment data.`);
    }

    totalSize += size;
    if (totalSize > limits.maxTotalSizeBytes) {
      throw new Error('The selected attachments exceed the total size limit.');
    }

    return {
      name,
      type,
      size,
      lastModified: Number.isFinite(attachment.lastModified)
        ? attachment.lastModified
        : Date.now(),
      dataUrl,
    };
  });
}

function startBroadcastJob(message) {
  const jobId = `broadcast-${Date.now()}-${nextBroadcastJobId++}`;
  const job = broadcastPrompt(message).catch(async (error) => {
    await notifyBroadcastError(error);
    return {
      ok: false,
      successCount: 0,
      failureCount: 0,
      results: [],
      error: errorMessage(error),
    };
  });

  broadcastJobs.set(jobId, job);
  void job.finally(() => {
    // Keep the completed promise through the current task so callers that
    // just received the acknowledgement can still observe it in tests/debugging.
    setTimeout(() => broadcastJobs.delete(jobId), 0);
  });
  return jobId;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action !== 'broadcast-prompt') return false;

  const jobId = startBroadcastJob(message);
  sendResponse({ accepted: true, jobId });
  return false;
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
