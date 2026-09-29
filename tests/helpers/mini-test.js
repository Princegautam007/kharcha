'use strict';
// A very small test runner so the tests need no packages.

const results = { passed: 0, failed: 0 };

function test(name, fn) {
  try {
    fn();
    results.passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    results.failed++;
    console.log('  FAIL ' + name);
    console.log('       ' + (err && err.message ? err.message : err));
  }
}

function finish() {
  console.log('\n' + results.passed + ' passed, ' + results.failed + ' failed');
  if (results.failed > 0) process.exit(1);
}

module.exports = { test, finish };
