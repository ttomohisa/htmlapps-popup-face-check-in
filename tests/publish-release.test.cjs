const test = require('node:test');
const assert = require('node:assert/strict');
const { publishRelease } = require('../.github/scripts/publish-release.cjs');

const sha = 'a'.repeat(40);
function scenario({ release, tagCommit, failUpload = false } = {}) {
  const writes = [];
  function gh(...args) {
    const [cmd, op, ...rest] = args;
    if (cmd === 'api' && op.endsWith('/releases?per_page=100')) return release ? JSON.stringify(release) : '';
    if (cmd === 'api' && op.includes('/git/matching-refs/')) return tagCommit || '';
    if (cmd === 'api' && op.includes('/commits/refs/tags/')) return tagCommit;
    if (cmd === 'api' && op.endsWith('/git/refs')) {
      assert.ok(rest.includes('sha=' + sha)); tagCommit = sha; writes.push('tag'); return '';
    }
    if (cmd !== 'release') throw Error('Unexpected command ' + args);
    writes.push(op);
    if (op === 'create') {
      assert.ok(rest.includes('--verify-tag') && rest.includes('--draft') && rest.includes(sha));
      release = { draft:true, target_commitish:sha };
    }
    if (op === 'upload' && failUpload) { failUpload = false; throw Error('Upload failed'); }
    if (op === 'edit') { assert.ok(rest.includes('--draft=false')); release.draft = false; }
    return '';
  }
  return { writes, run: () => publishRelease({ gh, sha, repo:'owner/repo', version:'1.1.0', dir:'assets' }) };
}
test('tag the merged commit and publish after uploading the assets', () => {
  const s = scenario(); s.run(); s.run();
  assert.deepEqual(s.writes, ['tag','create','upload','edit']);
});
test('a failed upload leaves a draft that the same commit can finish', () => {
  const s = scenario({failUpload:true});
  assert.throws(s.run, /Upload failed/);
  assert.deepEqual(s.writes, ['tag','create','upload']);
  s.run();
  assert.deepEqual(s.writes.slice(3), ['upload','edit']);
});
test('published versions are skipped and other commits cannot take over a tag or draft', () => {
  const published = scenario({release:{draft:false}}); published.run();
  assert.deepEqual(published.writes, []);
  for (const state of [{tagCommit:'elsewhere'}, {release:{draft:true, target_commitish:'elsewhere'}}]) {
    const s = scenario(state);
    assert.throws(s.run, /commit/);
    assert.deepEqual(s.writes, []);
  }
});
