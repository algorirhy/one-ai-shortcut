const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const contentSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'content.js'),
  'utf8',
);

function createHarness({ confirmOnClick = 2 } = {}) {
  let clock = 0;
  let clickCount = 0;
  let runtimeMessageListener;

  class FakeElement {
    constructor() {
      this.isConnected = true;
      this.className = '';
      this.classList = { contains: () => false };
    }

    getAttribute() { return null; }
    getBoundingClientRect() { return { bottom: 100 }; }
    getClientRects() { return [{}]; }
    matches() { return false; }
    closest() { return null; }
    focus() {}
    dispatchEvent() { return true; }
  }

  class FakeTextArea extends FakeElement {
    constructor() {
      super();
      this._value = '';
    }

    get value() { return this._value; }
    set value(value) { this._value = String(value); }
    select() {}
  }

  class FakeInput extends FakeElement {}

  const editor = new FakeTextArea();
  const sendButton = new FakeElement();
  sendButton.click = () => {
    clickCount += 1;
    if (clickCount >= confirmOnClick) editor.value = '';
  };

  const site = {
    id: 'chatgpt',
    name: 'ChatGPT',
    inputSelectors: ['#editor'],
    sendSelectors: ['#send'],
  };

  const document = {
    querySelectorAll(selector) {
      if (selector === '#editor') return [editor];
      if (selector === '#send') return [sendButton];
      return [];
    },
    addEventListener() {},
  };

  const window = {
    location: {
      href: 'https://chatgpt.com/',
      origin: 'https://chatgpt.com',
    },
    getComputedStyle() {
      return {
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        pointerEvents: 'auto',
      };
    },
    addEventListener() {},
    removeEventListener() {},
    postMessage() {},
    setTimeout(callback, milliseconds) {
      clock += milliseconds;
      queueMicrotask(callback);
      return 1;
    },
    clearTimeout() {},
  };

  const chrome = {
    runtime: {
      onMessage: {
        addListener(listener) {
          runtimeMessageListener = listener;
        },
      },
    },
  };

  const context = vm.createContext({
    OneAIShortcut: { findSiteByUrl: () => site },
    chrome,
    console: { error() {}, log() {}, warn() {} },
    document,
    window,
    navigator: { platform: 'MacIntel' },
    HTMLTextAreaElement: FakeTextArea,
    HTMLInputElement: FakeInput,
    InputEvent: class {},
    Event: class {},
    KeyboardEvent: class {},
    Date: { now: () => clock },
    setTimeout(callback, milliseconds) {
      clock += milliseconds;
      queueMicrotask(callback);
      return 1;
    },
    clearTimeout() {},
    queueMicrotask,
  });

  vm.runInContext(contentSource, context, { filename: 'content.js' });

  async function submit(prompt) {
    return new Promise((resolve) => {
      const keepChannelOpen = runtimeMessageListener(
        { action: 'submit-prompt', prompt, attachments: [] },
        {},
        resolve,
      );
      assert.equal(keepChannelOpen, true);
    });
  }

  return {
    submit,
    clickCount: () => clickCount,
  };
}

test('content delivery retries once when the first click has no submission evidence', async () => {
  const harness = createHarness({ confirmOnClick: 2 });
  const response = await harness.submit('retry me');

  assert.equal(response.ok, true);
  assert.equal(response.method, 'button');
  assert.equal(harness.clickCount(), 2);
});

test('content delivery reports failure after two clicks without submission evidence', async () => {
  const harness = createHarness({ confirmOnClick: Infinity });
  const response = await harness.submit('fail clearly');

  assert.equal(response.ok, false);
  assert.match(response.error, /did not confirm/);
  assert.equal(harness.clickCount(), 2);
});
