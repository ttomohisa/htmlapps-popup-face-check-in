const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const removed = [
  "ダイアログを開いている間は背景がスクロールしません。",
  "The background does not scroll while a dialog is open. "
];
for (const file of ['src/index.template.html', 'popup-face-check-in.html']) {
  test(`${file}: user help omits layout implementation commentary`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const text of removed) assert.ok(!html.includes(text), `Remove implementation copy from ${file}`);
  });
}
