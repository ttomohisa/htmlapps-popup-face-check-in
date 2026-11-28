const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/app-harness.cjs');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const h = harness({ people: [{ id: 'a', name: 'Sample', embeddings: [[1]] }] });
  h.run('people[0].embeddingModel = EMBEDDING_MODEL; detector = {};');
  h.context.console = { error() {} };
  const track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
  const media = { getTracks: () => [track], getVideoTracks: () => [track] };
  const grant = deferred();
  h.context.navigator.mediaDevices = { getUserMedia: () => grant.promise };
  Object.assign(h.get('cameraVideo'), { play: async () => {}, pause() {} });
  h.get('cameraOverlay').getContext = () => ({ clearRect() {} });
  return { h, grant, media, track };
}

test('leaving reception before camera permission is granted releases the late stream', async () => {
  const { h, grant, media, track } = setup();
  const request = h.run('startCamera()');
  h.run('go("history")');
  grant.resolve(media);
  await request;
  assert.equal(track.readyState, 'ended');
  assert.equal(h.run('cameraActive'), false);
  assert.equal(h.get('cameraVideo').srcObject ?? null, null);
});

test('a camera stream is released when video playback fails', async () => {
  const { h, grant, media, track } = setup();
  h.get('cameraVideo').play = async () => { throw new Error('Playback failed'); };
  grant.resolve(media);
  await h.run('startCamera()');
  assert.equal(track.readyState, 'ended');
  assert.equal(h.get('cameraVideo').srcObject, null);
  assert.equal(h.run('cameraActive'), false);
});

test('canceling preflight while permission is pending leaves reception closed', async () => {
  const { h, grant, media, track } = setup();
  const dialog = h.get('preflightDialog');
  Object.assign(dialog, { open: true, close() { this.open = false; this.dispatch('close'); } });
  h.run('bindUi()');
  const request = h.get('preflightStart').dispatch('click');
  h.get('preflightCancel').dispatch('click');
  grant.resolve(media);
  await request;
  assert.equal(track.readyState, 'ended');
  assert.equal(h.run('receptionMode'), false);
});

test('an inference failure arriving after a camera stop preserves stopped feedback', async () => {
  const { h } = setup();
  const inference = deferred();
  h.context.inference = inference.promise;
  h.run('cameraActive = true; videoToCanvas = () => ({}); detectExtract = () => inference;');
  const frame = h.run('cameraTick()');
  h.run('stopCamera()');
  inference.reject(new Error('No face detected'));
  await frame;
  assert.equal(h.get('cameraStatusText').textContent, 'Camera stopped');
  assert.equal(h.get('cameraGuide').textContent, '');
});

test('a failed photo match clears the previous candidate and displays the reason', async () => {
  const { h } = setup();
  h.context.URL.createObjectURL = () => 'blob:test';
  h.run(`let displayedCandidate = people[0], displayedMessage = '';
    setResult = (result, feedback) => {
      displayedCandidate = result?.top?.p ?? null;
      displayedMessage = feedback.sub;
    };
    fileToCanvas = async () => ({});
    detectExtract = async () => { throw new Error('No face detected'); };`);
  await h.run('matchFile({})');
  assert.equal(h.run('displayedCandidate'), null);
  assert.match(h.run('displayedMessage'), /No face detected/);
});

test('candidate score captions use the current language on first render', () => {
  for (const [language, caption] of [['en', 'Similarity'], ['ja', '一致度']]) {
    const h = harness({ renderResults: true });
    h.context.selectedLanguage = language;
    h.run(`lang = selectedLanguage;
      const candidate = { p: { id: 'a', name: 'Sample' }, score: 0.95 };
      setResult({ state: 'match', top: candidate, scores: [candidate], gap: 1 });`);
    assert.ok(h.get('ranking').innerHTML.includes('>' + caption + '</span>'), language);
  }
});
