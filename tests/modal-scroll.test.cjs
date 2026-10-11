// Source/artifact contracts only. Native wheel/touch scrolling, focus, Escape,
// camera and viewport reachability require separate real-browser verification.
// Removing either root lock, using [open], or changing dialog geometry must fail.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const target = process.env.APP_HTML || 'src/index.template.html';
const html = fs.readFileSync(path.resolve(root, target), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(css, 'Application stylesheet exists');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({
  selector: match[1].trim(), body: match[2].trim()
}));
const compact = value => value.replace(/\s+/g, '');

test('both page roots lock overflow only while a native modal exists', () => {
  for (const tag of ['html', 'body']) {
    const rule = rules.find(rule => rule.selector.split(',').map(value => value.trim()).includes(`${tag}:has(dialog:modal)`));
    assert.ok(rule, `${tag} needs a native-modal-only overflow rule`);
    assert.equal(compact(rule.body).replace(/;$/, ''), 'overflow:hidden', 'The fix changes root overflow only');
  }
});

test('scanner/reception root locks remain unchanged and non-modal dialogs add no lock', () => {
  const existingLocks = [];
  for (const rule of rules) {
    for (const selector of rule.selector.split(',').map(value => value.trim())) {
      if (/^(?:html|body)(?=[:\s.#[]|$)/.test(selector) && /(?:^|;)\s*(?:overflow(?:-[xy])?\s*:\s*(?:hidden|clip)|position\s*:\s*fixed)\b/.test(rule.body) && !/^(?:html|body):has\(dialog:modal\)$/.test(selector)) {
        existingLocks.push([selector, compact(rule.body)]);
      }
    }
  }
  assert.deepEqual(existingLocks, [["body.reception-mode", "overflow-x:hidden"]], 'Preserve existing mobile/reception locks without adding [open] or unconditional locks');
});

test('all existing dialog, result and confirmation geometry remains unchanged', () => {
  const geometry = rules.filter(rule => /dialog|\.(?:result-body|confirm-body|confirm-actions)\b/.test(rule.selector) && !rule.selector.includes(':has(dialog:modal)'))
    .map(rule => [compact(rule.selector), compact(rule.body)]);
  assert.deepEqual(geometry, [
  [
    "dialog",
    "width:min(600px,calc(100%-28px));max-height:85vh;padding:0;border:1pxsolidvar(--line);border-radius:16px;background:var(--surface);box-shadow:020px60pxrgba(0,0,0,.18)"
  ],
  [
    "dialog::backdrop",
    "background:rgba(24,26,24,.32)"
  ],
  [
    ".dialog-head",
    "position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:14px16px;border-bottom:1pxsolidvar(--line);background:var(--surface)"
  ],
  [
    ".dialog-headh3",
    "margin:0"
  ],
  [
    ".dialog-close",
    "width:34px;height:34px;border:0;background:transparent;font-size:20px;cursor:pointer"
  ],
  [
    ".dialog-body",
    "padding:16px"
  ],
  [
    ".dialog-bodyh4",
    "margin:18px05px"
  ],
  [
    ".dialog-bodyh4:first-child",
    "margin-top:0"
  ],
  [
    ".dialog-bodyp,.dialog-bodyli",
    "color:var(--muted);font-size:12px"
  ],
  [
    ".failure-dialog-actions",
    "display:flex;justify-content:flex-end;gap:8px;margin-top:14px"
  ],
  [
    ".session-dialog",
    "width:min(680px,calc(100%-28px))"
  ],
  [
    ".file-dialog-summary",
    "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px014px"
  ],
  [
    ".file-dialog-summary>div",
    "padding:10px;border:1pxsolidvar(--line);border-radius:10px;background:var(--surface-muted)"
  ],
  [
    ".file-dialog-summarystrong",
    "display:block;font-size:18px"
  ],
  [
    ".file-dialog-summaryspan",
    "display:block;margin-top:2px;color:var(--muted);font-size:10px"
  ],
  [
    ".dialog-error",
    "min-height:18px;margin-top:8px;color:var(--danger);font-size:11px"
  ],
  [
    ".file-dialog-summary",
    "grid-template-columns:1fr1fr"
  ]
]);
});

test('the existing local-processing badge uses only a decorative shield', () => {
  const badges = [...html.matchAll(/<div class="local-badge">([\s\S]*?)<\/div>/g)];
  assert.equal(badges.length, 1, 'Keep exactly the existing badge');
  const badge = badges[0][1];
  assert.match(badge, /<svg[^>]*aria-hidden="true"/);
  assert.match(badge, /d="M12 3 4 6v5c0 5 3\.4 8\.7 8 10 4\.6-1\.3 8-5 8-10V6l-8-3Z"/);
  assert.doesNotMatch(badge, /<rect\b|href="#i-lock"/, 'The old padlock is absent from this badge');
  assert.match(badge, /完全ローカル処理/);
});

test('Japanese and English Help explain close routes without layout commentary', () => {
  const help = html.match(/<dialog id="helpDialog"[\s\S]*?<\/dialog>/)?.[0];
  const note = help?.match(/<p id="helpDialogScroll"[^>]*>([^<]+)<\/p>/)?.[0];
  assert.ok(note, 'Help scroll guidance exists');
  const attrs = Object.fromEntries([...note.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
  assert.doesNotMatch(attrs['data-ja'], /背景.*スクロール/);
  assert.match(attrs['data-ja'], /閉じる.*Esc.*外側/);
  assert.doesNotMatch(attrs['data-en'], /background.*scroll/i);
  assert.match(attrs['data-en'], /Close.*Esc.*outside/);
});
