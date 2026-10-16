'use strict';
// Adversarial checks for Phase 2 canonicalization. Run directly:
// node tests/canonical-adv.js (exits non-zero on any failure).
const loadParser = require('./helpers/load-parser');

let failures = 0;
function check(name, actual, want) {
  const ok = actual === want;
  if (!ok) failures++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(want) + ')'));
}

const parseSms = loadParser();
const tx = (text, sender) => parseSms(text, sender || 'HDFCBK');

// Variant spellings merge.
check('AMZN merges', tx('INR 899 spent on Card XX1 at AMZN on 19-Sep-26.', 'ICICIB').merchant, 'Amazon');
check('AMAZON PAY merges', tx('Rs. 1299 paid to AMAZON PAY via UPI.').merchant, 'Amazon');
check("DOMINO'S merges", tx('Rs. 799 spent at DOMINO\'S on 18-Sep-26.', 'AXISBK').merchant, 'Dominos');
check('DOMINOS PIZZA keeps detail', tx('Rs. 650 paid to DOMINOS PIZZA via UPI.').merchant, 'Dominos Pizza');

// VPA handles become readable names.
check('person VPA', tx('Rs. 1000 sent to rahul.sharma42@okhdfc from your HDFC Bank account.').merchant, 'Rahul Sharma');
check('shop VPA', tx('Rs. 150 paid to sharma-kirana-store@upi via UPI.', 'SBIBNK').merchant, 'Sharma Kirana Store');

// Typo tolerance stays tight: one typo merges, two do not.
check('one typo merges', tx('Rs. 100 paid to SWIGY via UPI.').merchant, 'Swiggy');
check('unrelated name stays', tx('Rs. 100 paid to SWIGGY Residency Hotel via UPI.').merchant, 'Swiggy Residency Hotel');

// Unknown merchants are tidied, never raw fragments.
check('unknown tidied', tx('Rs. 275 paid to sri sai textiles and garments via UPI.').merchant, 'Sri Sai Textiles And Garments');

// No crashes on hostile input.
for (const bad of ['', 'Rs', 'Rs. paid to @@@ via UPI', 'Rs. 100 paid to a@b via UPI',
    'Rs. 100 paid to ' + 'x'.repeat(500) + ' via UPI', null, undefined]) {
  try {
    parseSms(bad, 'HDFCBK');
    console.log('ok   no crash on ' + JSON.stringify(String(bad).slice(0, 20)));
  } catch (e) { failures++; console.log('FAIL threw on ' + JSON.stringify(String(bad).slice(0, 20))); }
}

// Corrupted alias store never breaks parsing.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1];
const elements = new Proxy({}, { get(t, id) { return t[id] || (t[id] = { value: '', textContent: '', innerHTML: '', className: '', style: {}, classList: { add() {}, remove() {} }, focus() {}, getContext() { return { clearRect() {}, beginPath() {}, arc() {}, stroke() {}, fill() {}, moveTo() {}, closePath() {} }; } }); } });
const ctx = { console, document: { getElementById(id) { return elements[id]; } },
  localStorage: { length: 0, getItem() { return '{broken json'; }, setItem() {}, removeItem() {}, key() { return null; } },
  navigator: {}, location: { protocol: 'file:' } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src + '\nthis.__p = parseSms;', ctx);
try {
  const r = ctx.__p('Rs. 500 paid to SWIGGY via UPI.', 'HDFCBK');
  check('corrupt store still parses', r && r.merchant, 'Swiggy');
} catch (e) { failures++; console.log('FAIL corrupt store threw'); }

console.log(failures === 0 ? '\nall adversarial checks passed' : '\n' + failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
