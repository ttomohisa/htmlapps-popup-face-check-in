const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.APP_HTML || path.join(__dirname, '../../src/index.template.html'), 'utf8');
const start = source.indexOf("(()=>{'use strict';");
const end = source.lastIndexOf('\nboot();');
if (start < 0 || end < 0) throw new Error('Application script not found');
const script = source.slice(start + "(()=>{'use strict';".length, end);

function element(dataset = {}) {
  const listeners = new Map(), attrs = new Map();
  return { dataset, value: '', textContent: '', innerHTML: '', disabled: false, checked: true, hidden: false,
    style: {}, classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(type, fn) { listeners.set(type, fn); },
    dispatch(type, value) { return listeners.get(type)?.({ target: this, preventDefault() {}, ...value }); },
    setAttribute(key, value) { attrs.set(key, value); }, getAttribute(key) { return attrs.get(key); },
    querySelector() { return null; }, querySelectorAll() { return []; }, close() {}, showModal() {}, focus() {}
  };
}
function harness({ mode = 'entryexit', people = [], deferred = false } = {}) {
  const selectors = new Map();
  const elements = new Map(), downloads = [], toasts = [], writes = [], pending = [];
  const filters = ['all', 'manual', 'face'].map(historyMethod => element({ historyMethod }));
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const document = { getElementById: get, documentElement: { lang: '' }, body: element(),
    querySelectorAll: selector => selector === '[data-history-method]' ? filters : (selectors.get(selector) || []),
    querySelector: selector => ({ value: selector.includes('workflow') ? mode : 'manual' }), addEventListener() {} };
  let serial = 0, stamp = 1800000000000;
  class SyntheticDate extends Date { static now() { return stamp++; } }
  const context = vm.createContext({ document, window: { addEventListener() {} }, navigator: {}, console,
    Blob, Date: SyntheticDate, crypto: { randomUUID: () => `synthetic-event-${++serial}` },
    setTimeout: () => 0, clearTimeout() {}, URL: { revokeObjectURL() {} },
    localStorage: { removeItem() {}, getItem() { return null; }, setItem() {} },
    sessionStorage: { removeItem() {}, getItem() { return null; }, setItem() {} }
  });
  vm.runInContext(script, context);
  context.testPeople = structuredClone(people);
  context.testMode = mode;
  context.testPut = p => { writes.push(structuredClone(p)); return deferred ? new Promise((resolve, reject) => pending.push({ resolve, reject })) : Promise.resolve(); };
  context.testToast = (...args) => toasts.push(args);
  context.testDownload = (blob, filename) => downloads.push({ blob, filename });
  vm.runInContext(`people=testPeople; lang='en'; sessionMeta={id:'synthetic-session',workflowMode:testMode,mode:'manual'};
    putPerson=testPut; showToast=testToast; downloadFile=testDownload;
    thumbnailUrl=()=>''; renderPeople=()=>renderHistory(); renderAll=()=>renderHistory();
    scheduleSessionExpiry=()=>{}; clearPersistentPeople=async()=>{}; clearTempPeople=()=>{};
    clearSessionMeta=()=>{sessionMeta=null}; saveSessionMeta=meta=>{sessionMeta=meta}; setResult=()=>{};
    replacePersistentSnapshot=async()=>{}; replaceTempSnapshot=async()=>{};`, context);
  return { context, get, filters, selectors, downloads, toasts, writes,
    run: code => vm.runInContext(code, context),
    people: () => vm.runInContext('people', context),
    release: () => pending.splice(0).forEach(p => p.resolve()),
    reject: () => pending.splice(0).forEach(p => p.reject(new Error('Synthetic storage failure')))
  };
}
module.exports = { harness, source, element };
