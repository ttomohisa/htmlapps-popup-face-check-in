// Canonical Node regression gate. Build release copies first, then run this file.
// --source-only still runs every source test, including tool prerequisite tests.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const testPath = file => path.join(root, 'tests', file);
function makePlan({ sourceOnly = false, env = process.env } = {}) {
  const sourceTests = fs.readdirSync(path.join(root, 'tests'))
    .filter(file => /\.test\.(?:cjs|mjs)$/.test(file)).sort().map(testPath);
  if (!sourceTests.length) throw new Error('No regression tests found');
  // Give each child a fresh copy, so inherited selectors cannot bypass a gate
  // and the caller's environment needs no mutation or restoration.
  const step = (label, args, target) => ({ label, args, env: { ...env, APP_HTML: target } });
  const plan = [step('source regressions', ['--test', ...sourceTests], 'src/index.template.html')];
  if (sourceOnly) return plan;
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.config.json'), 'utf8'));
  const artifacts = [...new Set([config.build.output, 'popup-face-check-in.html'])];
  const runtimeTests = ['help-dialog.test.cjs', 'history-filters.test.cjs', 'manual-checkin.test.cjs', 'registration-rendering.test.cjs', 'runtime-localization.test.cjs', 'modal-scroll.test.cjs'].map(testPath);
  for (const artifact of artifacts) {
    plan.push(step(`${artifact}: application regressions`, ['--test', ...runtimeTests], artifact));
    plan.push(step(`${artifact}: header and version regressions`, [testPath('header-normalization.test.mjs'), artifact], artifact));
  }
  return plan;
}
function runSteps(plan, spawn = spawnSync) {
  for (const step of plan) {
    console.log(`Checking ${step.label}`);
    const result = spawn(process.execPath, step.args, { cwd: root, env: step.env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status || 1;
  }
  return 0;
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--source-only')) throw new Error('Usage: node scripts/test-regressions.cjs [--source-only]');
  process.exitCode = runSteps(makePlan({ sourceOnly: args.includes('--source-only') }));
}
module.exports = { makePlan, runSteps };
