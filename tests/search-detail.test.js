'use strict';
// Run with: node tests/search-detail.test.js
// Covers Task 3: searchExpenses() and showExpenseDetail().

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

function count(app) {
  return app.run("document.getElementById('filteredCount').textContent");
}

function listHtml(app) {
  return app.run("document.getElementById('txList').innerHTML");
}

console.log('searchExpenses');

test('an empty query shows every transaction', () => {
  const app = seededApp();
  app.run('searchExpenses("")');
  assert.strictEqual(count(app), '3 items');
});

test('matches the merchant, ignoring case', () => {
  const app = seededApp();
  app.run('searchExpenses("zomato")');
  assert.strictEqual(count(app), '1 items');
  assert.ok(listHtml(app).includes('Zomato Order'));

  app.run('searchExpenses("UBER")');
  assert.strictEqual(count(app), '1 items');
  assert.ok(listHtml(app).includes('Uber Ride'));
});

test('matches the amount', () => {
  const app = seededApp();
  app.run('searchExpenses("1200")');
  assert.strictEqual(count(app), '1 items');
  assert.ok(listHtml(app).includes('Uber Ride'));
});

test('matches the category label or id', () => {
  const app = seededApp();
  app.run('searchExpenses("transport")');
  assert.strictEqual(count(app), '1 items');
  assert.ok(listHtml(app).includes('Uber Ride'));
});

test('matches the date', () => {
  const app = seededApp();
  app.run('searchExpenses("2026-09-14")');
  assert.strictEqual(count(app), '1 items');
  assert.ok(listHtml(app).includes('Refund'));
});

test('a query with no match shows the match empty state', () => {
  const app = seededApp();
  app.run('searchExpenses("pizza")');
  assert.strictEqual(count(app), '0 items');
  assert.ok(listHtml(app).includes('No transactions match'));
});

test('search combines with the category filter', () => {
  const app = seededApp();
  app.run('setFilter("food")');
  app.run('searchExpenses("uber")');
  assert.strictEqual(count(app), '0 items', 'category + search must both pass');
  app.run('searchExpenses("zomato")');
  assert.strictEqual(count(app), '1 items');
});

test('clearing the query restores the full list', () => {
  const app = seededApp();
  app.run('searchExpenses("uber")');
  assert.strictEqual(count(app), '1 items');
  app.run('searchExpenses("")');
  assert.strictEqual(count(app), '3 items');
});

test('the transaction rows are wired to showExpenseDetail', () => {
  const app = seededApp();
  assert.ok(listHtml(app).includes("showExpenseDetail('1')"), 'row opens the detail view');
  assert.ok(listHtml(app).includes('event.stopPropagation();deleteExpense'), 'delete does not open detail');
  assert.ok(listHtml(app).includes('event.stopPropagation();openEditModal'), 'edit does not open detail');
});

console.log('\nshowExpenseDetail');

test('shows every field of a debit transaction', () => {
  const app = seededApp();
  assert.strictEqual(app.run('showExpenseDetail(2)'), true);
  assert.strictEqual(app.run("document.getElementById('detailModal').classList.contains('open')"), true);
  assert.strictEqual(app.run("document.getElementById('detail-amount').textContent"), '-Rs.1,200');
  assert.strictEqual(app.run("document.getElementById('detail-amount').className"), 'detail-amount');
  assert.strictEqual(app.run("document.getElementById('detail-merchant').textContent"), 'Uber Ride');
  assert.strictEqual(app.run("document.getElementById('detail-category').textContent"), '🚗 Transport');
  assert.strictEqual(app.run("document.getElementById('detail-type').textContent"), 'Debit (Expense)');
  assert.strictEqual(app.run("document.getElementById('detail-source').textContent"), 'From SMS');
  assert.strictEqual(app.run("document.getElementById('detail-bank-row').style.display"), '', 'bank row visible');
  assert.strictEqual(app.run("document.getElementById('detail-bank').textContent"), 'HDFC');
  assert.ok(app.run("document.getElementById('detail-date').textContent").length > 0, 'date is shown');
});

test('shows a credit with the credit style and no bank row', () => {
  const app = seededApp();
  app.run('showExpenseDetail(3)');
  assert.strictEqual(app.run("document.getElementById('detail-amount').textContent"), '+Rs.5,000');
  assert.strictEqual(app.run("document.getElementById('detail-amount').className"), 'detail-amount credit');
  assert.strictEqual(app.run("document.getElementById('detail-type').textContent"), 'Credit (Income)');
  assert.strictEqual(app.run("document.getElementById('detail-source').textContent"), 'Manual entry');
  assert.strictEqual(app.run("document.getElementById('detail-bank-row').style.display"), 'none', 'bank row hidden');
});

test('an unknown id does not open the modal', () => {
  const app = seededApp();
  assert.strictEqual(app.run('showExpenseDetail(999)'), false);
  assert.strictEqual(app.run("document.getElementById('detailModal').classList.contains('open')"), false);
});

test('closeDetailModal closes and clears the state', () => {
  const app = seededApp();
  app.run('showExpenseDetail(1)');
  app.run('closeDetailModal()');
  assert.strictEqual(app.run("document.getElementById('detailModal').classList.contains('open')"), false);
  assert.strictEqual(app.run('detailExpenseId'), null);
});

test('editFromDetail opens the edit modal for the same expense', () => {
  const app = seededApp();
  app.run('showExpenseDetail(2)');
  app.run('editFromDetail()');
  assert.strictEqual(app.run('detailExpenseId'), null, 'detail closed');
  assert.strictEqual(app.run("document.getElementById('detailModal').classList.contains('open')"), false);
  assert.strictEqual(app.run('editingExpenseId'), 2, 'edit modal bound to the expense');
  assert.strictEqual(app.run("document.getElementById('modal').classList.contains('open')"), true);
  assert.strictEqual(app.elements['inp-amount'].value, 1200, 'amount prefilled');
});

test('deleteFromDetail removes the expense and closes the modal', () => {
  const app = seededApp();
  app.run('showExpenseDetail(2)');
  app.run('deleteFromDetail()');
  assert.strictEqual(app.run('expenses.length'), 2, 'expense deleted');
  assert.strictEqual(app.run('expenses.some(e => e.id === 2)'), false);
  assert.strictEqual(app.run("document.getElementById('detailModal').classList.contains('open')"), false);
  assert.strictEqual(app.run('detailExpenseId'), null);
});

test('deleteFromDetail with no selection does nothing', () => {
  const app = seededApp();
  app.run('deleteFromDetail()');
  assert.strictEqual(app.run('expenses.length'), 3);
});

console.log('\nexportSingleExpense');

test('downloads the viewed transaction as a one-row CSV', () => {
  const app = seededApp();
  app.run('window.__download = null; downloadFile = (name, text, mime) => { window.__download = { name, text, mime }; };');
  app.run('showExpenseDetail(2)');
  app.run('exportSingleExpense()');
  const dl = app.run('window.__download');
  assert.ok(dl, 'downloadFile was called');
  assert.ok(dl.name.startsWith('kharcha-transaction') && dl.name.endsWith('.csv'), 'csv filename, got: ' + dl.name);
  assert.strictEqual(dl.mime, 'text/csv');
  // buildCsv adds a UTF-8 BOM (U+FEFF) for Excel; strip it before checking.
  const text = dl.text.charCodeAt(0) === 0xFEFF ? dl.text.slice(1) : dl.text;
  assert.ok(text.startsWith('Date,Time,Type,Amount,Merchant,Category,Bank,Source'), 'same header as month export');
  assert.ok(text.includes('Uber Ride'), 'contains the merchant');
  assert.ok(text.includes('HDFC'), 'contains the bank');
  assert.strictEqual(text.trim().split('\n').length, 2, 'header plus one row');
  assert.strictEqual(app.run("document.getElementById('toast').textContent"), 'Downloaded 1 transaction');
});

test('with no detail open it reports nothing to export', () => {
  const app = seededApp();
  app.run('exportSingleExpense()');
  assert.strictEqual(app.run("document.getElementById('toast').textContent"), 'Nothing to export');
});

finish();
