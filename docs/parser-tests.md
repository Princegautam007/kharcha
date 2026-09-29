# Parser tests

The SMS parser tests run with Node.js and do not need a browser.

Run them locally with:

```text
node --test tests/parser.test.js
```

The test file loads the script from `index.html` and provides small browser stubs for storage and DOM calls. The parser stays in `index.html` so the web app and Android bridge use the same code path.

The pull request workflow runs the same command on Node.js 20.
