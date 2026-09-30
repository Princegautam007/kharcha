'use strict';
// Run with: node tests/android-bridge.test.js
// Android integration tests: they check the contract between the Kotlin side
// (MainActivity.kt) and the JavaScript side (index.html), and exercise the
// bridge functions end to end the way the WebView would call them.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./helpers/load-app');
const { test, finish } = require('./helpers/mini-test');

const ROOT = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const mainActivity = fs.readFileSync(
  path.join(ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'example', 'kharcha', 'MainActivity.kt'),
  'utf8'
);

console.log('Kotlin to JavaScript contract');

test('MainActivity calls window.onSmsHistoryReceived and index.html defines it', () => {
  assert.ok(/window\.onSmsHistoryReceived\(/.test(mainActivity), 'MainActivity.kt invokes it');
  assert.ok(/window\.onSmsHistoryReceived\s*=\s*function/.test(indexHtml), 'index.html defines it');
});

test('MainActivity guards and calls window.onSmsReceived and index.html defines it', () => {
  assert.ok(mainActivity.includes("typeof window.onSmsReceived === 'function'"), 'Kotlin guards the call');
  assert.ok(/window\.onSmsReceived\s*=\s*function/.test(indexHtml), 'index.html defines it');
});

test('repairMisfiledSms runs during startup', () => {
  const init = indexHtml.split('// ---- INIT ----')[1] || '';
  assert.ok(init.includes('repairMisfiledSms()'), 'called in the INIT section');
});

console.log('\nbridge behaviour');

const LIVE_SMS = 'Rs. 450 paid to SWIGGY via UPI Ref 12345.';

test('onSmsReceived logs a single transaction', () => {
  const app = loadApp();
  app.run(`window.onSmsReceived(${JSON.stringify(LIVE_SMS)})`);
  assert.strictEqual(app.run('expenses.length'), 1, 'one expense added');
  assert.strictEqual(app.run('expenses[0].merchant'), 'SWIGGY');
  assert.strictEqual(app.run('expenses[0].amount'), 450);
  assert.strictEqual(app.run('expenses[0].source'), 'sms');
  assert.ok(app.run("document.getElementById('toast').textContent").startsWith('SMS logged'));
});

test('the same live SMS twice is stored only once', () => {
  const app = loadApp();
  app.run(`window.onSmsReceived(${JSON.stringify(LIVE_SMS)})`);
  app.run(`window.onSmsReceived(${JSON.stringify(LIVE_SMS)})`);
  assert.strictEqual(app.run('expenses.length'), 1, 'duplicate skipped');
});

test('a non-transaction SMS is ignored', () => {
  const app = loadApp();
  app.run("window.onSmsReceived('1234 is your OTP. Do not share it with anyone.')");
  assert.strictEqual(app.run('expenses.length'), 0);
});

test('onSmsHistoryReceived imports an array of SMS', () => {
  const app = loadApp();
  const history = [
    { body: 'Your A/c XX1234 is debited by Rs. 1,250.00 to SWIGGY via UPI. Ref 987654.', date: Date.now(), address: 'HDFCBK' },
    { body: 'INR 2,499.00 spent on ICICI Credit Card ending 1234 at AMAZON.', date: Date.now(), address: 'ICICIN' },
  ];
  app.run(`window.onSmsHistoryReceived(${JSON.stringify(history)})`);
  assert.strictEqual(app.run('expenses.length'), 2, 'both imported');
  assert.ok(app.run("document.getElementById('toast').textContent").startsWith('Imported 2'));
});

test('onSmsHistoryReceived with nothing new says so', () => {
  const app = loadApp();
  app.run('window.onSmsHistoryReceived([])');
  assert.strictEqual(app.run('expenses.length'), 0);
  assert.strictEqual(
    app.run("document.getElementById('toast').textContent"),
    'No new transactions found in SMS'
  );
});

test('onSmsHistoryReceived ignores input that is not an array', () => {
  const app = loadApp();
  app.run("window.onSmsHistoryReceived('not an array')");
  app.run('window.onSmsHistoryReceived(null)');
  assert.strictEqual(app.run('expenses.length'), 0);
});

test('history and live SMS do not duplicate each other', () => {
  const app = loadApp();
  const now = Date.now();
  app.run(`window.onSmsHistoryReceived(${JSON.stringify([{ body: LIVE_SMS, date: now, address: 'HDFCBK' }])})`);
  app.run(`window.onSmsReceived(${JSON.stringify(LIVE_SMS)})`);
  assert.strictEqual(app.run('expenses.length'), 1, 'same message imported once');
});

finish();
