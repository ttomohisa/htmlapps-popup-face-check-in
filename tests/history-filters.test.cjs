const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, source } = require('./helpers/app-harness.cjs');
const event = (id, at, type, method) => ({ id, at: 1800000000000 + at, type, method, score: method === 'face' ? 0.77 : null });
const sample = () => [
  { id: 'synthetic-a', name: 'ALIce <&> [A].*', checkEvents: [event('a1', 1, 'in', 'manual'), event('a2', 4, 'out', 'face')] },
  { id: 'synthetic-b', name: '=Synthetic Bob', checkEvents: [event('b1', 2, 'in', 'face'), event('b2', 3, 'out', 'manual'), event('b3', 5, 'in', 'manual')] },
  { id: 'synthetic-c', name: '', checkEvents: [] }
];
const setFilter = (h, query, method = 'all') => h.run(`historyQuery=${JSON.stringify(query)};historyMethod=${JSON.stringify(method)};renderHistory()`);
const rowIds = h => Array.from(h.context.filteredHistoryRows(), r => r.eventId);

test('history search trims and ignores case, combines methods, preserves order and input records', () => {
  const h = harness({ people: sample() }); const before = JSON.stringify(h.people());
  setFilter(h, '   alice   '); assert.deepEqual(rowIds(h), ['a2', 'a1']);
  setFilter(h, 'aliCE', 'manual'); assert.deepEqual(rowIds(h), ['a1']);
  setFilter(h, '', 'face'); assert.deepEqual(rowIds(h), ['a2', 'b1']);
  setFilter(h, '', 'manual'); assert.deepEqual(rowIds(h), ['b3', 'b2', 'a1']);
  assert.equal(JSON.stringify(h.people()), before);
});
test('punctuation and HTML-like name search are literal and rendered names stay escaped', () => {
  const h = harness({ people: sample() }); setFilter(h, '[a].*');
  assert.deepEqual(rowIds(h), ['a2', 'a1']);
  assert.match(h.get('historyList').innerHTML, /ALIce &lt;&amp;&gt; \[A\]\.\*/);
  setFilter(h, '<&>'); assert.deepEqual(rowIds(h), ['a2', 'a1']);
  setFilter(h, '[a]+'); assert.deepEqual(rowIds(h), []);
});
test('shown/total count changes while session totals, latest and recent activity stay unfiltered', () => {
  const h = harness({ people: sample() }); setFilter(h, 'alice', 'manual');
  assert.equal(h.get('historyFilterCount').textContent, 'Showing 1 of 5 records');
  assert.equal(h.get('historyCount').textContent, 5);
  assert.equal(h.get('historyRemaining').textContent, 1);
  assert.equal(h.get('historyLatest').textContent, h.context.timeText(1800000000005));
  assert.match(h.get('recentCheckins').innerHTML, /=Synthetic Bob/);
  assert.doesNotMatch(h.get('historyList').innerHTML, /=Synthetic Bob/);
});
test('no-match and empty-session copy differ, and no-match still permits full export', () => {
  const h = harness({ people: sample() }); setFilter(h, 'absent');
  assert.match(h.get('historyList').innerHTML, /No history matches the current filters/);
  assert.equal(h.get('exportCsvBtn').disabled, false); assert.equal(h.get('exportJsonBtn').disabled, false);
  assert.equal(h.get('historyFilterCount').textContent, 'Showing 0 of 5 records');
  h.run('people=[];renderHistory()');
  assert.match(h.get('historyList').innerHTML, /No entry\/exit history yet/);
  assert.equal(h.get('historyFilterCount').textContent, 'Showing 0 of 0 records');
  assert.equal(h.get('exportCsvBtn').disabled, true);
});
test('filters also work in check-in mode with legacy face-method fallback', () => {
  const people = [{ id: 'a', name: 'Alice', checkedInAt: 1800000000001, checkedInMethod: 'manual' }, { id: 'b', name: 'Bob', checkedInAt: 1800000000002 }, { id: 'c', name: 'Carol' }];
  const h = harness({ people, mode: 'checkin' }); setFilter(h, '', 'face');
  assert.deepEqual(Array.from(h.context.filteredHistoryRows(), r => r.person.id), ['b']);
  assert.equal(h.get('historyRemaining').textContent, 1);
});
test('real UI input, method and clear bindings preserve filters through language repaint', () => {
  const h = harness({ people: sample() }); h.context.bindUi();
  h.get('historySearch').value = ' Alice '; h.get('historySearch').dispatch('input');
  h.filters[1].dispatch('click');
  assert.deepEqual(rowIds(h), ['a1']); assert.equal(h.filters[1].getAttribute('aria-pressed'), 'true');
  assert.equal(h.filters[0].getAttribute('aria-pressed'), 'false');
  h.run("lang='ja';updateLang()");
  assert.equal(h.get('historySearch').value, ' Alice ');
  assert.equal(h.get('historyFilterCount').textContent, '全5件中1件を表示'); assert.deepEqual(rowIds(h), ['a1']);
  h.get('historyClearBtn').dispatch('click');
  assert.equal(h.get('historySearch').value, ''); assert.deepEqual(rowIds(h), ['b3', 'a2', 'b2', 'b1', 'a1']);
  assert.equal(h.filters[0].getAttribute('aria-pressed'), 'true');
});
test('manual recording and its Undo repaint the filtered view without losing the filters', async () => {
  const h = harness({ people: sample() }); setFilter(h, 'alice', 'manual');
  await h.context.manualCheckin('synthetic-a');
  assert.equal(h.context.filteredHistoryRows().length, 2); assert.match(h.get('historyFilterCount').textContent, /2 of 6/);
  await h.toasts[0][1](); assert.deepEqual(rowIds(h), ['a1']);
  assert.equal(h.get('historySearch').value, 'alice'); assert.match(h.get('historyFilterCount').textContent, /1 of 5/);
});
test('canceling a filtered event and restoring it with Undo keeps the same filter', async () => {
  const h = harness({ people: sample() }); setFilter(h, 'alice', 'manual');
  h.run("pendingResetCheckinId='synthetic-a';pendingResetCheckinEventId='a1'");
  await h.context.confirmResetCheckin(); assert.deepEqual(rowIds(h), []);
  await h.toasts[0][1](); assert.deepEqual(rowIds(h), ['a1']);
  assert.equal(h.get('historySearch').value, 'alice');
});
test('session start, delete-all and expiry reset history controls', async () => {
  for (const action of ['startSelectedSession()', 'clearAllBiometricData()', 'handleSessionExpiry()']) {
    const h = harness({ people: sample() }); setFilter(h, 'alice', 'manual');
    if (action.startsWith('handle')) h.run("storageMode='today';sessionMeta.expiresAt=1;openSessionDialog=()=>{}");
    await h.run(action);
    assert.equal(h.run('historyQuery'), '', action); assert.equal(h.run('historyMethod'), 'all', action);
    assert.equal(h.get('historySearch').value, '', action);
  }
});
test('import replacement resets filters, while adding to the same session preserves them', async () => {
  const h = harness({ people: sample() }); setFilter(h, 'alice', 'manual');
  await h.run("commitImportedSnapshot(people,'manual',{id:'synthetic-session',workflowMode:'entryexit'})");
  assert.equal(h.run('historyQuery'), 'alice'); assert.equal(h.run('historyMethod'), 'manual');
  await h.run("commitImportedSnapshot([],'manual',{id:'replacement-session',workflowMode:'entryexit'})");
  assert.equal(h.run('historyQuery'), ''); assert.equal(h.run('historyMethod'), 'all');
});
test('CSV and JSON always export full newest-first history, with unchanged schemas and privacy', async () => {
  for (const lang of ['en', 'ja']) {
    const h = harness({ people: sample() }); h.run(`lang='${lang}'`); setFilter(h, 'absent', 'face');
    h.context.exportHistoryCsv(); h.context.exportHistoryJson();
    const csvBytes = new Uint8Array(await h.downloads[0].blob.arrayBuffer());
    assert.deepEqual(Array.from(csvBytes.slice(0, 3)), [239, 187, 191]);
    const csv = await h.downloads[0].blob.text(); const lines = csv.split('\r\n');
    assert.equal(lines.length, 6); assert.match(lines[1], /"'=Synthetic Bob"/);
    assert.equal(lines[0], lang === 'en' ? '"Name","Date/time","Event","Method","Similarity"' : '"名前","日時","入退場","方法","一致度"');
    assert.match(h.downloads[0].filename, /^popup-face-check-in-history-\d{4}-\d{2}-\d{2}\.csv$/);
    const json = JSON.parse(await h.downloads[1].blob.text()); assert.equal(json.history.length, 5);
    assert.equal(json.biometricDataIncluded, false); assert.equal(json.totalRegistered, 3);
    assert.deepEqual(json.history.map(r => r.name), ['=Synthetic Bob', 'ALIce <&> [A].*', '=Synthetic Bob', '=Synthetic Bob', 'ALIce <&> [A].*']);
    assert.deepEqual(Object.keys(json.history[0]), ['id', 'name', 'event', 'method', 'at', 'atLocal', 'similarity']);
    assert.doesNotMatch(JSON.stringify(json), /thumbnail|embedding|camera/i);
    assert.equal(json.history[0].similarity, null); assert.equal(json.history[1].similarity, 0.77);
  }
});
test('visible accessible controls and full-export labels are present in both languages', () => {
  assert.match(source, /<label[^>]*for="historySearch"[^>]*data-ja="[^"]+"[^>]*data-en="[^"]+"/);
  assert.match(source, /id="historySearch"[^>]*type="search"/);
  assert.match(source, /id="historyFilterCount"[^>]*aria-live="polite"/);
  assert.match(source, /role="group"[^>]*aria-labelledby="historyMethodLabel"/);
  for (const method of ['all', 'manual', 'face']) assert.match(source, new RegExp(`data-history-method="${method}"[^>]*aria-pressed="(?:true|false)"`));
  assert.match(source, /data-ja="全履歴CSV" data-en="Export all CSV"/);
  assert.match(source, /data-ja="全履歴JSON" data-en="Export all JSON"/);
});
