// Exercise the actual validation plan and child-process failure handling without
// running nested tests. Child environments are copied, never assigned globally.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function runner() {
  const file = path.join(root, 'scripts/test-regressions.cjs');
  assert.ok(fs.existsSync(file), 'The canonical regression runner exists');
  return require(file);
}
test('canonical plan covers every source test and both release copies', () => {
  const { makePlan } = runner();
  const plan = makePlan();
  const files = fs.readdirSync(path.join(root, 'tests')).filter(file => /\.test\.(?:cjs|mjs)$/.test(file)).sort();
  assert.deepEqual(plan[0].args.slice(1), files.map(file => path.join(root, 'tests', file)));
  assert.equal(plan[0].args[0], '--test');
  assert.equal(plan[0].env.APP_HTML, 'src/index.template.html');
  for (const target of ['dist/index.html', 'popup-face-check-in.html']) {
    const steps = plan.filter(step => step.env.APP_HTML === target);
    assert.ok(steps.length > 0, target + ': artifact gate exists');
    assert.ok(steps.some(step => step.args.some(arg => arg.endsWith('modal-scroll.test.cjs'))));
    assert.ok(steps.some(step => step.args.some(arg => arg.endsWith('history-filters.test.cjs'))));
  }
  assert.equal(makePlan({ sourceOnly: true }).length, 1);
});
test('canonical runner preserves caller environment even on failure', () => {
  const { makePlan, runSteps } = runner();
  const before = { ...process.env };
  const caller = { SENTINEL: 'keep', APP_HTML: 'unexpected-selection.html' };
  const plan = makePlan({ env: caller });
  const calls = [];
  const spawn = (...args) => { calls.push(args); return { status: 7 }; };
  assert.equal(runSteps(plan, spawn), 7);
  assert.equal(calls.length, 1, 'Stop on the first failed validation step');
  assert.equal(calls[0][2].cwd, root);
  assert.equal(calls[0][2].env.APP_HTML, 'src/index.template.html');
  assert.equal(calls[0][2].env.SENTINEL, 'keep');
  assert.deepEqual(caller, { SENTINEL: 'keep', APP_HTML: 'unexpected-selection.html' });
  assert.deepEqual({ ...process.env }, before);
});
test('spawn errors and signal termination cannot be reported as success', () => {
  const { makePlan, runSteps } = runner();
  assert.throws(() => runSteps(makePlan(), () => ({ error: new Error('Synthetic spawn failure') })), /Synthetic spawn failure/);
  assert.equal(runSteps(makePlan(), () => ({ status: null, signal: 'SIGTERM' })), 1);
});

test('every workflow requires the full canonical gate without changing Node-free PowerShell checks', () => {
  for (const name of ['build-standalone.yml', 'deploy-pages.yml', 'preview.yml']) {
    const yaml = fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');
    assert.match(yaml, /actions\/setup-node@/);
    assert.match(yaml, /run: node \.\/scripts\/test-regressions\.cjs/);
    assert.ok(yaml.indexOf('run: node ./scripts/test-regressions.cjs') > yaml.indexOf('run: ./scripts/check-repository.ps1'));
  }
  const check = fs.readFileSync(path.join(root, 'scripts/check-repository.ps1'), 'utf8');
  assert.doesNotMatch(check, /(?:^|\n)\s*&?\s*node\b/i);
});
