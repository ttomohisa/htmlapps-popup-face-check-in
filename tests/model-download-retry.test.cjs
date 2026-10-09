const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('verified model downloads retry only transient failures with bounded backoff', () => {
  const executable = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const result = spawnSync(executable, ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'helpers/model-download-retry.ps1')], {
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, POWERSHELL_TELEMETRY_OPTOUT: '1', POWERSHELL_UPDATECHECK: 'Off' }
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Model download retry checks passed/);
});
