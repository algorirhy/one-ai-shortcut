const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function loadSiteCatalog() {
  const context = vm.createContext({ URL });
  context.globalThis = context;
  vm.runInContext(read('sites.js'), context, { filename: 'sites.js' });
  return context.OneAIShortcut;
}

test('site catalog has the required six chatbots in display order', () => {
  const catalog = loadSiteCatalog();
  assert.deepEqual(
    Array.from(catalog.sites, (site) => site.name),
    ['ChatGPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Doubao'],
  );
  for (const site of catalog.sites) {
    assert.ok(site.fileInputSelectors.length > 0, `${site.name} has no file input selectors`);
    assert.ok(site.attachmentButtonSelectors.length > 0, `${site.name} has no attachment button selectors`);
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(catalog.attachmentLimits)),
    {
      maxFiles: 5,
      maxFileSizeBytes: 10 * 1024 * 1024,
      maxTotalSizeBytes: 20 * 1024 * 1024,
    },
  );
});

test('site catalog recognizes supported URLs and rejects unsupported URLs', () => {
  const catalog = loadSiteCatalog();
  assert.equal(catalog.findSiteByUrl('https://chatgpt.com/c/123').id, 'chatgpt');
  assert.equal(catalog.findSiteByUrl('https://chat.deepseek.com/a/chat/123').id, 'deepseek');
  assert.equal(catalog.findSiteByUrl('https://www.doubao.com/chat/123').id, 'doubao');
  assert.equal(catalog.findSiteByUrl('https://example.com/'), null);
  assert.equal(
    catalog.sites.find((site) => site.id === 'deepseek').sendSelectors[0],
    'div[role="button"].ds-button--primary.ds-button--filled.ds-button--circle',
  );
  assert.equal(catalog.sites.find((site) => site.id === 'doubao').sendSelectors[0], '#flow-end-msg-send');
});

test('Gemini new-chat URL preserves the existing Google account path', () => {
  const catalog = loadSiteCatalog();
  assert.equal(
    catalog.getNewChatUrl('gemini', 'https://gemini.google.com/u/2/app/abc'),
    'https://gemini.google.com/u/2/app',
  );
  assert.equal(
    catalog.getNewChatUrl('gemini'),
    'https://gemini.google.com/app',
  );
});

test('manifest loads shared config before the content script', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.version, '1.4.1');
  assert.deepEqual(manifest.permissions, ['tabs', 'notifications']);
  assert.deepEqual(manifest.icons, {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  });
  assert.deepEqual(manifest.action.default_icon, {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
  });
  for (const iconPath of Object.values(manifest.icons)) {
    assert.equal(fs.existsSync(path.join(projectRoot, iconPath)), true, `${iconPath} is missing`);
  }
  assert.deepEqual(manifest.content_scripts[0], {
    matches: [
      'https://gemini.google.com/*',
      'https://www.doubao.com/*',
      'https://doubao.com/*',
    ],
    js: ['page-main.js'],
    run_at: 'document_start',
    world: 'MAIN',
  });
  assert.deepEqual(manifest.content_scripts[1].js, ['sites.js', 'content.js']);
});

test('popup uses external scripts compatible with Manifest V3 CSP', () => {
  const popup = read('popup.html');
  const popupScript = read('popup.js');
  const contentScript = read('content.js');
  const pageMainScript = read('page-main.js');
  assert.match(popup, /<input id="attachment-input" type="file" multiple hidden \/>/);
  assert.match(popup, /<kbd>⌘↵<\/kbd> send/);
  assert.match(popup, /<span class="version-label" id="version-label"><\/span>/);
  assert.match(popup, /https:\/\/github\.com\/algorirhy\/one-ai-shortcut/);
  assert.match(popup, /<script src="sites\.js"><\/script>/);
  assert.match(popup, /<script src="popup\.js"><\/script>/);
  assert.doesNotMatch(popup, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.match(popupScript, /const acknowledgement = await chrome\.runtime\.sendMessage/);
  assert.match(popupScript, /if \(!acknowledgement\?\.accepted\)/);
  assert.match(popupScript, /dataUrl: await fileToDataUrl\(file\)/);
  assert.doesNotMatch(popupScript, /dataUrlPromise/);
  assert.match(popupScript, /chrome\.runtime\.getManifest\(\)\.version/);
  assert.match(contentScript, /waitForSubmissionEvidence/);
  assert.match(contentScript, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(contentScript, /'page-submit', \[\], 70000, prompt/);
  assert.match(pageMainScript, /waitForStableDoubaoComposer/);
  assert.match(pageMainScript, /dispatchDoubaoPointerSequence/);
  assert.match(pageMainScript, /method: 'button-retry'/);
});

test('customer-facing English copy uses AI chatbot terminology', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const customerCopy = [
    manifest.description,
    read('popup.html'),
    read('popup.js'),
    read('README.md'),
    read('PRIVACY.md').split('## 简体中文')[0],
  ].join('\n');

  assert.match(customerCopy, /AI chatbots/);
  assert.doesNotMatch(customerCopy, /\bAI assistants?\b/i);
  assert.doesNotMatch(customerCopy, /\bassistants?\b/i);
});

test('release documentation matches the manifest version', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.match(read('CHANGELOG.md'), new RegExp(`^## ${manifest.version} —`, 'm'));
});
