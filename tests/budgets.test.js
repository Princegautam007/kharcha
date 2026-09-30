'use strict';
// Run with: node tests/budgets.test.js

const assert = require('assert');
const { loadApp } = require('./helpers/load-app');
const { test, finish } = require('./helpers/mini-test');

function debit(category, amount) {
  return { id: Math.random(), type: 'debit', amount, category, merchant: 'x', date: new Date().toISOString() };
}

console.log('cleanBudgets');

test('keeps valid budgets', () => {
  const app = loadApp();
  assert.deepStrictEqual(app.run('cleanBudgets({ food: 5000, fuel: "2500.5" })'), { food: 5000, fuel: 2500.5 });
});

test('drops unknown categories', () => {
  const app = loadApp();
  const out = app.run('cleanBudgets({ food: 100, pets: 50, __proto__: 5, constructor: 9 })');
  assert.deepStrictEqual(Object.keys(out), ['food']);
});

test('drops zero, negative, huge and non-numeric values', () => {
  const app = loadApp();
  const out = app.run('cleanBudgets({ food: 0, transport: -5, shopping: "abc", bills: NaN, health: Infinity, fuel: 1e12, groceries: "", other: null })');
  assert.deepStrictEqual(out, {});
});

test('drops booleans, arrays and objects as values', () => {
  const app = loadApp();
  assert.deepStrictEqual(app.run('cleanBudgets({ food: true, fuel: [5], bills: { a: 1 } })'), {});
});

test('returns empty for input that is not an object', () => {
  const app = loadApp();
  assert.deepStrictEqual(app.run('cleanBudgets(null)'), {});
  assert.deepStrictEqual(app.run('cleanBudgets([1, 2])'), {});
  assert.deepStrictEqual(app.run('cleanBudgets("food")'), {});
});

console.log('\nsaving and loading');

test('saves and loads budgets', () => {
  const app = loadApp();
  app.run('saveBudgets({ food: 3000, bills: 1200 })');
  assert.deepStrictEqual(JSON.parse(app.storage.getItem('kharcha_budgets')), { food: 3000, bills: 1200 });
  assert.deepStrictEqual(app.run('loadBudgets()'), { food: 3000, bills: 1200 });
});

test('saving an empty set removes the key', () => {
  const app = loadApp();
  app.run('saveBudgets({ food: 3000 })');
  app.run('saveBudgets({})');
  assert.strictEqual(app.storage.getItem('kharcha_budgets'), null);
});

test('broken saved data gives no budgets', () => {
  const app = loadApp({ storage: { kharcha_budgets: '{not json' } });
  assert.deepStrictEqual(app.run('loadBudgets()'), {});
});

test('saved values are cleaned when loaded', () => {
  const app = loadApp({ storage: { kharcha_budgets: JSON.stringify({ food: 100, pets: 5, fuel: -1 }) } });
  assert.deepStrictEqual(app.run('loadBudgets()'), { food: 100 });
});

test('loadAllExpenses ignores the budgets key', () => {
  const list = [{ id: 1, type: 'debit', amount: 10, category: 'food', merchant: 'a', date: '2026-09-10T10:00:00.000Z' }];
  const app = loadApp({ storage: { kharcha_2026_9: JSON.stringify(list), kharcha_budgets: JSON.stringify({ food: 100 }) } });
  assert.strictEqual(app.run('loadAllExpenses()').length, 1);
});

console.log('\nbudgetStatus');

test('under 80 percent is ok', () => {
  const app = loadApp();
  const s = app.run('budgetStatus(3999, 5000)');
  assert.strictEqual(s.level, 'ok');
  assert.strictEqual(s.percent, 79);
  assert.strictEqual(s.left, 1001);
});

test('exactly 80 percent is a warning', () => {
  const app = loadApp();
  assert.strictEqual(app.run('budgetStatus(4000, 5000)').level, 'warn');
});

test('exactly at the limit is a warning, not over', () => {
  const app = loadApp();
  const s = app.run('budgetStatus(5000, 5000)');
  assert.strictEqual(s.level, 'warn');
  assert.strictEqual(s.percent, 100);
});

test('above the limit is over and the bar stays at 100', () => {
  const app = loadApp();
  const s = app.run('budgetStatus(5500, 5000)');
  assert.strictEqual(s.level, 'over');
  assert.strictEqual(s.percent, 100);
  assert.strictEqual(s.left, -500);
});

test('nothing spent is ok at 0 percent', () => {
  const app = loadApp();
  const s = app.run('budgetStatus(0, 5000)');
  assert.strictEqual(s.level, 'ok');
  assert.strictEqual(s.percent, 0);
});

console.log('\nspentByCategory');

test('adds up debits per category and maps unknown ones to other', () => {
  const app = loadApp();
  app.ctx.list = [debit('food', 100), debit('food', 50.5), debit('fuel', 200), debit('mystery', 30), debit(undefined, 20)];
  assert.deepStrictEqual(app.run('spentByCategory(list)'), { food: 150.5, fuel: 200, other: 50 });
});

console.log('\nreadBudgetInputs');

test('empty boxes mean no budget', () => {
  const app = loadApp();
  app.ctx.v = { food: '5000', transport: '', fuel: '  ' };
  assert.deepStrictEqual(app.run('readBudgetInputs(v)'), { budgets: { food: 5000 } });
});

test('a bad value returns an error naming the category', () => {
  const app = loadApp();
  app.ctx.v = { food: '100', shopping: 'abc' };
  assert.deepStrictEqual(app.run('readBudgetInputs(v)'), { error: 'Enter a valid budget for Shopping' });
});

test('zero and negative values are errors', () => {
  const app = loadApp();
  app.ctx.a = { food: '0' };
  app.ctx.b = { bills: '-20' };
  assert.ok(app.run('readBudgetInputs(a)').error);
  assert.ok(app.run('readBudgetInputs(b)').error);
});

console.log('\nrenderBudgets');

test('shows a hint when there are no budgets', () => {
  const app = loadApp();
  app.run('renderBudgets([])');
  assert.ok(app.elements.budgetList.innerHTML.includes('No budgets yet'));
});

test('shows ok, warn and over bars', () => {
  const app = loadApp();
  app.run('saveBudgets({ food: 1000, fuel: 1000, bills: 1000 })');
  app.ctx.list = [debit('food', 500), debit('fuel', 850), debit('bills', 1200)];
  app.run('renderBudgets(list)');
  const html = app.elements.budgetList.innerHTML;
  assert.ok(/budget-item ok[\s\S]*Food/.test(html));
  assert.ok(/budget-item warn[\s\S]*Fuel/.test(html));
  assert.ok(/budget-item over[\s\S]*Bills/.test(html));
  assert.ok(html.includes('Over the budget by Rs.200'));
  assert.ok(html.includes('Rs.850 of Rs.1,000'));
});

test('ignores credits and categories without a budget', () => {
  const app = loadApp();
  app.run('saveBudgets({ food: 1000 })');
  app.ctx.list = [debit('fuel', 999)];
  app.run('renderBudgets(list)');
  assert.ok(!app.elements.budgetList.innerHTML.includes('Fuel'));
});

console.log('\nsetting and clearing in the form');

test('saveBudgetsFromModal saves values and clearing a box removes that budget', () => {
  const app = loadApp();
  app.run('saveBudgets({ food: 1000, fuel: 500 })');
  app.run('openBudgetModal()');
  // The form is built as text in this test setup, so fill the boxes directly.
  app.run("CATEGORIES.forEach(c => { document.getElementById('bud-' + c.id).value = ''; })");
  app.run("document.getElementById('bud-food').value = '2000'");
  app.run("document.getElementById('bud-fuel').value = '500'");
  app.run("clearBudgetInput('fuel')");
  app.run('saveBudgetsFromModal()');
  assert.deepStrictEqual(app.run('loadBudgets()'), { food: 2000 });
});

test('saveBudgetsFromModal keeps old budgets when a value is bad', () => {
  const app = loadApp();
  app.run('saveBudgets({ food: 1000 })');
  app.run("CATEGORIES.forEach(c => { document.getElementById('bud-' + c.id).value = ''; })");
  app.run("document.getElementById('bud-food').value = '-5'");
  app.run('saveBudgetsFromModal()');
  assert.deepStrictEqual(app.run('loadBudgets()'), { food: 1000 });
  assert.strictEqual(app.elements.toast.textContent, 'Enter a valid budget for Food');
});

console.log('\nbackup and restore');

function captureDownload(app) {
  app.run('globalThis.__dl = null; downloadFile = function (name, text, type) { globalThis.__dl = { name, text, type }; }');
}

function restore(app, backupObject) {
  app.ctx.__event = { target: { files: [{ size: 100, text: JSON.stringify(backupObject) }], value: '' } };
  app.run('restoreBackup(__event)');
}

test('backup includes budgets', () => {
  const app = loadApp({ storage: { kharcha_2026_9: JSON.stringify([{ id: 1, type: 'debit', amount: 5, category: 'food', merchant: 'a', date: '2026-09-10T10:00:00.000Z' }]) } });
  app.run('saveBudgets({ food: 4000 })');
  captureDownload(app);
  app.run('exportBackup()');
  const backup = JSON.parse(app.ctx.__dl.text);
  assert.deepStrictEqual(backup.budgets, { food: 4000 });
  assert.ok(backup.data.kharcha_2026_9);
});

test('backup works when there are only budgets', () => {
  const app = loadApp();
  app.run('saveBudgets({ bills: 900 })');
  captureDownload(app);
  app.run('exportBackup()');
  assert.deepStrictEqual(JSON.parse(app.ctx.__dl.text).budgets, { bills: 900 });
});

test('backup with no data and no budgets does nothing', () => {
  const app = loadApp();
  captureDownload(app);
  app.run('exportBackup()');
  assert.strictEqual(app.ctx.__dl, null);
  assert.strictEqual(app.elements.toast.textContent, 'Nothing to back up yet');
});

test('backup without budgets has no budgets field', () => {
  const app = loadApp({ storage: { kharcha_2026_9: JSON.stringify([{ id: 1, type: 'debit', amount: 5, category: 'food', merchant: 'a', date: '2026-09-10T10:00:00.000Z' }]) } });
  captureDownload(app);
  app.run('exportBackup()');
  assert.ok(!('budgets' in JSON.parse(app.ctx.__dl.text)));
});

test('restore adds only valid budgets', () => {
  const app = loadApp();
  restore(app, { app: 'kharcha', version: 1, data: {}, budgets: { food: 3000, pets: 10, fuel: -1, bills: 'abc', health: '750' } });
  assert.deepStrictEqual(app.run('loadBudgets()'), { food: 3000, health: 750 });
  assert.strictEqual(app.elements.toast.textContent, 'Restored 2 budgets');
});

test('restore does not replace a budget that is already set', () => {
  const app = loadApp();
  app.run('saveBudgets({ food: 1000 })');
  restore(app, { app: 'kharcha', version: 1, data: {}, budgets: { food: 9999, fuel: 400 } });
  assert.deepStrictEqual(app.run('loadBudgets()'), { food: 1000, fuel: 400 });
});

test('restore of an older backup without budgets still works', () => {
  const entry = { id: 7, type: 'debit', amount: 50, category: 'food', merchant: 'Cafe', date: '2026-09-10T10:00:00.000Z', source: 'manual' };
  const app = loadApp();
  restore(app, { app: 'kharcha', version: 1, data: { kharcha_2026_9: [entry] } });
  assert.strictEqual(app.elements.toast.textContent, 'Restored 1 transaction');
  assert.deepStrictEqual(app.run('loadBudgets()'), {});
});

test('restore ignores budgets that are not an object', () => {
  const app = loadApp();
  restore(app, { app: 'kharcha', version: 1, data: {}, budgets: 'lots' });
  assert.deepStrictEqual(app.run('loadBudgets()'), {});
  assert.strictEqual(app.elements.toast.textContent, 'Nothing new to restore');
});

test('restore message wording', () => {
  const app = loadApp();
  assert.strictEqual(app.run('restoreMessage(0, 0)'), 'Nothing new to restore');
  assert.strictEqual(app.run('restoreMessage(5, 0)'), 'Restored 5 transactions');
  assert.strictEqual(app.run('restoreMessage(0, 1)'), 'Restored 1 budget');
  assert.strictEqual(app.run('restoreMessage(5, 2)'), 'Restored 5 transactions and 2 budgets');
});

finish();
