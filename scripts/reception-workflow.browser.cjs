// Run against the standalone build with Playwright and an installed Chromium browser.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function verify(browser, width, height, workflow) {
  const context = await browser.newContext({ viewport: { width, height }, offline: true });
  const page = await context.newPage();
  const errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', req => { if (/^https?:/.test(req.url())) network.push(req.url()); });
  const byId = id => page.locator('#' + id);
  const nav = view => page.locator('[data-view="' + view + '"]:visible').click();
  try {
    await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
    await page.locator('#sessionDialog[open]').waitFor();
    await page.locator('input[name="workflowMode"][value="' + workflow + '"]').check();
    await page.locator('input[name="retention"][value="session"]').check();
    await byId('sessionLanguage').selectOption('en');
    assert.equal(await byId('sessionStartBtn').isDisabled(), true);
    assert.equal(await page.locator('input[name="workflowMode"]:checked').inputValue(), workflow);
    assert.equal(await page.locator('input[name="retention"]:checked').inputValue(), 'session');
    assert.match(await byId('sessionDialogLead').textContent(), /Choose/);
    await byId('privacyAck').check();
    await byId('sessionStartBtn').click();
    await page.locator('#runtime.ready').waitFor();
    await nav('check');
    await byId('receptionModeBtn').click();
    await byId('preflightRegister').click();
    await byId('attendeeName').fill('Test Guest');
    await byId('nameOnlySubmit').click();
    await page.waitForFunction(() => document.querySelector('#registerCount').textContent === '1');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#registerCount').textContent === '1');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await nav('check');
    for (const id of ['cameraStartBtn', 'checkManualBtn']) {
      const box = await byId(id).boundingBox();
      const navBox = await byId('appMobileBottomBar').boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= (navBox?.y ?? height),
        id + ' must fit above the navigation at ' + width + 'px: ' + JSON.stringify(box));
    }
    if (width <= 720) {
      await byId('checkPrivacy').click();
      assert.ok(await byId('handlingNotice').isVisible());
      await byId('checkPrivacy').click();
    }
    await byId('receptionModeBtn').click();
    await page.locator('#preflightDialog[open]').waitFor();
    assert.ok(await byId('preflightStart').isDisabled());
    await byId('preflightManual').click();
    await byId('manualReceptionSearch').fill('Guest');
    await page.locator('[data-manual-reception]').click();
    await byId('manualReceptionClose').click();
    if (workflow === 'entryexit') {
      await byId('checkManualBtn').click();
      await page.locator('[data-manual-reception]').click();
      await byId('manualReceptionClose').click();
    }
    await nav('people');
    await byId('registrationExportBtn').click();
    await byId('registrationPassword').fill('test-roster-password');
    await byId('registrationPasswordConfirm').fill('test-roster-password');
    const backupPending = page.waitForEvent('download');
    await byId('registrationExportConfirm').click();
    const backup = await (await backupPending).path();
    assert.equal(JSON.parse(await fs.readFile(backup,'utf8')).formatVersion, 2);

    await nav('history');
    await byId('historySearch').fill('no such record');
    await byId('finishSessionBtn').click();
    const expected = workflow === 'entryexit' ? 2 : 1;
    assert.equal(await byId('finishCount').textContent(), String(expected));
    const csvPending = page.waitForEvent('download');
    await byId('finishCsvBtn').click();
    const csv = await fs.readFile(await (await csvPending).path(), 'utf8');
    assert.equal(csv.split(/\r?\n/).length, expected + 1);
    assert.match(csv, /Test Guest/);
    await byId('finishDeleteBtn').click();
    await byId('deleteAllCancel').click();
    await byId('finishSessionBtn').click();
    await byId('finishDeleteBtn').click();
    await byId('deleteAllConfirm').click();
    await page.locator('#sessionDialog[open]').waitFor();
    assert.equal(await byId('registerCount').textContent(), '0');
    assert.equal(await byId('toastAction').isVisible(), false, 'Deletion has no Undo action');
    await byId('registrationImportFile').setInputFiles({
      name: 'test.popupface', mimeType: 'application/octet-stream', buffer: await fs.readFile(backup)
    });
    await byId('registrationImportPassword').fill('test-roster-password');
    await byId('registrationImportDecrypt').click();
    await byId('registrationImportAck').check();
    await byId('registrationImportApply').click();
    await page.locator('#view-people.active').waitFor();
    assert.equal(await byId('peopleCount').textContent(), '1');
    assert.equal(await byId('embeddingTotal').textContent(), '0');
    assert.equal(await byId('historyCount').textContent(), '0');
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    console.log('PASS', workflow, width + 'x' + height, 'offline, including encrypted restore');
  } finally { await context.close(); }
}

// A version 1 roster with a synthetic vector and a one-pixel image, for checking
// import compatibility and the camera-permission branch without capturing people.
function photoRosterFixture() {
  const { randomBytes, pbkdf2Sync, createCipheriv } = require('node:crypto');
  const password = 'test-roster-password';
  const salt = randomBytes(16), iv = randomBytes(12), iterations = 100000;
  const fileType = 'popup-face-check-in-registration', formatVersion = 1;
  const payload = {
    fileType, formatVersion, embeddingModel: 'sface-2021dec-int8-ort', embeddingDimension: 128,
    people: [{ id:'fixture-photo', name:'Fixture Guest',
      thumbnail:{type:'image/png', data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSbkAAAAASUVORK5CYII='},
      embeddings:[Buffer.alloc(128 * 4).toString('base64')] }]
  };
  const cipher = createCipheriv('aes-256-gcm', pbkdf2Sync(password, salt, iterations, 32, 'sha256'), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return Buffer.from(JSON.stringify({ fileType, formatVersion, protected:true, protection:{
    method:'password', cipher:'AES-GCM', kdf:'PBKDF2-SHA-256', iterations,
    salt:salt.toString('base64'), iv:iv.toString('base64')
  }, payload:ciphertext.toString('base64') }));
}

async function verifyDeniedCamera(browser) {
  const context = await browser.newContext({offline:true});
  try {
    await context.grantPermissions([]);
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
    await page.locator('#sessionDialog[open]').waitFor();
    await page.selectOption('#sessionLanguage','en');
    const chooser = page.waitForEvent('filechooser');
    await page.click('#sessionImportBtn');
    await (await chooser).setFiles({name:'legacy.popupface',mimeType:'application/octet-stream',buffer:photoRosterFixture()});
    await page.fill('#registrationImportPassword','test-roster-password');
    await page.click('#registrationImportDecrypt');
    await page.check('#registrationImportAck');
    await page.click('#registrationImportApply');
    await page.locator('#view-people.active').waitFor();
    await page.locator('#runtime.ready').waitFor();
    await page.locator('[data-view="check"]:visible').click();
    await page.click('#receptionModeBtn');
    await page.locator('#preflightDialog[open]').waitFor();
    assert.match(await page.locator('#preflightList').innerText(), /Denied/);
    assert.match(await page.locator('#preflightList').innerText(), /1 \/ 1/);
    assert.ok(await page.locator('#preflightStart').isDisabled());
    await page.click('#preflightManual');
    await page.click('[data-manual-reception]');
    await page.waitForFunction(() => document.querySelector('#historyCount').textContent === '1');
    console.log('PASS camera permission denied with a compatible version 1 roster');
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  try {
    await verifyDeniedCamera(browser);
    await verify(browser, 390, 844, 'checkin');
    await verify(browser, 320, 640, 'entryexit');
    await verify(browser, 1360, 900, 'entryexit');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
