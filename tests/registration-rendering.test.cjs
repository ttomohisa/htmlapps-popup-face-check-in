const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(process.env.APP_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
const functions = ['filteredHistoryRows', 'escapeHtml', 'cardHtml', 'renderHistory', 'renderManualReceptionResults'].map(name => {
  const line = source.split(/\r?\n/).find(line => line.startsWith(`function ${name}(`));
  assert.ok(line, `source function ${name}`);
  return line;
}).join('\n');
function render(id, eventId, entryExit, checked) {
  const person = { id, name: 'Test person', checkedInAt: checked ? 1700000000000 : null };
  const elements = new Map();
  const $ = key => {
    if (!elements.has(key)) elements.set(key, { value: '', innerHTML: '', querySelectorAll: () => [] });
    return elements.get(key);
  };
  const context = vm.createContext({ $, people: [person], historyQuery: '', historyMethod: 'all', document: { querySelectorAll: () => [] },
    thumbnailUrl: () => 'blob:synthetic-thumbnail', embeddingModelOf: () => 'model', EMBEDDING_MODEL: 'model',
    embeddingCount: () => 2, MAX_EMBEDDINGS: 3, isEntryExit: () => entryExit, isInside: () => checked,
    checkinMethodOf: () => 'manual', checkEventsOf: () => [{ id: eventId }],
    t: (ja, en) => en, icon: () => '', timeText: () => '12:00', scoreText: () => '1',
    eventTypeLabel: () => 'Entry', renderRecentCheckins: () => {},
    historyRows: () => [{ person, eventId, method: 'manual', at: 1700000000000, type: 'entry' }]
  });
  vm.runInContext(functions, context);
  const card = context.cardHtml(person);
  context.renderHistory();
  context.renderManualReceptionResults();
  return { card, history: $('historyList').innerHTML, manual: $('manualReceptionResults').innerHTML };
}
for (const [label, id, escaped] of [
  ['normal identifier', 'person-123', 'person-123'],
  ['imported punctuation', `person" data-audit="inert<&>'日本語`, 'person&quot; data-audit=&quot;inert&lt;&amp;&gt;&#39;日本語']
]) {
  for (const entryExit of [false, true]) for (const checked of [false, true]) {
    test(`${label}, entryExit=${entryExit}, checked=${checked}`, () => {
      const result = render(id, id, entryExit, checked);
      for (const attr of ['data-id', 'data-delete', 'data-name', 'data-add-embedding', 'data-remove-embedding'])
        assert.ok(result.card.includes(`${attr}="${escaped}"`), attr);
      if (entryExit || !checked) assert.ok(result.card.includes(`data-manual-checkin="${escaped}"`));
      if (entryExit || checked) assert.ok(result.card.includes(`data-reset-checkin="${escaped}"`));
      if (entryExit) assert.ok(result.card.includes(`data-event-id="${escaped}"`));
      assert.ok(result.history.includes(`data-history-reset="${escaped}"`));
      assert.ok(result.history.includes(`data-event-id="${escaped}"`));
      assert.ok(result.manual.includes(`data-manual-reception="${escaped}"`));
      for (const html of Object.values(result)) assert.ok(!html.includes(' data-audit="'), 'identifier cannot create an attribute');
    });
  }
}