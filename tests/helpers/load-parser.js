'use strict';
// Loads parseSms() from the real index.html inside a fake DOM, so every
// parser test and eval script exercises the exact code that ships.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadParser() {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
  if (!scriptMatch) throw new Error('index.html must contain one inline script');

  const elements = new Proxy({}, {
    get(target, id) {
      if (!target[id]) {
        target[id] = {
          value: '',
          textContent: '',
          innerHTML: '',
          className: '',
          style: {},
          classList: { add() {}, remove() {} },
          focus() {},
          getContext() {
            return {
              clearRect() {},
              beginPath() {},
              arc() {},
              stroke() {},
              fill() {},
              moveTo() {},
              closePath() {},
              lineWidth: 0,
              strokeStyle: '',
              fillStyle: ''
            };
          }
        };
      }
      return target[id];
    }
  });

  const localStorage = {
    length: 0,
    getItem() { return null; },
    setItem() {},
    removeItem() {},
    key() { return null; }
  };

  const context = {
    console,
    Math,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    parseFloat,
    parseInt,
    isFinite,
    setTimeout() {},
    clearTimeout() {},
    localStorage,
    document: {
      getElementById(id) { return elements[id]; }
    },
    navigator: { userAgent: 'Android' },
    location: { protocol: 'file:' },
    Blob,
    URL,
    FileReader: function() {},
  };

  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(
    scriptMatch[1] + '\nthis.__parseSms = parseSms;',
    context,
    { filename: 'index.html' }
  );

  return context.__parseSms;
}

module.exports = loadParser;
