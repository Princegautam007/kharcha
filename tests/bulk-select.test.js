'use strict';
// Run with: node tests/bulk-select.test.js
// Covers Task 7: bulk operations - select mode and deleting several
// transactions at once.

const assert = require('assert');
const { loadApp } = require('./helpers/load-app');
const { test, finish } = require('./helpers/mini-test');

const SEED = [
  { id: 1, type: 'debit', amount: 250, category: 'food', merchant: 'Zomato Order', date: '2026-09-10T10:00:00.000Z', source: 'manual' },
  { id: 2, type: 'debit', amount: 1200, category: 'transport', merchant: 'Uber Ride', date: '2026-09-12T08:30:00.000Z', source: 'sms', bank: 'HDFC' },
  { id: 3, type: 'credit', amount: 5000, category: 'other', merchant: 'Refund', date: '2026-09-14T18:00:00.000Z', source: 'manual' },
];

function seededApp() {
  const app = loadApp();
  app.run('expenses = ' + JSON.stringify(SEED));
  app.run('renderFilters(); renderTxList()');
  return app;
}

function listHtml(app) {
  return app.run("document.getElementById('txList').innerHTML");
}

function bulkBar(app) {
  return app.run("document.getElementById('bulkBar').style.display");
}

function bulkCount(app) {
  return app.run("document.getElementById('bulkCount').textContent");
}

console.log('select mode');

test('selecting Select shows the bulk bar and flips the button', () => {
  const app = seededApp();
  assert.ok(!bulkBar(app), 'hidden at start'); // no style.display set yet
  app.run('toggleSelectMode()');
  assert.strictEqual(bulkBar(app), 'flex', 'bulk bar shown');
  assert.strictEqual(app.run("document.getElementById('selBtn').textContent"), 'Done');
  assert.strictEqual(app.run('selectMode'), true);
});

test('rows become checkboxes wired to toggleSelect', () => {
  const app = seededApp();
  app.run('toggleSelectMode()');
  const html = listHtml(app);
  assert.ok(html.includes("toggleSelect('1')"), 'row clicks toggle selection');
  assert.ok(!html.includes('showExpenseDetail'), 'detail does not open in select mode');
  assert.ok(html.includes('tx-check'), 'checkbox shown');
  assert.ok(!html.includes('tx-delete') && !html.includes('tx-edit'), 'per-row buttons hidden');
});

test('toggling a row updates the count and the row class', () => {
  const app = seededApp();
  app.run('toggleSelectMode()');
  app.run('toggleSelect(2)');
  assert.strictEqual(bulkCount(app), '1 selected');
  assert.ok(listHtml(app).includes('tx-item selected'), 'row marked selected');
  assert.ok(listHtml(app).includes('tx-check">✓'), 'check mark shown');
  app.run('toggleSelect(2)');
  assert.strictEqual(bulkCount(app), '0 selected', 'second click clears it');
  assert.ok(!listHtml(app).includes('tx-item selected'));
});

test('All selects everything currently visible', () => {
  const app = seededApp();
  app.run('toggleSelectMode()');
  app.run('searchExpenses("uber")');
  app.run('selectAllVisible()');
  assert.strictEqual(bulkCount(app), '1 selected', 'only the filtered row');
  app.run('searchExpenses("")');
  app.run('selectAllVisible()');
  assert.strictEqual(bulkCount(app), '3 selected', 'selects the rest too');
});

test('Cancel leaves select mode and clears the selection', () => {
  const app = seededApp();
  app.run('toggleSelectMode()');
  app.run('toggleSelect(1)');
  app.run('toggleSelectMode()');
  assert.strictEqual(app.run('selectMode'), false);
  assert.strictEqual(bulkBar(app), 'none');
  assert.strictEqual(app.run('selectedIds.size'), 0);
  assert.strictEqual(app.run("document.getElementById('selBtn').textContent"), 'Select');
});

console.log('\nbulk delete');

test('deletes only the selected transactions and persists', () => {
  const app = seededApp();
  app.run('toggleSelectMode()');
  app.run('toggleSelect(1); toggleSelect(3)');
  app.run('deleteSelected()');
  assert.strictEqual(app.run('expenses.length'), 1, 'two removed');
  assert.strictEqual(app.run('expenses[0].merchant'), 'Uber Ride');
  const today = new Date();
  const key = `kharcha_${today.getFullYear()}_${today.getMonth() + 1}`;
  const stored = JSON.parse(app.storage.getItem(key));
  assert.strictEqual(stored.length, 1, 'saved to storage');
  assert.strictEqual(bulkBar(app), 'none', 'left select mode');
  assert.strictEqual(app.run("document.getElementById('selBtn').textContent"), 'Select');
  assert.strictEqual(
    app.run("document.getElementById('toast').textContent"),
    'Deleted 2 transactions'
  );
});

test('deleting a single selection uses singular wording', () => {
  const app = seededApp();
  app.run('toggleSelectMode()');
  app.run('toggleSelect(1)');
  app.run('deleteSelected()');
  assert.strictEqual(
    app.run("document.getElementById('toast').textContent"),
    'Deleted 1 transaction'
  );
});

test('deleting with nothing selected does nothing', () => {
  const app = seededApp();
  app.run('toggleSelectMode()');
  app.run('deleteSelected()');
  assert.strictEqual(app.run('expenses.length'), 3, 'nothing removed');
  assert.strictEqual(app.run('selectMode'), true, 'still in select mode');
});

test('changing month exits select mode', () => {
  const app = seededApp();
  app.run('toggleSelectMode()');
  app.run('toggleSelect(1)');
  app.run('changeMonth(1)');
  assert.strictEqual(app.run('selectMode'), false);
  assert.strictEqual(bulkBar(app), 'none');
});

finish();
