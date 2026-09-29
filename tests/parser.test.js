const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadParser() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
  assert.ok(scriptMatch, 'index.html must contain one inline script');

  const elements = new Proxy({}, {
    get(target, id) {
      if (!target[id]) {
        target[id] = {
          value: '',
          textContent: '',
          innerHTML: '',
          className: '',
          style: {},
          classList: { add() {}, remove() {} },
          focus() {},
          getContext() {
            return {
              clearRect() {},
              beginPath() {},
              arc() {},
              stroke() {},
              fill() {},
              moveTo() {},
              closePath() {},
              lineWidth: 0,
              strokeStyle: '',
              fillStyle: ''
            };
          }
        };
      }
      return target[id];
    }
  });

  const localStorage = {
    length: 0,
    getItem() { return null; },
    setItem() {},
    removeItem() {},
    key() { return null; }
  };

  const context = {
    console,
    Math,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    parseFloat,
    parseInt,
    isFinite,
    setTimeout() {},
    clearTimeout() {},
    localStorage,
    document: {
      getElementById(id) { return elements[id]; }
    },
    navigator: { userAgent: 'Android' },
    location: { protocol: 'file:' },
    Blob,
    URL,
    FileReader: function() {},
  };

  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(
    scriptMatch[1] + '\nthis.__parseSms = parseSms;',
    context,
    { filename: 'index.html' }
  );

  return context.__parseSms;
}

const parseSms = loadParser();

function sample(text, senderId) {
  const result = parseSms(text, senderId);
  assert.ok(result, `Expected a transaction: ${text}`);
  return result;
}

test('parses UPI debit and detects HDFC plus food merchant', () => {
  const tx = sample(
    'Your A/c XX1234 is debited by Rs. 1,250.00 on 29-Sep-26 to SWIGGY via UPI. Ref 987654.',
    'HDFCBK'
  );
  assert.equal(tx.amount, 1250);
  assert.equal(tx.type, 'debit');
  assert.equal(tx.merchant, 'SWIGGY');
  assert.equal(tx.category, 'food');
  assert.equal(tx.bank, 'HDFC');
});

test('parses card purchase and detects ICICI plus shopping merchant', () => {
  const tx = sample(
    'INR 2,499.00 spent on ICICI Credit Card ending 1234 at AMAZON on 29-Sep-26.',
    'ICICIB'
  );
  assert.equal(tx.amount, 2499);
  assert.equal(tx.merchant, 'AMAZON');
  assert.equal(tx.category, 'shopping');
  assert.equal(tx.bank, 'ICICI');
});

test('detects Canara Bank from sender ID and extracts NEFT payee', () => {
  const tx = sample(
    'Rs 5,000 debited from A/c XX4321 for NEFT to RAHUL SHARMA Ref 123456.',
    'CANBNK'
  );
  assert.equal(tx.amount, 5000);
  assert.equal(tx.merchant, 'RAHUL SHARMA');
  assert.equal(tx.bank, 'Canara Bank');
});

test('detects Indian Overseas Bank from message text', () => {
  const tx = sample(
    'Indian Overseas Bank: A/c XX7788 debited INR 800 to IRCTC via UPI Ref 1234.'
  );
  assert.equal(tx.bank, 'Indian Overseas Bank');
  assert.equal(tx.merchant, 'IRCTC');
  assert.equal(tx.category, 'transport');
});

test('detects UCO Bank and grocery merchants', () => {
  const tx = sample(
    'UCO Bank A/c XX1234 debited by Rs. 350 at DMART on 29-Sep-26.'
  );
  assert.equal(tx.bank, 'UCO Bank');
  assert.equal(tx.merchant, 'DMART');
  assert.equal(tx.category, 'groceries');
});

test('detects IDFC First Bank variant and health merchant', () => {
  const tx = sample(
    'Rs. 700 paid to APOLLO PHARMACY using your IDFC FIRST Bank card.',
    'IDFCFB'
  );
  assert.equal(tx.bank, 'IDFC First Bank');
  assert.equal(tx.merchant, 'APOLLO PHARMACY');
  assert.equal(tx.category, 'health');
});

test('detects Bank of Baroda sender variant', () => {
  const tx = sample(
    'Your Bank of Baroda A/c XX5555 has been debited by Rs 1,800.'
  );
  assert.equal(tx.bank, 'BOB');
});

test('detects PhonePe sender ID variant and Paytm sender variant', () => {
  const phonePe = sample(
    'Rs. 299 paid to SWIGGY via UPI Ref 12345.',
    'PHONPE'
  );
  assert.equal(phonePe.bank, 'PhonePe');

  const paytm = sample(
    'Rs. 220 paid to UBER for ride. Ref 7788.',
    'PYTM'
  );
  assert.equal(paytm.bank, 'Paytm');
  assert.equal(paytm.category, 'transport');
});

test('parses ATM cash withdrawal as debit', () => {
  const tx = sample(
    'SBI: ATM cash withdrawal of Rs 5,000 from A/c XX9911 at NCR ATM.'
  );
  assert.equal(tx.amount, 5000);
  assert.equal(tx.type, 'debit');
  assert.equal(tx.bank, 'SBI');
});

test('parses a refund as credit and identifies the refund merchant', () => {
  const tx = sample(
    'Refund of Rs. 299 has been processed by ZOMATO and credited to your account.'
  );
  assert.equal(tx.amount, 299);
  assert.equal(tx.type, 'credit');
  assert.equal(tx.merchant, 'ZOMATO');
  assert.equal(tx.category, 'food');
});

test('detects grocery delivery merchants instead of treating them as food', () => {
  const tx = sample(
    'Rs. 640 paid to BLINKIT via UPI Ref 9988.',
    'HDFCBK'
  );
  assert.equal(tx.merchant, 'BLINKIT');
  assert.equal(tx.category, 'groceries');
});

test('detects bills and subscriptions', () => {
  const tx = sample(
    'Rs. 649 paid to NETFLIX using UPI Ref 111222.',
    'PYTM'
  );
  assert.equal(tx.category, 'bills');
});

test('detects a raw UPI ID as the merchant', () => {
  const tx = sample(
    'Rs. 450 sent to foodcorner@upi from your account.'
  );
  assert.equal(tx.merchant, 'foodcorner@upi');
});

test('ignores OTP messages', () => {
  assert.equal(
    parseSms('Your OTP is 123456 for login. Do not share this code.'),
    null
  );
});

test('ignores password and verification messages', () => {
  assert.equal(
    parseSms('Your verification code is 482901. Do not share your password.'),
    null
  );
});

test('ignores non-transaction promotional SMS', () => {
  assert.equal(
    parseSms('Get 20% cashback on shopping today. Offer valid till midnight.'),
    null
  );
});
