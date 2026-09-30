'use strict';
// Run with: node tests/manual-entry.test.js
// Covers Task 2: manual expense entry (Add Expense modal) and the edit flow.

const assert = require('assert');
const { loadApp } = require('./helpers/load-app');
const { test, finish } = require('./helpers/mini-test');

const today = new Date();
const dateStr = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-');

console.log('Add Expense modal');

test('openModal opens the modal titled Add Expense', () => {
  const app = loadApp();
  app.run('openModal()');
  assert.strictEqual(app.run("document.getElementById('modal').classList.contains('open')"), true);
  assert.strictEqual(app.run("document.getElementById('modal').querySelector('.modal-title').textContent"), 'Add Expense');
});

test('rejects an empty amount', () => {
  const app = loadApp();
  app.run('openModal()');
  app.run('saveExpense()');
  assert.strictEqual(app.run("document.getElementById('toast').textContent"), 'Enter a valid amount');
  assert.strictEqual(app.run('expenses.length'), 0);
});

test('rejects an empty description', () => {
  const app = loadApp();
  app.run('openModal()');
  app.elements['inp-amount'].value = '250';
  app.run('saveExpense()');
  assert.strictEqual(app.run("document.getElementById('toast').textContent"), 'Enter a description');
  assert.strictEqual(app.run('expenses.length'), 0);
});

test('rejects a date outside the month being viewed', () => {
  const app = loadApp();
  app.run('openModal()');
  app.elements['inp-amount'].value = '250';
  app.elements['inp-desc'].value = 'Coffee';
  app.elements['inp-date'].value = '2000-01-01';
  app.run('saveExpense()');
  assert.strictEqual(app.run('expenses.length'), 0);
});

test('saves a valid manual expense and closes the modal', () => {
  const app = loadApp();
  app.run('openModal()');
  app.elements['inp-amount'].value = '250';
  app.elements['inp-desc'].value = 'Coffee';
  app.elements['inp-type'].value = 'debit';
  app.elements['inp-date'].value = dateStr;
  app.run('saveExpense()');

  assert.strictEqual(app.run('expenses.length'), 1);
  assert.strictEqual(app.run('expenses[0].merchant'), 'Coffee');
  assert.strictEqual(app.run('expenses[0].amount'), 250);
  assert.strictEqual(app.run('expenses[0].type'), 'debit');
  assert.strictEqual(app.run('expenses[0].source'), 'manual');
  assert.strictEqual(app.run("document.getElementById('toast').textContent"), 'Saved!');
  assert.strictEqual(app.run("document.getElementById('modal').classList.contains('open')"), false);

  const saved = new Date(app.run('expenses[0].date'));
  assert.strictEqual(
    `${saved.getFullYear()}-${saved.getMonth() + 1}-${saved.getDate()}`,
    `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`,
    'keeps the chosen date'
  );
});

test('persists the expense under the month storage key', () => {
  const app = loadApp();
  app.run('openModal()');
  app.elements['inp-amount'].value = '99';
  app.elements['inp-desc'].value = 'Bus fare';
  app.elements['inp-date'].value = dateStr;
  app.run('saveExpense()');
  const stored = JSON.parse(app.storage.getItem(`kharcha_${today.getFullYear()}_${today.getMonth() + 1}`));
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].merchant, 'Bus fare');
});

console.log('\nedit flow');

test('openEditModal prefills the modal from a saved expense', () => {
  const app = loadApp();
  app.run('openModal()');
  app.elements['inp-amount'].value = '250';
  app.elements['inp-desc'].value = 'Coffee';
  app.elements['inp-date'].value = dateStr;
  app.run('saveExpense()');

  const id = app.run('expenses[0].id');
  app.run(`openEditModal(${JSON.stringify(String(id))})`);
  assert.strictEqual(app.run('editingExpenseId !== null'), true);
  assert.strictEqual(app.elements['inp-amount'].value, 250);
  assert.strictEqual(app.elements['inp-desc'].value, 'Coffee');
  assert.strictEqual(
    app.run("document.getElementById('modal').querySelector('.modal-title').textContent"),
    'Edit Expense'
  );
});

test('editing updates the expense in place without duplicating', () => {
  const app = loadApp();
  app.run('openModal()');
  app.elements['inp-amount'].value = '250';
  app.elements['inp-desc'].value = 'Coffee';
  app.elements['inp-date'].value = dateStr;
  app.run('saveExpense()');

  const id = app.run('expenses[0].id');
  app.run(`openEditModal(${JSON.stringify(String(id))})`);
  app.elements['inp-amount'].value = '300';
  app.elements['inp-desc'].value = 'Coffee refilled';
  app.run('saveExpense()');

  assert.strictEqual(app.run('expenses.length'), 1, 'no duplicate created');
  assert.strictEqual(app.run('expenses[0].amount'), 300);
  assert.strictEqual(app.run('expenses[0].merchant'), 'Coffee refilled');
  assert.strictEqual(app.run('editingExpenseId'), null, 'edit state cleared');
  assert.strictEqual(app.run("document.getElementById('toast').textContent"), 'Updated!');
});

test('openEditModal with an unknown id does nothing', () => {
  const app = loadApp();
  app.run('openModal()');
  app.elements['inp-amount'].value = '1';
  app.elements['inp-desc'].value = 'x';
  app.elements['inp-date'].value = dateStr;
  app.run('saveExpense()');
  app.run('openEditModal("no-such-id")');
  assert.strictEqual(app.run('editingExpenseId'), null);
});

test('closeModal clears the editing state and closes the modal', () => {
  const app = loadApp();
  app.run('openModal()');
  app.elements['inp-amount'].value = '10';
  app.elements['inp-desc'].value = 'x';
  app.elements['inp-date'].value = dateStr;
  app.run('saveExpense()');
  const id = app.run('expenses[0].id');
  app.run(`openEditModal(${JSON.stringify(String(id))})`);
  app.run('closeModal()');
  assert.strictEqual(app.run('editingExpenseId'), null);
  assert.strictEqual(app.run("document.getElementById('modal').classList.contains('open')"), false);
});

finish();
