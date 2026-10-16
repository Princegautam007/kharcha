'use strict';
// Phase 0 eval harness: runs every golden SMS through the real parseSms()
// from index.html and reports per-field accuracy plus the false-positive
// rate. This file MEASUREs only. It never fails on a low score: it fails
// only when a score drops below the recorded baseline, so today's known
// issues do not block the build. Phase 1 fixes must raise the numbers.
//
// Usage: node tests/parser-eval.js            (measure)
//        node tests/parser-eval.js --update    (re-record baseline after a fix)

const fs = require('node:fs');
const path = require('node:path');
const loadParser = require('./helpers/load-parser');

const GOLDEN_PATH = path.join(__dirname, 'parser-golden.json');
const BASELINE_PATH = path.join(__dirname, 'parser-baseline.json');

function merchantOk(actual, want) {
  if (want.merchant !== undefined) return actual === want.merchant;
  if (want.merchantContains !== undefined) {
    return typeof actual === 'string' &&
      actual.toLowerCase().includes(String(want.merchantContains).toLowerCase());
  }
  if (want.merchantIsFallback) {
    return typeof actual === 'string' &&
      /transaction|unknown/i.test(actual) && !/^(your\s+)?(account|a\/c|acct)$/i.test(actual);
  }
  return false;
}

function evaluate(parseSms, cases) {
  const stats = {
    amount: { ok: 0, total: 0 },
    type: { ok: 0, total: 0 },
    merchant: { ok: 0, total: 0 },
    category: { ok: 0, total: 0 },
    bank: { ok: 0, total: 0 },
    noiseRejected: { ok: 0, total: 0 },
    falsePositives: 0,
  };
  const misses = [];

  for (const c of cases) {
    const got = parseSms(c.text, c.sender);
    if (c.expected === null) {
      stats.noiseRejected.total++;
      if (got === null) stats.noiseRejected.ok++;
      else { stats.falsePositives++; misses.push(c.id + ': noise logged as transaction'); }
      continue;
    }
    if (got === null) {
      for (const f of ['amount', 'type', 'merchant', 'category', 'bank']) stats[f].total++;
      misses.push(c.id + ': transaction missed entirely (returned null)');
      continue;
    }
    const fieldResults = {
      amount: got.amount === c.expected.amount,
      type: got.type === c.expected.type,
      merchant: merchantOk(got.merchant, c.expected),
      category: got.category === c.expected.category,
      bank: (got.bank || null) === (c.expected.bank || null),
    };
    for (const [field, pass] of Object.entries(fieldResults)) {
      stats[field].total++;
      if (pass) stats[field].ok++;
      else misses.push(c.id + ': ' + field + ' got ' + JSON.stringify(got[field]));
    }
  }
  return { stats, misses };
}

function pct(s) {
  return s.total === 0 ? 100 : Math.round((s.ok / s.total) * 1000) / 10;
}

function summarize(stats) {
  const totalTxFields = ['amount', 'type', 'merchant', 'category', 'bank']
    .reduce((n, f) => n + stats[f].total, 0);
  const okTxFields = ['amount', 'type', 'merchant', 'category', 'bank']
    .reduce((n, f) => n + stats[f].ok, 0);
  return {
    amount: pct(stats.amount),
    type: pct(stats.type),
    merchant: pct(stats.merchant),
    category: pct(stats.category),
    bank: pct(stats.bank),
    noiseRejected: pct(stats.noiseRejected),
    overall: totalTxFields === 0 ? 100 : Math.round((okTxFields / totalTxFields) * 1000) / 10,
    falsePositives: stats.falsePositives,
  };
}

function main() {
  const cases = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  const parseSms = loadParser();
  const { stats, misses } = evaluate(parseSms, cases);
  const summary = summarize(stats);

  console.log('parser eval: ' + cases.length + ' golden SMS');
  for (const f of ['amount', 'type', 'merchant', 'category', 'bank', 'noiseRejected']) {
    console.log('  ' + f + ': ' + stats[f].ok + '/' + stats[f].total + ' (' + summary[f] + '%)');
  }
  console.log('  overall: ' + summary.overall + '%   false positives: ' + summary.falsePositives);
  if (misses.length > 0) {
    console.log('misses (' + misses.length + '):');
    for (const m of misses) console.log('  - ' + m);
  }

  if (process.argv.includes('--update')) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(summary, null, 2) + '\n');
    console.log('baseline re-recorded in tests/parser-baseline.json');
    return;
  }

  let baseline = null;
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); }
  catch (e) { /* first run before a baseline exists */ }

  if (!baseline) {
    console.log('no baseline yet: run node tests/parser-eval.js --update to record one');
    return;
  }

  const regressions = [];
  for (const f of ['amount', 'type', 'merchant', 'category', 'bank', 'noiseRejected', 'overall']) {
    if (summary[f] < baseline[f]) regressions.push(f + ' fell ' + baseline[f] + '% -> ' + summary[f] + '%');
  }
  if (summary.falsePositives > baseline.falsePositives) {
    regressions.push('false positives rose ' + baseline.falsePositives + ' -> ' + summary.falsePositives);
  }
  if (regressions.length > 0) {
    console.error('REGRESSION vs baseline:');
    for (const r of regressions) console.error('  - ' + r);
    process.exitCode = 1;
  } else {
    console.log('no regression vs baseline');
  }
}

if (require.main === module) main();

module.exports = { evaluate, summarize, merchantOk };
