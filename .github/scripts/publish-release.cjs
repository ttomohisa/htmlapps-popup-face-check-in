'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const config = require('../../app.config.json');

function publishRelease({ gh, sha, repo, version, dir }) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || !/^[0-9a-f]{40}$/.test(sha)) {
    throw Error('Expected a stable app version and a full commit SHA.');
  }
  const tag = 'v' + version;
  const api = 'repos/' + repo;
  // The list endpoint includes drafts when called with the publishing token.
  const found = gh('api', api + '/releases?per_page=100', '--paginate', '--jq',
    `.[] | select(.tag_name == "${tag}") | {draft,target_commitish}`);
  if (found) {
    const release = JSON.parse(found);
    if (!release.draft) { console.log(tag + ' is already published.'); return; }
    if (release.target_commitish !== sha) throw Error(tag + ' has a draft for another commit.');
  }

  const ref = 'refs/tags/' + tag;
  const existing = gh('api', api + '/git/matching-refs/tags/' + tag, '--jq',
    `.[] | select(.ref == "${ref}") | .object.sha`);
  if (!existing) {
    gh('api', api + '/git/refs', '--method', 'POST', '-f', 'ref=' + ref, '-f', 'sha=' + sha);
  } else if (existing !== sha && gh('api', api + '/commits/' + ref, '--jq', '.sha') !== sha) {
    throw Error(tag + ' already points to another commit.');
  }

  if (!found) {
    gh('release', 'create', tag, '--repo', repo, '--target', sha, '--verify-tag', '--draft',
      '--title', config.name + ' ' + tag, '--generate-notes');
  }
  const base = config.repository.name + '-' + tag;
  const files = [base + '.html', base + '.zip', 'SHA256SUMS.txt'].map(name => path.join(dir, name));
  gh('release', 'upload', tag, '--repo', repo, '--clobber', ...files);
  gh('release', 'edit', tag, '--repo', repo, '--draft=false');
}

if (require.main === module) {
  const gh = (...args) => execFileSync('gh', args, { encoding:'utf8', stdio:['ignore','pipe','inherit'] }).trim();
  publishRelease({ gh, sha:process.env.GITHUB_SHA, repo:process.env.GITHUB_REPOSITORY,
    version:config.version, dir:process.argv[2] });
}

module.exports = { publishRelease };
