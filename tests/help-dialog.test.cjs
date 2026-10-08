const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute only the production Help bindings. This does not exercise enrollment,
// matching, storage or native browser modal behavior.
const root = path.join(__dirname, '..');
const targets = process.argv.slice(2);
if (!targets.length) targets.push(process.env.APP_HTML || 'src/index.template.html');
for (const target of targets) {
  const html = fs.readFileSync(path.resolve(root, target), 'utf8');
  const start = html.indexOf("$('helpBtn').addEventListener");
  const end = html.indexOf("$('langBtn').addEventListener", start);
  assert.ok(start >= 0 && end > start, 'production Help bindings exist');
  const bindings = html.slice(start, end);
  function element() {
    const listeners = new Map();
    return {
      focused: false,
      focus() { this.focused = true; },
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
      },
      dispatch(type, event = {}) { for (const listener of listeners.get(type) || []) listener(event); }
    };
  }
  function harness() {
    const opener = element(), closeButton = element(), dialog = element();
    Object.assign(dialog, {
      open: false, closeCount: 0,
      getBoundingClientRect: () => ({ left: 282.5, right: 882.5, top: 56.78, bottom: 700.22 }),
      showModal() { this.open = true; },
      close() { this.open = false; this.closeCount++; this.dispatch('close'); }
    });
    const elements = { helpBtn: opener, helpClose: closeButton, helpDialog: dialog };
    vm.runInNewContext(bindings, { $: id => elements[id] }, { timeout: 1000 });
    return { opener, closeButton, dialog };
  }
  test(`${target}: an actual outside Help click closes and restores opener focus`, () => {
    for (const [clientX, clientY] of [[90, 100], [900, 100], [500, 40], [500, 730]]) {
      const { opener, dialog } = harness();
      opener.dispatch('click');
      dialog.dispatch('click', { target: dialog, clientX, clientY });
      assert.equal(dialog.open, false, `outside point ${clientX},${clientY}`);
      assert.equal(dialog.closeCount, 1);
      assert.equal(opener.focused, true);
    }
  });
  test(`${target}: content, padding and boundary clicks retain Help`, () => {
    const { opener, dialog } = harness();
    opener.dispatch('click');
    for (const [clientX, clientY] of [[500, 100], [282.5, 56.78], [882.5, 700.22]]) {
      dialog.dispatch('click', { target: dialog, clientX, clientY });
      assert.equal(dialog.open, true);
    }
    dialog.dispatch('click', { target: {}, clientX: 500, clientY: 100 });
    dialog.dispatch('click', { target: dialog });
    assert.equal(dialog.open, true);
    assert.equal(dialog.closeCount, 0);
    assert.equal(opener.focused, false);
  });
  test(`${target}: closed Help ignores outside clicks without stealing focus`, () => {
    const { opener, dialog } = harness();
    dialog.dispatch('click', { target: dialog, clientX: 90, clientY: 100 });
    assert.equal(dialog.closeCount, 0);
    assert.equal(opener.focused, false);
  });
  test(`${target}: Close and the native close event restore the Help opener`, () => {
    const { opener, closeButton, dialog } = harness();
    opener.dispatch('click');
    closeButton.dispatch('click');
    assert.equal(dialog.open, false);
    assert.equal(opener.focused, true);
    opener.focused = false;
    opener.dispatch('click');
    dialog.close();
    assert.equal(opener.focused, true);
  });
}
test('all publishing workflows require source and built Help regressions', () => {
  for (const name of ['build-standalone.yml', 'deploy-pages.yml', 'preview.yml']) {
    const yaml = fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');
    assert.match(yaml, /run: node \.\/tests\/help-dialog\.test\.cjs src\/index\.template\.html dist\/index\.html/);
  }
});
