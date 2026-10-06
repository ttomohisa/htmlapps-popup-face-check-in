const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/app-harness.cjs');
const sample = () => [{ id: 'synthetic-0', name: 'Synthetic participant', checkEvents: [] }];
const types = h => Array.from(h.people()[0].checkEvents, e => e.type);

test('overlapping manual activations for one person save only one entry', async () => {
  const h = harness({ people: sample(), deferred: true });
  const first = h.context.manualCheckin('synthetic-0');
  const repeat = h.context.manualCheckin('synthetic-0');
  h.release(); await Promise.all([first, repeat]);
  assert.equal(h.writes.length, 1);
  assert.deepEqual(types(h), ['in']);
  assert.equal(h.context.isInside(h.people()[0]), true);
  assert.equal(h.toasts.length, 1);
});
test('sequential completed entry then exit remains available', async () => {
  const h = harness({ people: sample(), deferred: true });
  for (let n = 0; n < 2; n++) { const call = h.context.manualCheckin('synthetic-0'); h.release(); await call; }
  assert.deepEqual(types(h), ['in', 'out']); assert.equal(h.writes.length, 2);
});
test('different people can record while another save is pending', async () => {
  const h = harness({ people: [...sample(), { id: 'synthetic-1', name: 'Second', checkEvents: [] }], deferred: true });
  const first = h.context.manualCheckin('synthetic-0'), second = h.context.manualCheckin('synthetic-1');
  assert.equal(h.writes.length, 2); h.release(); await Promise.all([first, second]);
  assert.deepEqual(Array.from(h.people(), p => Array.from(p.checkEvents, e => e.type)), [['in'], ['in']]);
});
test('one-time check-in still ignores overlapping and later activations', async () => {
  const h = harness({ mode: 'checkin', people: sample(), deferred: true });
  const first = h.context.manualCheckin('synthetic-0'), repeat = h.context.manualCheckin('synthetic-0');
  h.release(); await Promise.all([first, repeat]); await h.context.manualCheckin('synthetic-0');
  assert.equal(h.writes.length, 1); assert.equal(h.toasts.length, 1);
  assert.equal(h.people()[0].checkedInMethod, 'manual');
});
test('a rejected save releases the guard without claiming to roll back existing state', async () => {
  const h = harness({ people: sample(), deferred: true });
  const call = h.context.manualCheckin('synthetic-0'); const rejection = assert.rejects(call, /Synthetic storage failure/);
  h.reject(); await rejection;
  const next = h.context.manualCheckin('synthetic-0'); h.release(); await next;
  assert.equal(h.writes.length, 2); assert.deepEqual(types(h), ['in', 'out']);
});
test('manual entry Undo removes the recorded event and permits another entry', async () => {
  const h = harness({ people: sample() });
  await h.context.manualCheckin('synthetic-0'); await h.toasts[0][1]();
  assert.deepEqual(types(h), []);
  await h.context.manualCheckin('synthetic-0'); assert.deepEqual(types(h), ['in']);
});
test('card and reception-dialog entry points share the same pending guard', async () => {
  const { element } = require('./helpers/app-harness.cjs');
  const h = harness({ people: sample(), deferred: true });
  const card = element({ manualCheckin: 'synthetic-0' });
  const reception = element({ manualReception: 'synthetic-0' });
  h.selectors.set('[data-manual-checkin]', [card]);
  h.get('manualReceptionResults').querySelectorAll = () => [reception];
  h.context.bindCards(); h.context.renderManualReceptionResults();
  const first = card.dispatch('click'), second = reception.dispatch('click');
  h.release(); await Promise.all([first, second]);
  assert.equal(h.writes.length, 1); assert.deepEqual(types(h), ['in']);
});
