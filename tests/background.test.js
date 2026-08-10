const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const sitesSource = fs.readFileSync(path.join(projectRoot, 'sites.js'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(projectRoot, 'background.js'), 'utf8');

function siteIdFromUrl(url) {
  const hostname = new URL(url).hostname;
  if (hostname === 'chatgpt.com') return 'chatgpt';
  if (hostname === 'claude.ai') return 'claude';
  if (hostname === 'gemini.google.com') return 'gemini';
  if (hostname === 'grok.com') return 'grok';
  if (hostname.endsWith('deepseek.com')) return 'deepseek';
  if (hostname.endsWith('doubao.com')) return 'doubao';
  return null;
}

function matchesPattern(url, pattern) {
  return url.startsWith(pattern.replace('*', ''));
}

function createHarness(initialTabs, { failSubmitFor = [] } = {}) {
  const tabs = initialTabs.map((tab) => ({ status: 'complete', ...tab }));
  const records = { created: [], updated: [], submitted: [], notifications: [] };
  let runtimeMessageListener;
  let nextTabId = 100;

  const chrome = {
    runtime: {
      onMessage: {
        addListener(listener) {
          runtimeMessageListener = listener;
        },
      },
    },
    commands: {
      onCommand: { addListener() {} },
    },
    notifications: {
      async create(options) {
        records.notifications.push(options);
        return 'notification-id';
      },
    },
    tabs: {
      async query(queryInfo) {
        if (!queryInfo.url) return [];
        const patterns = Array.isArray(queryInfo.url) ? queryInfo.url : [queryInfo.url];
        return tabs.filter((tab) => patterns.some((pattern) => matchesPattern(tab.url, pattern)));
      },
      async update(tabId, updateInfo) {
        const tab = tabs.find((candidate) => candidate.id === tabId);
        Object.assign(tab, updateInfo, { status: 'complete' });
        records.updated.push({ tabId, ...updateInfo });
        return { ...tab };
      },
      async create(createInfo) {
        const tab = {
          id: nextTabId++,
          windowId: createInfo.windowId ?? 1,
          index: tabs.filter((candidate) => candidate.windowId === createInfo.windowId).length,
          status: 'complete',
          url: createInfo.url,
        };
        tabs.push(tab);
        records.created.push({ ...createInfo, id: tab.id });
        return { ...tab };
      },
      async get(tabId) {
        return { ...tabs.find((candidate) => candidate.id === tabId) };
      },
      async sendMessage(tabId, message) {
        const tab = tabs.find((candidate) => candidate.id === tabId);
        if (message.action === 'ping') {
          return { ok: true, siteId: siteIdFromUrl(tab.url) };
        }
        if (message.action === 'submit-prompt') {
          if (failSubmitFor.includes(siteIdFromUrl(tab.url))) {
            throw new Error('Simulated site failure');
          }
          records.submitted.push({ tabId, prompt: message.prompt });
          return { ok: true, method: 'button' };
        }
        return { ok: true };
      },
    },
  };

  const context = vm.createContext({
    URL,
    chrome,
    console: { error() {}, log() {}, warn() {} },
    setTimeout,
    clearTimeout,
  });
  context.globalThis = context;
  context.importScripts = () => {
    vm.runInContext(sitesSource, context, { filename: 'sites.js' });
  };
  vm.runInContext(backgroundSource, context, { filename: 'background.js' });

  async function broadcast(message) {
    return new Promise((resolve) => {
      const keepChannelOpen = runtimeMessageListener(
        { action: 'broadcast-prompt', ...message },
        {},
        resolve,
      );
      assert.equal(keepChannelOpen, true);
    });
  }

  return { broadcast, records };
}

test('broadcast reuses the first matching tab in the preferred window', async () => {
  const harness = createHarness([
    { id: 10, windowId: 2, index: 0, url: 'https://chatgpt.com/c/other-window' },
    { id: 11, windowId: 1, index: 5, url: 'https://chatgpt.com/c/later' },
    { id: 12, windowId: 1, index: 2, url: 'https://chatgpt.com/c/first' },
  ]);

  const response = await harness.broadcast({
    prompt: 'hello',
    siteIds: ['chatgpt'],
    preferredWindowId: 1,
  });

  assert.equal(response.ok, true);
  assert.deepEqual(harness.records.updated, [
    { tabId: 12, url: 'https://chatgpt.com/' },
  ]);
  assert.deepEqual(harness.records.submitted, [
    { tabId: 12, prompt: 'hello' },
  ]);
});

test('broadcast creates an inactive tab when no matching tab exists', async () => {
  const harness = createHarness([]);
  const response = await harness.broadcast({
    prompt: 'compare this',
    siteIds: ['claude'],
    preferredWindowId: 3,
  });

  assert.equal(response.successCount, 1);
  assert.deepEqual(harness.records.created, [
    {
      url: 'https://claude.ai/new',
      active: false,
      windowId: 3,
      id: 100,
    },
  ]);
  assert.deepEqual(harness.records.submitted, [
    { tabId: 100, prompt: 'compare this' },
  ]);
});

test('broadcast rejects empty prompts without touching tabs', async () => {
  const harness = createHarness([]);
  const response = await harness.broadcast({
    prompt: '   ',
    siteIds: ['chatgpt'],
    preferredWindowId: 1,
  });

  assert.equal(response.ok, false);
  assert.match(response.error, /Enter a message/);
  assert.equal(harness.records.created.length, 0);
  assert.equal(harness.records.updated.length, 0);
});

test('one site failure does not stop delivery to other selected sites', async () => {
  const harness = createHarness([], { failSubmitFor: ['claude'] });
  const response = await harness.broadcast({
    prompt: 'independent delivery',
    siteIds: ['chatgpt', 'claude'],
    preferredWindowId: 1,
  });

  assert.equal(response.ok, false);
  assert.equal(response.successCount, 1);
  assert.equal(response.failureCount, 1);
  assert.deepEqual(
    Array.from(response.results, (result) => [result.siteId, result.ok]),
    [['chatgpt', true], ['claude', false]],
  );
  assert.equal(harness.records.notifications.length, 1);
  assert.equal(harness.records.notifications[0].title, 'Some prompts were not sent');
  assert.match(harness.records.notifications[0].message, /Failed: Claude/);
});
