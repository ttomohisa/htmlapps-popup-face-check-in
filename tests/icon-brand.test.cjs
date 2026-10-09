// Changes to the supplied artwork or any stale header/favicon/release copy fail this contract.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const asset = read('assets/favicon.svg');
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)=(["'])(.*?)\2/g)].map(m => [m[1], m[3]]));
function favicon(html, label) {
  const link = [...html.matchAll(/<link\b[^>]*>/g)].map(m => attrs(m[0])).find(a => a.rel === 'icon');
  assert.ok(link && link.href.startsWith('data:image/svg+xml'), label + ': embedded favicon');
  const data = link.href.slice(link.href.indexOf(',') + 1);
  return link.href.startsWith('data:image/svg+xml;base64,') ? Buffer.from(data, 'base64').toString('utf8') : decodeURIComponent(data);
}

test('canonical asset preserves the supplied SVG bytes, color, canvas and corners', () => {
  assert.equal(createHash('sha256').update(asset).digest('hex'), '3bd8857600fa478ef759b53af12938ad74a77e6b5cf85ebd04a5a6447bffa44b');
  assert.match(asset, /viewBox="0 0 64 64"/);
  assert.match(asset, /<rect width="64" height="64" rx="16" fill="#16624f"\/>/);
});

for (const file of ['src/index.template.html', 'dist/index.html', 'popup-face-check-in.html']) {
  test(file + ': favicon and header preserve the complete canonical artwork', () => {
    const html = read(file);
    assert.equal(favicon(html, file), asset, file + ': favicon asset parity');
    const header = html.match(/<header\b[\s\S]*?<\/header>/)[0];
    const mark = header.match(/<div class="brand-mark" aria-hidden="true">\s*(<svg\b[\s\S]*?<\/svg>)/);
    assert.ok(mark, file + ': decorative header icon');
    assert.equal(mark[1], asset.trimEnd(), file + ': header asset parity');
    assert.match(html, /\.brand-mark svg\{display:block;width:38px;height:38px\}/);
  });
}

test('download alias matches the generated readable HTML byte-for-byte', () => {
  assert.equal(read('popup-face-check-in.html'), read('dist/index.html'));
});

test('brand regression runs separately from Node-free PowerShell checks in every workflow', () => {
  assert.doesNotMatch(read('scripts/check-repository.ps1'), /(?:^|\n)\s*&?\s*node\b/i);
  for (const name of ['build-standalone.yml', 'deploy-pages.yml', 'preview.yml']) {
    assert.match(read('.github/workflows/' + name), /run: node --test \.\/tests\/icon-brand\.test\.cjs/);
  }
});
