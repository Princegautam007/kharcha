'use strict';
// Builds a throwaway page used to take the screenshot in
// docs/images/export-buttons.png. It seeds a few sample transactions into
// localStorage and removes the sections above the transaction list, so the
// picture shows the "Your data" block with real content.
//
// Usage (from the repository root):
//   node scripts/make-screenshot.js
//   "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new \
//     --disable-gpu --hide-scrollbars --user-data-dir=%TEMP%\kharcha-shot \
//     --virtual-time-budget=4000 --window-size=560,700 \
//     --screenshot=_shot-crop.png file:///<repo>/_shot.html
//
// Then crop the empty space below the buttons (the PNG is 560x450 in the
// committed image). Delete _shot.html and _shot-crop.png afterwards.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const now = new Date();
const iso = (day, hour) => new Date(now.getFullYear(), now.getMonth(), day, hour, 15).toISOString();
const key = `kharcha_${now.getFullYear()}_${now.getMonth() + 1}`;
const day = Math.min(now.getDate(), 28);

const seed = [
  { id: 1, type: 'debit', amount: 249, category: 'food', merchant: 'Swiggy', date: iso(day, 21), source: 'sms', bank: 'HDFC', smsKey: 'a' },
  { id: 2, type: 'debit', amount: 1250, category: 'transport', merchant: 'Uber', date: iso(Math.max(day - 1, 1), 9), source: 'sms', bank: 'ICICI', smsKey: 'b' },
  { id: 3, type: 'debit', amount: 640, category: 'groceries', merchant: 'Blinkit', date: iso(Math.max(day - 2, 1), 19), source: 'manual' },
];

const seedScript = `<script>
localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(seed))});
localStorage.setItem('kharcha_budgets', ${JSON.stringify(JSON.stringify({ food: 5000, transport: 3000 }))});
</script>
`;

// Screenshot copy only: keep the transactions list and the "Your data" block,
// drop the sections above so the picture is tight.
const trimScript = `<script>
(function () {
  var main = document.querySelector('.main');
  var kids = Array.prototype.slice.call(main.children);
  kids.slice(0, Math.max(0, kids.length - 5)).forEach(function (el) { el.remove(); });
})();
</script>
`;

const marker = '// ---- CONSTANTS ----';
const at = html.indexOf(marker);
if (at === -1) throw new Error('could not find the app script');
const scriptStart = html.lastIndexOf('<script>', at);
if (scriptStart === -1) throw new Error('could not find the opening script tag');

const seeded = html.slice(0, scriptStart) + seedScript + html.slice(scriptStart);
const trimmed = seeded.replace('</body>', trimScript + '</body>');
fs.writeFileSync(path.join(root, '_shot.html'), trimmed, 'utf8');
console.log('wrote _shot.html with', seed.length, 'sample expenses under', key);
