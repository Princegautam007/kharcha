const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');

function createStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
  };
}

function assertJsonEqual(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
}

function loadApp() {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/i);
  assert.ok(scriptMatch, 'index.html must contain the app script');

  const script = scriptMatch[1];
  const appCode = script.split('// ---- OFFLINE SUPPORT ----')[0] + `\n
    globalThis.__kharcha = {
      CATEGORIES,
      BUDGET_KEY,
      BUDGET_MAX,
      BUDGET_WARN_PERCENT,
      cleanBudgets,
      loadBudgets,
      saveBudgets,
      spentByCategory,
      budgetStatus,
      readBudgetInputs,
      loadAllExpenses,
      mergeRestoredBudgets,
      restoreMessage,
      exportBackup,
    };
  `;

  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    Set,
    Map,
    RegExp,
    isFinite,
    parseFloat,
    localStorage: createStorage(),
    window: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(appCode, sandbox, { filename: INDEX_PATH });
  return sandbox;
}

test('cleanBudgets keeps only positive budgets for known categories', () => {
  const app = loadApp();
  const result = app.__kharcha.cleanBudgets({
    food: 5000,
    fuel: '2000.50',
    unknown: 9000,
    bills: 0,
    health: -1,
    other: 'abc',
    shopping: Infinity,
    transport: null,
  });

  assertJsonEqual(result, { food: 5000, fuel: 2000.5 });
});

test('budget input validation accepts positive numbers and rejects bad values', () => {
  const app = loadApp();
  const good = app.__kharcha.readBudgetInputs({ food: '4999.999', fuel: '', other: '100' });
  assertJsonEqual(good, { budgets: { food: 5000, other: 100 } });

  assert.match(
    app.__kharcha.readBudgetInputs({ food: '0' }).error,
    /Food/
  );
  assert.match(
    app.__kharcha.readBudgetInputs({ food: '-10' }).error,
    /Food/
  );
  assert.match(
    app.__kharcha.readBudgetInputs({ food: 'not-a-number' }).error,
    /Food/
  );
});

test('budget status warns at 80 percent and turns red only when over', () => {
  const app = loadApp();
  assertJsonEqual(app.__kharcha.budgetStatus(0, 1000), {
    level: 'ok', percent: 0, left: 1000,
  });
  assertJsonEqual(app.__kharcha.budgetStatus(799, 1000), {
    level: 'ok', percent: 79, left: 201,
  });
  assertJsonEqual(app.__kharcha.budgetStatus(800, 1000), {
    level: 'warn', percent: 80, left: 200,
  });
  assertJsonEqual(app.__kharcha.budgetStatus(1000, 1000), {
    level: 'warn', percent: 100, left: 0,
  });
  assertJsonEqual(app.__kharcha.budgetStatus(1200, 1000), {
    level: 'over', percent: 100, left: -200,
  });
});

test('spentByCategory totals category amounts and maps unknown categories to Other', () => {
  const app = loadApp();
  const result = app.__kharcha.spentByCategory([
    { category: 'food', amount: 250 },
    { category: 'food', amount: 125.50 },
    { category: 'fuel', amount: 600 },
    { category: 'not-a-category', amount: 50 },
  ]);

  assertJsonEqual(result, { food: 375.5, fuel: 600, other: 50 });
});

test('budget storage uses kharcha_budgets and does not use a month key', () => {
  const app = loadApp();
  app.__kharcha.saveBudgets({ food: 5000, fuel: 2000 });

  assert.equal(app.localStorage.getItem('kharcha_budgets'), '{"food":5000,"fuel":2000}');
  assert.equal(app.localStorage.length, 1);
  assertJsonEqual(app.__kharcha.loadBudgets(), { food: 5000, fuel: 2000 });
});

test('loadAllExpenses ignores the budget storage key', () => {
  const app = loadApp();
  app.localStorage.setItem('kharcha_2026_9', JSON.stringify([
    { id: 1, amount: 100, type: 'debit', merchant: 'Shop' },
  ]));
  app.localStorage.setItem('kharcha_budgets', JSON.stringify({ food: 5000 }));
  app.localStorage.setItem('kharcha_notes', JSON.stringify([{ text: 'ignore' }]));

  assertJsonEqual(app.__kharcha.loadAllExpenses(), [
    { id: 1, amount: 100, type: 'debit', merchant: 'Shop' },
  ]);
});

test('restored budgets never replace a budget already saved', () => {
  const app = loadApp();
  app.__kharcha.saveBudgets({ food: 5000 });

  const added = app.__kharcha.mergeRestoredBudgets({ food: 9000, fuel: 2000 });

  assert.equal(added, 1);
  assertJsonEqual(app.__kharcha.loadBudgets(), { food: 5000, fuel: 2000 });
});

test('backup export includes saved budgets', () => {
  const app = loadApp();
  app.__kharcha.saveBudgets({ food: 5000, fuel: 2000 });
  app.localStorage.setItem('kharcha_2026_9', JSON.stringify([
    { id: 1, amount: 250, type: 'debit', merchant: 'Cafe', category: 'food', date: '2026-09-10T10:00:00.000Z', source: 'manual' },
  ]));

  let downloadedText = '';
  let downloadedName = '';
  vm.runInContext(`
    downloadFile = function(filename, text) {
      globalThis.__download = { filename, text };
    };
    showToast = function() {};
    exportBackup();
  `, app);

  downloadedText = app.__download?.text || '';
  downloadedName = app.__download?.filename || '';
  assert.match(downloadedName, /^kharcha-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const backup = JSON.parse(downloadedText);
  assert.deepEqual(backup.budgets, { food: 5000, fuel: 2000 });
  assert.equal(backup.data.kharga_2026_9, undefined);
  assert.equal(backup.data.karcha_2026_9, undefined);
  assert.deepEqual(backup.data.kharcha_2026_9, [
    { id: 1, amount: 250, type: 'debit', merchant: 'Cafe', category: 'food', date: '2026-09-10T10:00:00.000Z', source: 'manual' },
  ]);
});
