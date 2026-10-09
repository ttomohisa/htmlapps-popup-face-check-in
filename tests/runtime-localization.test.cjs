const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, source, element } = require('./helpers/app-harness.cjs');

// Execute the real language, startup and runtime-status code. Only engine and
// storage dependencies are synthetic; no camera, personal data or network is used.
function setup() {
  const h = harness();
  const translated = [];
  for (const [selector, el] of [['class="brand-meta"', element()], ['id="runtimeText"', h.get('runtimeText')]]) {
    const match = source.match(new RegExp(`<[^>]*${selector}[^>]*>([^<]*)`));
    assert.ok(match);
    el.textContent = match[1];
    for (const attr of match[0].matchAll(/data-(ja|en)="([^"]*)"/g)) el.dataset[attr[1]] = attr[2];
    translated.push(el);
  }
  // The real selector re-evaluates datasets after setRuntime changes them.
  h.selectors.set('[data-ja][data-en]', translated.filter(el => el.dataset.ja && el.dataset.en));
  h.context.console = { error() {} };
  h.context.performance = { now: (() => { let time = 0; return () => (time += 137); })() };
  h.context.self = { crossOriginIsolated: false };
  h.run(`openDb=async()=>{}; purgeExpired=async()=>[]; resolveSession=async()=>{};
    loadPersistentPeople=async()=>[]; assetBytes=async()=>new Uint8Array();
    bindUi=()=>{}; openSessionDialog=()=>{};`);
  return { ...h, subtitle: translated[0] };
}
function language(h, lang) { h.run(`lang='${lang}'; updateLang()`); }
function engine(h, inputNames = ['input']) {
  h.context.window.ort = { env: { wasm: {} }, InferenceSession: { create: async () => ({ inputNames }) } };
}

test('subtitle and initial preparation status follow repeated JA/EN switches', () => {
  const h = setup();
  for (const lang of ['en', 'ja', 'en']) {
    language(h, lang);
    assert.equal(h.subtitle.textContent, lang === 'en' ? 'Temporary, on-device face matching for events and gatherings' : 'イベントや集まりの受付向け・一時利用・端末内完結の顔照合ツール');
    assert.equal(h.get('runtimeText').textContent, lang === 'en' ? 'Preparing face matching…' : '顔照合の準備をしています…');
  }
});

test('engine-loading status changes language while its asynchronous load is pending', async () => {
  const h = setup();
  let release;
  h.context.setTimeout = fn => { release = fn; };
  language(h, 'ja');
  const loading = h.run('waitOrt()');
  language(h, 'en');
  assert.equal(h.get('runtimeText').textContent, 'Loading face-matching engine…');
  engine(h); release(); await loading;
});

test('model preparation and ready status retain their phase and elapsed time on switches', async () => {
  const h = setup(); engine(h); await h.run('waitOrt()');
  let release;
  const pendingModel = new Promise(resolve => { release = () => resolve({ inputNames: ['input'] }); });
  h.context.window.ort.InferenceSession.create = () => pendingModel;
  language(h, 'ja');
  const initializing = h.run('initModels()');
  await Promise.resolve(); await Promise.resolve();
  language(h, 'en');
  assert.equal(h.get('runtimeText').textContent, 'Preparing face detection and matching…');
  release(); await initializing;
  for (const lang of ['en', 'ja', 'en']) {
    language(h, lang);
    assert.equal(h.get('runtimeText').textContent, lang === 'en' ? 'Ready — on-device / 137 ms' : '準備完了 — 端末内処理 / 137 ms');
    assert.equal(h.get('runtime').className, 'runtime ready');
  }
});

for (const kind of ['engine', 'detection', 'matching', 'external']) {
  test(`startup ${kind} error retains its detail and error state across JA/EN switches`, async () => {
    const h = setup(); engine(h);
    let ja, en;
    if (kind === 'engine') {
      h.context.window.ort = {};
      ja = '顔照合の実行機能を読み込めませんでした'; en = 'Could not load the face-matching engine';
    } else if (kind === 'external') {
      h.context.window.ort.InferenceSession.create = async () => { throw new Error('Synthetic model error 503'); };
      ja = en = 'Synthetic model error 503';
    } else {
      let count = 0;
      h.context.window.ort.InferenceSession.create = async () => ({ inputNames: (++count === (kind === 'detection' ? 1 : 2)) ? [] : ['input'] });
      ja = kind === 'detection' ? '顔検出の準備に失敗しました' : '顔照合の準備に失敗しました';
      en = kind === 'detection' ? 'Face detection setup failed' : 'Face matching setup failed';
    }
    language(h, 'ja'); await h.run('boot()');
    for (const lang of ['en', 'ja', 'en']) {
      language(h, lang);
      assert.equal(h.get('runtimeText').textContent, lang === 'en' ? 'Startup failed: ' + en : '起動に失敗しました: ' + ja);
      assert.equal(h.get('runtime').className, 'runtime error');
    }
  });
}
