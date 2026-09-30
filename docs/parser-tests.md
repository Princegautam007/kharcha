# Tests

The test suites run with Node.js and do not need a browser.

Run them all locally with:

```text
node --test tests/*.test.js
```

Or one suite at a time, for example:

```text
node tests/budgets.test.js
node --test tests/parser.test.js
```

The suites:

| File | Covers |
|------|--------|
| `tests/parser.test.js` | SMS parser: banks, merchants, categories, OTP filtering |
| `tests/budget.test.js` | Budget helpers: validation, status, storage, restore |
| `tests/budgets.test.js` | Budget UI flow: set, clear, bars, backup and restore |
| `tests/manual-entry.test.js` | Add Expense modal, validation, edit flow |
| `tests/search-detail.test.js` | Search, sorting, transaction detail modal, single export |
| `tests/bulk-select.test.js` | Select mode and bulk delete |
| `tests/android-bridge.test.js` | Kotlin-to-JavaScript contract and SMS bridge behaviour |

Every test file loads the script from `index.html` and provides small browser
stubs for storage and DOM calls. The app code stays in `index.html` so the web
app and Android bridge use the same code path.

The workflow in `.github/workflows/parser-tests.yml` runs the same
`node --test tests/*.test.js` command on Node.js 20 for every pull request and
every push to `main`. A failure in any suite fails the build.
