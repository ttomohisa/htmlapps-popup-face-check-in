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
