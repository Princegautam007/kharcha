'use strict';
// Loads the script block of index.html inside Node, with simple stand-ins for
// the browser (document, localStorage, FileReader). No browser is needed.
// The same helper can be used by any test that needs functions from the app.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] === undefined ? null : Array.from(map.keys())[i]; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
  };
}

// A canvas stand-in that accepts any drawing call.
function makeCanvasContext() {
  const store = {};
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => ({ addColorStop() {} });
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

function makeElement() {
  const classes = new Set();
  const children = {};
  return {
    style: {},
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    className: '',
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); },
    },
    focus() {},
    click() {},
    remove() {},
    appendChild() {},
    getContext() { return makeCanvasContext(); },
    // Elements like the modal look up children (e.g. .modal-title).
    querySelector(sel) {
      if (!children[sel]) children[sel] = makeElement();
      return children[sel];
    },
  };
}

function loadApp(options) {
  const opts = options || {};
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const blocks = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g));
  if (blocks.length === 0) throw new Error('No script block found in index.html');
  const code = blocks[blocks.length - 1][1];

  const storage = makeStorage(opts.storage);
  const elements = {};
  const document = {
    getElementById(id) { return elements[id] || (elements[id] = makeElement()); },
    createElement() { return makeElement(); },
    body: makeElement(),
  };
  class FakeFileReader {
    readAsText(file) { this.result = file.text; this.onload(); }
  }

  const sandbox = {
    document,
    localStorage: storage,
    navigator: { userAgent: 'Node test' },
    location: { protocol: 'file:' },
    FileReader: FakeFileReader,
    Blob: class { constructor(parts) { this.parts = parts; } },
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout() { return 0; },
    console,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: 'index.html' });

  return {
    ctx,
    storage,
    elements,
    // Runs a piece of code inside the app, for example run('expenses.length').
    // Objects and arrays are copied out, so they compare cleanly in tests.
    run(source) {
      const result = vm.runInContext(source, ctx);
      if (result && typeof result === 'object') return JSON.parse(JSON.stringify(result));
      return result;
    },
  };
}

module.exports = { loadApp };
