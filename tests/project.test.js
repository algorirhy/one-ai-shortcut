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

test('site catalog has the required six assistants in display order', () => {
  const catalog = loadSiteCatalog();
  assert.deepEqual(
    Array.from(catalog.sites, (site) => site.name),
    ['ChatGPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Doubao'],
  );
});

test('site catalog recognizes supported URLs and rejects unsupported URLs', () => {
  const catalog = loadSiteCatalog();
  assert.equal(catalog.findSiteByUrl('https://chatgpt.com/c/123').id, 'chatgpt');
  assert.equal(catalog.findSiteByUrl('https://chat.deepseek.com/a/chat/123').id, 'deepseek');
  assert.equal(catalog.findSiteByUrl('https://www.doubao.com/chat/123').id, 'doubao');
  assert.equal(catalog.findSiteByUrl('https://example.com/'), null);
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
  assert.equal(manifest.version, '1.3.1');
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
    matches: ['https://www.doubao.com/*', 'https://doubao.com/*'],
    js: ['doubao-main.js'],
    run_at: 'document_start',
    world: 'MAIN',
  });
  assert.deepEqual(manifest.content_scripts[1].js, ['sites.js', 'content.js']);
});

test('popup uses external scripts compatible with Manifest V3 CSP', () => {
  const popup = read('popup.html');
  assert.match(popup, /<script src="sites\.js"><\/script>/);
  assert.match(popup, /<script src="popup\.js"><\/script>/);
  assert.doesNotMatch(popup, /<script(?![^>]*\bsrc=)[^>]*>/i);
});
