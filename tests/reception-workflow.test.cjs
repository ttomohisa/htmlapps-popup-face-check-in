const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, source } = require('./helpers/app-harness.cjs');

test('name-only attendees survive session storage and registration export without face data or history', async () => {
  const h = harness();
  h.run('bindUi()');
  h.get('attendeeName').value = '  Guest A  ';
  await h.get('nameOnlyForm').dispatch('submit');
  assert.equal(h.people().length, 1);
  const p = h.people()[0];
  assert.equal(p.name, 'Guest A');
  assert.equal(p.thumbnail, null);
  assert.equal(h.run('compatiblePeople().length + incompatiblePeople().length'), 0);
  h.context.saved = await h.run('serializeTempPerson(people[0])');
  assert.equal(h.run('hydrateTempPerson(saved).registrationType'), 'name-only');
});

test('name-only exports round-trip, old photo files remain valid and malformed records are rejected', async () => {
  const h = harness();
  h.context.atob = atob;
  h.context.btoa = btoa;
  h.context.photoVector = Buffer.alloc(128 * 4).toString('base64');
  h.get('attendeeName').value = 'Guest B';
  await h.run('registerNameOnly()');
  await h.run('manualCheckin(people[0].id)');
  const file = await h.run('buildRegistrationPayload()');
  h.context.file = file;
  assert.equal(file.formatVersion, 2);
  assert.equal(file.biometricDataIncluded, false);
  assert.equal(h.run('validateRegistrationPayload(file)'), true);
  assert.equal(h.run('hydrateRegistrationPerson(file.people[0]).registrationType'), 'name-only');
  assert.equal(file.people[0].checkedInAt, undefined);
  assert.equal(file.people[0].checkEvents, undefined);
  assert.throws(() => h.run('validateRegistrationPayload({...file,formatVersion:1})'));
  const legacy = h.run("({...file, formatVersion:1, people:[{id:'existing',name:'A',thumbnail:{data:'AA=='},embeddings:[photoVector]}]})");
  h.context.legacy = legacy;
  assert.equal(h.run('validateRegistrationPayload(legacy)'), true);
  assert.throws(() => h.run('validateRegistrationPayload({...legacy,people:[{...legacy.people[0],embeddings:[]}]})'));
});

test('preflight can open the roster when camera permission is denied and registration when empty', async () => {
  const h = harness({ people: [{ id:'p', name:'A', embeddings:[[1]] }] });
  h.run('people[0].embeddingModel=EMBEDDING_MODEL; detector=recognizer=yunetSession=sfaceSession={}');
  h.context.navigator.mediaDevices = { getUserMedia() { throw Error('Must not open the camera'); } };
  h.context.navigator.permissions = { query: async () => ({state:'denied'}) };
  const actions = [];
  h.context.record = action => actions.push(action);
  h.run("openManualReception=()=>record('roster'); go=view=>record(view); bindUi()");
  await h.run('enterReceptionMode()');
  assert.match(h.get('preflightError').textContent, /Camera unavailable/);
  assert.equal(h.get('preflightStart').disabled, true);
  assert.equal(h.get('preflightManual').hidden, false);
  assert.equal(h.get('preflightRegister').hidden, true);
  h.get('preflightManual').dispatch('click');
  h.run('people=[]');
  await h.run('enterReceptionMode()');
  assert.equal(h.get('preflightManual').hidden, true);
  h.get('preflightRegister').dispatch('click');
  assert.deepEqual(actions, ['roster', 'register']);
});

test('setup language choice keeps the current choices and acknowledgement', () => {
  const h = harness();
  h.run("lang='ja'; bindUi(); openSessionDialog()");
  h.get('sessionDialog').open = true;
  h.get('privacyAck').checked = true;
  h.get('sessionStartBtn').disabled = false;
  h.get('sessionLanguage').value = 'en';
  h.get('sessionLanguage').dispatch('change');
  assert.equal(h.get('sessionDialogTitle').textContent, 'Start Pop-up Face Check-in');
  assert.equal(h.get('privacyAck').checked, true);
  assert.equal(h.get('sessionStartBtn').disabled, false);
});

test('finish shows the unfiltered record count and explicitly separates export and deletion', async () => {
  const h = harness({mode:'checkin',people:[{id:'p',name:'Guest',checkedInAt:1800000000000,checkedInMethod:'manual'}]});
  h.run("bindUi(); historyQuery='unmatched'");
  h.get('finishSessionBtn').dispatch('click');
  assert.equal(String(h.get('finishCount').textContent), '1');
  h.get('finishCsvBtn').dispatch('click');
  assert.equal(h.downloads.length, 1);
  assert.match(await h.downloads[0].blob.text(), /Guest/);
  h.get('finishDeleteBtn').dispatch('click');
  assert.equal(h.people().length, 1);
  assert.equal(String(h.get('deletePeopleCount').textContent), '1');
});

test('retrying a failed or double-submitted name registration creates just one record', async () => {
  const h = harness({deferred:true});
  h.context.console = {error() {}};
  h.get('attendeeName').value = '   ';
  await h.run('registerNameOnly()');
  assert.equal(h.writes.length, 0);
  h.get('attendeeName').value = 'Retry Guest';
  const failed = h.run('registerNameOnly()');
  h.reject();
  await failed;
  assert.equal(h.people().length, 0);
  assert.equal(h.get('attendeeName').value, 'Retry Guest');
  const first = h.run('registerNameOnly()');
  await h.run('registerNameOnly()');
  h.release();
  await first;
  assert.equal(h.writes.length, 2);
  assert.equal(h.people().length, 1);
});

test('mixed files preserve existing face registrations, and photo-only exports retain version 1', async () => {
  const h = harness();
  h.context.atob = atob;
  h.context.btoa = btoa;
  h.context.fixtureThumbnail = new Blob([new Uint8Array([42])], {type:'image/png'});
  h.run("people.push({id:'photo',name:'Photo Guest',thumbnail:fixtureThumbnail,embeddings:[new Float32Array(128)],embeddingModel:EMBEDDING_MODEL})");
  const oldFile = await h.run('buildRegistrationPayload()');
  assert.equal(oldFile.formatVersion, 1);
  h.get('attendeeName').value = 'Manual Guest';
  await h.run('registerNameOnly()');
  h.context.mixed = await h.run('buildRegistrationPayload()');
  assert.equal(h.context.mixed.biometricDataIncluded, true);
  assert.equal(h.context.mixed.formatVersion, 2);
  assert.deepEqual(h.context.mixed.people[0].embeddings, oldFile.people[0].embeddings);
  assert.ok(h.run('validateRegistrationPayload(mixed)'));
  assert.equal(h.run("registrationRecordForMode(hydrateRegistrationPerson(mixed.people[1]),'manual').registrationType"),'name-only');
  const invalid = structuredClone(h.context.mixed);
  invalid.people[1].thumbnail = invalid.people[0].thumbnail;
  h.context.invalid = invalid;
  assert.throws(() => h.run('validateRegistrationPayload(invalid)'));
});

test('camera and manual actions precede the preview in keyboard and visual order', () => {
  const panel = source.split('<section id="view-check"')[1].split('</section>')[0];
  for (const id of ['cameraStartBtn','checkManualBtn']) {
    const pos = panel.indexOf('id="'+id+'"');
    assert.ok(pos >= 0 && pos < panel.indexOf('id="cameraStage"'), id);
  }
});

test('duplicate-name hints survive storage, retention changes and encrypted-roster payloads', async () => {
  const h = harness({ people: [{ id: 'first', name: '山田　葵', registrationType: 'name-only' }] });
  h.get('attendeeName').value = '山田 葵';
  h.get('attendeeHint').value = '午後組';
  await h.run('registerNameOnly()');
  assert.equal(h.people()[1].nameHint, '午後組');
  h.context.saved = await h.run('serializeTempPerson(people[1])');
  assert.equal(h.run('hydrateTempPerson(saved).nameHint'), '午後組');
  h.context.file = await h.run('buildRegistrationPayload()');
  assert.equal(h.run("registrationRecordForMode(hydrateRegistrationPerson(file.people[1]),'manual').nameHint"), '午後組');
  await h.run('manualCheckin(people[1].id)');
  assert.match(h.toasts.at(-1)[0], /午後組/);
  h.run('exportPeopleCsv()');
  assert.doesNotMatch(await h.downloads.at(-1).blob.text(), /午後組/);
});

test('walk-in registration survives a failed write and a repeated activation without checking anyone in', async () => {
  const h = harness({ deferred: true });
  h.get('manualReceptionDialog').open = true;
  h.get('manualReceptionSearch').value = 'Walk-in';
  const failed = h.run('registerWalkIn()');
  h.reject(); await failed;
  assert.equal(h.people().length, 0);
  const retry = h.run('registerWalkIn()');
  await h.run('registerWalkIn()');
  h.release(); await retry;
  await h.run('registerWalkIn()');
  assert.equal(h.people().length, 1);
  assert.equal(h.run('historyRows().length'), 0);
  assert.equal(h.get('manualReceptionSearch').value, 'Walk-in');
});

for (const mode of ['checkin', 'entryexit']) {
  test(mode + ' Undo keeps the saved record on a failed write and can be retried', async () => {
    const h = harness({ mode, people: [{id:'person', name:'Guest'}], deferred:true });
    const record = h.run("manualCheckin('person')");
    h.release(); await record;
    const undo = h.toasts.at(-1)[1];
    const failedUndo = undo();
    h.reject(); await failedUndo;
    assert.equal(h.run('historyRows().length'), 1);
    const retry = h.toasts.at(-1)[1]();
    h.release(); await retry;
    assert.equal(h.run('historyRows().length'), 0);
  });
}

for (const mode of ['checkin', 'entryexit']) {
  test(mode + ' history cancellation and restoration can both retry a failed save', async () => {
    const event = { id: 'entry', at: 1800000000000, type: 'in', method: 'face', score: 0.8 };
    const person = { id: 'p', name: 'P', checkedInAt: event.at, checkedInMethod: 'face',
      checkedInScore: event.score, checkEvents: mode === 'entryexit' ? [event] : [] };
    const h = harness({ mode, people: [person], deferred: true });
    h.run("bindUi(); resetCheckin('p')");
    const confirm = () => h.get('resetCheckinConfirm').dispatch('click');
    const failed = confirm();
    h.reject(); await Promise.allSettled([failed]);
    assert.equal(h.run('historyRows().length'), 1);
    const retry = confirm();
    h.release(); await retry;
    assert.equal(h.run('historyRows().length'), 0);
    const restore = h.toasts.at(-1)[1];
    const failedRestore = restore();
    h.reject(); await Promise.allSettled([failedRestore]);
    assert.equal(h.run('historyRows().length'), 0);
    const restored = h.toasts.at(-1)[1]();
    h.release(); await restored;
    assert.equal(h.run('historyRows().length'), 1);
    assert.equal(h.people()[0].checkedInScore, event.score);
    assert.equal(h.people()[0].checkedInMethod, 'face');
  });
}

test('failed roster rename keeps the saved name and concurrent check-in persists the new name', async () => {
  const { element } = require('./helpers/app-harness.cjs');
  const h = harness({ mode:'checkin', people: [{ id:'p', name:'Before' }], deferred:true });
  const input = element({ name: 'p' });
  h.selectors.set('[data-name]', [input]);
  h.run('bindCards()');
  input.value = 'After';
  const failed = input.dispatch('change');
  h.reject(); await Promise.allSettled([failed]);
  assert.equal(h.people()[0].name, 'Before');
  assert.equal(input.value, 'Before');
  input.value = 'After';
  const rename = input.dispatch('change'), record = h.run("manualCheckin('p')");
  h.release(); await rename;
  h.release(); await record;
  assert.equal(h.writes.at(-1).name, 'After');
  assert.equal(h.writes.at(-1).checkedInAt, h.people()[0].checkedInAt);
});

test('removing an extra photo and undoing it preserve the saved vectors on failure', async () => {
  const h = harness({ people: [{ id:'p', name:'P', embeddings:[[1],[2],[3]] }], deferred:true });
  h.run("bindUi(); removeLastEmbedding('p')");
  const confirm = () => h.get('removeEmbeddingConfirm').dispatch('click');
  const failed = confirm();
  h.reject(); await Promise.allSettled([failed]);
  assert.equal(h.run('embeddingCount(people[0])'), 3);
  const retry = confirm();
  h.release(); await retry;
  assert.equal(h.run('embeddingCount(people[0])'), 2);
  const undo = h.toasts.at(-1)[1]();
  h.reject(); await Promise.allSettled([undo]);
  assert.equal(h.run('embeddingCount(people[0])'), 2);
  const restore = h.toasts.at(-1)[1]();
  h.release(); await restore;
  assert.deepEqual(Array.from(h.people()[0].embeddings, e => e[0]), [1,2,3]);
});

test('a synchronous failure staging a persistent snapshot aborts its pending clear', async () => {
  const h = harness();
  let aborted = false;
  h.context.failingTransaction = { objectStore: () => ({ clear() {}, put() { throw Error('Failed to stage record'); } }),
    abort() { aborted = true; } };
  h.run('db={transaction:()=>failingTransaction}');
  await assert.rejects(h.run("tx('readwrite', store => { store.clear(); store.put({}); })"), /Failed to stage record/);
  assert.equal(aborted, true);
});

test('canceling a pending decryption keeps its roster out of a later import', async () => {
  const h = harness();
  let complete;
  h.context.decryptPending = () => new Promise(resolve => { complete = resolve; });
  h.get('registrationImportPassword').value = 'long enough';
  h.run("pendingRegistrationEnvelope={};decryptRegistrationEnvelope=decryptPending;fillRegistrationImportPreview=()=>{}");
  const attempt = h.run('decryptSelectedRegistration()');
  h.run('closeRegistrationImport();pendingRegistrationEnvelope={}');
  complete({people: [{id:'previous'}]}); await attempt;
  assert.equal(h.run('pendingRegistrationPayload'), null);
});

for (const action of ['clearAllBiometricData()', 'handleSessionExpiry()']) {
  test(action + ' discards late name registration and pending photo data', async () => {
    const h = harness({ deferred: true });
    h.context.console = { error() {}, warn() {} };
    h.get('attendeeName').value = 'Old guest';
    h.run("storageMode='today';sessionMeta.expiresAt=1;openSessionDialog=()=>{}");
    const name = h.run('registerNameOnly()');
    h.context.setTimeout = callback => { callback(); return 0; };
    let finishPhoto, startedPhoto;
    const detecting = new Promise(resolve => { startedPhoto = resolve; });
    h.context.detectPhoto = () => {
      startedPhoto();
      return new Promise(resolve => { finishPhoto = resolve; });
    };
    h.run("detector={};fileToCanvas=async()=>({});detectExtract=detectPhoto;canvasBlob=async()=>null");
    const photo = h.run("registerFiles([{type:'image/png',name:'old-photo.png'}])");
    await detecting;
    await h.run(action);
    h.run("sessionMeta={id:'next',mode:'manual'};storageMode='manual'");
    finishPhoto({ embedding: new Float32Array([1]), thumbnailCanvas: {} });
    h.release();
    await name;
    await new Promise(resolve => setImmediate(resolve));
    h.release(); await photo;
    assert.equal(h.people().length, 0);
    assert.equal(h.writes.length, 1, 'only the previously submitted name reached storage');
  });
}

test('a session-storage thumbnail finishing after deletion cannot recreate a person', async () => {
  const h = harness();
  let finishThumbnail;
  const thumb = { arrayBuffer: () => new Promise(resolve => { finishThumbnail = resolve; }) };
  const keys = new Map();
  h.context.sessionStorage = { getItem: k => keys.get(k) ?? null, setItem: (k,v) => keys.set(k,v), removeItem: k => keys.delete(k) };
  h.context.btoa = btoa;
  h.context.latePerson = {id:'old', name:'Guest', thumbnail:thumb};
  const writing = h.run('putTempPerson(latePerson)');
  await h.run('clearAllBiometricData()');
  finishThumbnail(new ArrayBuffer(1));
  await Promise.allSettled([writing]);
  assert.equal(keys.size, 0);
});

test('a failed duplicate-photo merge leaves the original matching vectors intact', async () => {
  const h = harness({ people: [{ id:'p', name:'P', embeddings:[[1]] }], deferred: true });
  h.context.setTimeout = callback => { callback(); return 0; };
  h.context.console = { warn() {} };
  let saving;
  const saved = new Promise(resolve => { saving = resolve; });
  h.context.signalSave = saving;
  h.run(`detector={};fileToCanvas=async()=>({});detectExtract=async()=>({embedding:new Float32Array([2])});
    duplicateCandidateFor=()=>({p:people[0]});askDuplicateRegistration=async()=>'merge';
    putPerson=p=>{signalSave();return testPut(p)}`);
  const merge = h.run("registerFiles([{type:'image/png',name:'photo.png'}])");
  await saved; h.reject(); await merge;
  assert.equal(h.run('embeddingCount(people[0])'), 1);
  assert.equal(h.run('lastRegistrationFailures.length'), 1);
});

for (const operation of ['changeRetentionMode("session")',
  'commitImportedSnapshot([], "session", {id:"replacement",mode:"session"})']) {
  test(operation + ' preserves the current persistent roster when temporary metadata exceeds quota', async () => {
    const h = harness({people: [{id:'p',name:'Original'}]});
    h.run(`storageMode='manual';
      let persistentExists=true, temporaryExists=false;
      replaceTempSnapshot=async()=>{temporaryExists=true};
      clearPersistentPeople=async()=>{persistentExists=false};
      clearTempPeople=()=>{temporaryExists=false};
      saveSessionMeta=()=>{throw Error('metadata quota exceeded')}`);
    await assert.rejects(h.run(operation), /quota/);
    assert.equal(h.run('persistentExists'), true);
    assert.equal(h.run('temporaryExists'), false);
    assert.equal(h.people()[0].name, 'Original');
    assert.equal(h.run('sessionMeta.id'), 'synthetic-session');
  });
}
